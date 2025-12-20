import TrackingService from '../services/tracking.service.js';
import logger from '../utils/logger.js';

/**
 * Tracking WebSocket Handler
 * Namespace: /tracking
 */
export default function trackingSocketHandler(io) {
  io.on('connection', (socket) => {
    logger.info('Client connected to tracking namespace:', socket.id);

    /**
     * Driver joins booking room
     * Event: driver:join
     * Payload: { driverId, bookingId }
     */
    socket.on('driver:join', ({ driverId, bookingId }) => {
      socket.join(`booking:${bookingId}`);
      socket.join(`driver:${driverId}`);
      
      logger.info('Driver joined booking room:', { driverId, bookingId, socketId: socket.id });
      
      socket.emit('driver:joined', {
        bookingId,
        message: 'Successfully joined booking tracking'
      });
    });

    /**
     * Customer/Staff joins booking room to watch
     * Event: watcher:join
     * Payload: { userId, bookingId, role }
     */
    socket.on('watcher:join', ({ userId, bookingId, role }) => {
      socket.join(`booking:${bookingId}`);
      
      logger.info('Watcher joined booking room:', { userId, bookingId, role, socketId: socket.id });
      
      socket.emit('watcher:joined', {
        bookingId,
        message: 'Successfully joined booking tracking'
      });
    });

    /**
     * Location update from driver
     * Event: location:update
     * Payload: { bookingId, driverId, latitude, longitude, accuracy, speed, heading, battery, networkType }
     */
    socket.on('location:update', async (data) => {
      try {
        const { bookingId, driverId, latitude, longitude, accuracy, speed, heading, battery, networkType } = data;

        // Save to database
        const tracking = await TrackingService.recordLocation(
          bookingId,
          driverId,
          { latitude, longitude, accuracy, speed, heading, battery, networkType }
        );

        // Broadcast to all watchers in booking room
        io.to(`booking:${bookingId}`).emit('location:updated', {
          bookingId,
          location: {
            latitude,
            longitude,
            accuracy
          },
          speed,
          heading,
          battery,
          timestamp: tracking.timestamp
        });

        logger.debug('Location updated:', { bookingId, driverId, latitude, longitude });

        // Acknowledge to driver
        socket.emit('location:acknowledged', {
          success: true,
          timestamp: tracking.timestamp
        });
      } catch (error) {
        logger.error('Location update error:', error);
        socket.emit('location:error', {
          success: false,
          message: error.message
        });
      }
    });

    /**
     * Driver leaves booking room
     * Event: driver:leave
     * Payload: { driverId, bookingId }
     */
    socket.on('driver:leave', ({ driverId, bookingId }) => {
      socket.leave(`booking:${bookingId}`);
      socket.leave(`driver:${driverId}`);
      
      logger.info('Driver left booking room:', { driverId, bookingId, socketId: socket.id });
    });

    /**
     * Watcher leaves booking room
     * Event: watcher:leave
     * Payload: { userId, bookingId }
     */
    socket.on('watcher:leave', ({ userId, bookingId }) => {
      socket.leave(`booking:${bookingId}`);
      
      logger.info('Watcher left booking room:', { userId, bookingId, socketId: socket.id });
    });

    /**
     * Request last known location
     * Event: location:request
     * Payload: { bookingId }
     */
    socket.on('location:request', async ({ bookingId }) => {
      try {
        const locationData = await TrackingService.getLastKnownLocation(bookingId);
        
        socket.emit('location:response', {
          success: true,
          data: locationData
        });
      } catch (error) {
        logger.error('Location request error:', error);
        socket.emit('location:response', {
          success: false,
          message: error.message
        });
      }
    });

    /**
     * Disconnect handler
     */
    socket.on('disconnect', (reason) => {
      logger.info('Client disconnected from tracking namespace:', {
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

  logger.info('Tracking WebSocket handler initialized');
}
