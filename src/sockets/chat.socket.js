import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import ChatService from '../services/chat.service.js';
import Conversation from '../models/conversation.model.js';

/**
 * Chat WebSocket Handler
 * Namespace: /chat
 */
export default function chatSocketHandler(io) {
  // Authentication middleware — mirrors notification.socket.js exactly
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers['x-auth-token'];

    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      socket.user = decoded;
      socket.user.id = decoded._id ? decoded._id.toString() : (decoded.id || decoded.userId);
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    const role = socket.user.role;

    logger.info('Client connected to chat namespace:', { socketId: socket.id, userId, role });

    /**
     * Join a conversation room
     * Event: conversation:join
     * Payload: { conversationId }
     */
    socket.on('conversation:join', async ({ conversationId }) => {
      try {
        const conversation = await Conversation.findOne({
          _id: conversationId,
          isDeleted: false,
        });

        if (!conversation) {
          return socket.emit('error', { message: 'Conversation not found' });
        }

        const isStaff = ['staff', 'internal', 'super-admin'].includes(role);
        const isParticipant = isStaff || conversation.participants.some(
          p => p.toString() === userId
        );

        if (!isParticipant) {
          return socket.emit('error', { message: 'Not a participant' });
        }

        socket.join(`conversation:${conversationId}`);
        socket.emit('conversation:joined', { conversationId });

        logger.info('User joined conversation room:', { userId, conversationId });
      } catch (err) {
        logger.error('Error joining conversation:', err);
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });

    /**
     * Send a message via socket
     * Event: message:send
     * Payload: { conversationId, text, attachments? }
     */
    socket.on('message:send', async ({ conversationId, text, attachments }) => {
      try {
        await ChatService.sendMessage(
          conversationId,
          userId,
          role,
          { text, attachments },
          io
        );
      } catch (err) {
        logger.error('Error sending message via socket:', err);
        socket.emit('error', { message: err.message || 'Failed to send message' });
      }
    });

    /**
     * Typing started
     * Event: typing:start
     * Payload: { conversationId }
     */
    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('user:typing', {
        userId,
        name: socket.user.name || '',
        typing: true,
      });
    });

    /**
     * Typing stopped
     * Event: typing:stop
     * Payload: { conversationId }
     */
    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('user:typing', {
        userId,
        name: socket.user.name || '',
        typing: false,
      });
    });

    /**
     * Mark conversation as read
     * Event: message:read
     * Payload: { conversationId }
     */
    socket.on('message:read', async ({ conversationId }) => {
      try {
        await ChatService.markAsRead(conversationId, userId);
        socket.emit('conversation:read:ack', { conversationId });
      } catch (err) {
        logger.error('Error marking messages as read:', err);
        socket.emit('error', { message: 'Failed to mark as read' });
      }
    });

    /**
     * Disconnect handler
     */
    socket.on('disconnect', (reason) => {
      logger.info('Client disconnected from chat namespace:', {
        socketId: socket.id,
        userId,
        reason,
      });
    });

    socket.on('error', (error) => {
      logger.error('Chat socket error:', { socketId: socket.id, error });
    });
  });

  logger.info('Chat WebSocket handler initialized');
}
