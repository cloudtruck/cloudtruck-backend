import jwt from 'jsonwebtoken';
import Notification from '../models/notification.model.js';
import logger from '../utils/logger.js';

/**
 * Notification WebSocket Handler
 * Namespace: /notifications
 */
export default function notificationSocketHandler(io) {
  // Authentication middleware for Socket.io
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

    logger.info('Client connected to notification namespace:', {
      socketId: socket.id,
      userId,
      role
    });

    /**
     * User joins their notification room
     * Event: user:join
     * Auto-derives userId and role from authenticated socket.user
     */
    socket.on('user:join', () => {
      socket.join(`user:${userId}`);
      socket.join(`role:${role}`);

      logger.info('User joined notification room:', { userId, role, socketId: socket.id });

      socket.emit('user:joined', {
        userId,
        message: 'Successfully joined notification channel'
      });
    });

    /**
     * Mark notification as read
     * Event: notification:read
     * Payload: { notificationId }
     */
    socket.on('notification:read', async ({ notificationId }) => {
      try {
        const notification = await Notification.findById(notificationId);

        if (!notification || notification.user.toString() !== userId) {
          return socket.emit('notification:read:acknowledged', {
            success: false,
            message: 'Notification not found'
          });
        }

        await notification.markAsRead();

        socket.emit('notification:read:acknowledged', {
          success: true,
          notificationId
        });

        // Send updated unread count
        const unreadCount = await Notification.getUnreadCount(userId);
        socket.emit('notifications:count:updated', { count: unreadCount });
      } catch (error) {
        logger.error('Error marking notification as read:', error);
        socket.emit('notification:read:acknowledged', {
          success: false,
          message: 'Failed to mark notification as read'
        });
      }
    });

    /**
     * Mark all notifications as read
     * Event: notifications:read-all
     */
    socket.on('notifications:read-all', async () => {
      try {
        const result = await Notification.updateMany(
          { user: userId, isDeleted: false, readAt: null },
          { $set: { readAt: new Date(), status: 'read' } }
        );

        socket.emit('notifications:read-all:acknowledged', {
          success: true,
          count: result.modifiedCount
        });

        socket.emit('notifications:count:updated', { count: 0 });
      } catch (error) {
        logger.error('Error marking all notifications as read:', error);
        socket.emit('notifications:read-all:acknowledged', {
          success: false,
          message: 'Failed to mark all notifications as read'
        });
      }
    });

    /**
     * Request unread count
     * Event: notifications:count
     */
    socket.on('notifications:count', async () => {
      try {
        const count = await Notification.getUnreadCount(userId);

        socket.emit('notifications:count:response', {
          success: true,
          count
        });
      } catch (error) {
        logger.error('Error getting unread count:', error);
        socket.emit('notifications:count:response', {
          success: false,
          count: 0,
          message: 'Failed to get unread count'
        });
      }
    });

    /**
     * List recent notifications with pagination
     * Event: notifications:list
     * Payload: { offset, limit }
     */
    socket.on('notifications:list', async ({ offset = 0, limit = 20 } = {}) => {
      try {
        const safeLimit = Math.min(Math.max(limit, 1), 50);
        const safeOffset = Math.max(offset, 0);

        const [notifications, total] = await Promise.all([
          Notification.find({ user: userId, isDeleted: false })
            .sort({ createdAt: -1 })
            .skip(safeOffset)
            .limit(safeLimit)
            .lean(),
          Notification.countDocuments({ user: userId, isDeleted: false })
        ]);

        socket.emit('notifications:list:response', {
          success: true,
          data: {
            items: notifications,
            pagination: { offset: safeOffset, limit: safeLimit, total }
          }
        });
      } catch (error) {
        logger.error('Error listing notifications:', error);
        socket.emit('notifications:list:response', {
          success: false,
          message: 'Failed to fetch notifications'
        });
      }
    });

    /**
     * User leaves notification room
     * Event: user:leave
     */
    socket.on('user:leave', () => {
      socket.leave(`user:${userId}`);
      socket.leave(`role:${role}`);

      logger.info('User left notification room:', { userId, socketId: socket.id });
    });

    /**
     * Disconnect handler
     */
    socket.on('disconnect', (reason) => {
      logger.info('Client disconnected from notification namespace:', {
        socketId: socket.id,
        reason
      });
    });

    /**
     * Error handler
     */
    socket.on('error', (error) => {
      logger.error('Socket error:', { socketId: socket.id, error });
    });
  });

  logger.info('Notification WebSocket handler initialized');
}

/**
 * Helper function to emit notification to specific user
 * Can be called from services
 */
export function emitNotificationToUser(io, userId, notification) {
  io.of('/notifications').to(`user:${userId}`).emit('notification:new', notification);
  logger.info('Notification emitted to user:', { userId, notificationType: notification.type });
}

/**
 * Helper function to emit notification to all users with specific role
 */
export function emitNotificationToRole(io, role, notification) {
  io.of('/notifications').to(`role:${role}`).emit('notification:new', notification);
  logger.info('Notification emitted to role:', { role, notificationType: notification.type });
}

/**
 * Helper function to emit notification to multiple users
 */
export function emitNotificationToMultipleUsers(io, userIds, notification) {
  userIds.forEach((userId) => {
    io.of('/notifications').to(`user:${userId}`).emit('notification:new', notification);
  });
  logger.info('Notification emitted to multiple users:', { count: userIds.length, notificationType: notification.type });
}
