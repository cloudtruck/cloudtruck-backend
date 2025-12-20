import logger from '../utils/logger.js';

/**
 * Notification WebSocket Handler
 * Namespace: /notifications
 */
export default function notificationSocketHandler(io) {
  io.on('connection', (socket) => {
    logger.info('Client connected to notification namespace:', socket.id);

    /**
     * User joins their notification room
     * Event: user:join
     * Payload: { userId, role }
     */
    socket.on('user:join', ({ userId, role }) => {
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
     * Payload: { notificationId, userId }
     */
    socket.on('notification:read', ({ notificationId, userId }) => {
      logger.info('Notification marked as read:', { notificationId, userId, socketId: socket.id });
      
      socket.emit('notification:read:acknowledged', {
        success: true,
        notificationId
      });
    });

    /**
     * Mark all notifications as read
     * Event: notifications:read-all
     * Payload: { userId }
     */
    socket.on('notifications:read-all', ({ userId }) => {
      logger.info('All notifications marked as read:', { userId, socketId: socket.id });
      
      socket.emit('notifications:read-all:acknowledged', {
        success: true,
        userId
      });
    });

    /**
     * Request unread count
     * Event: notifications:count
     * Payload: { userId }
     */
    socket.on('notifications:count', ({ userId }) => {
      // This would typically query the database
      // For now, emit a mock response
      socket.emit('notifications:count:response', {
        success: true,
        count: 0
      });
      
      logger.debug('Unread count requested:', { userId, socketId: socket.id });
    });

    /**
     * User leaves notification room
     * Event: user:leave
     * Payload: { userId }
     */
    socket.on('user:leave', ({ userId }) => {
      socket.leave(`user:${userId}`);
      
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
