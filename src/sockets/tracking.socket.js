import jwt from 'jsonwebtoken';
import throttle from 'lodash/throttle.js';
import TrackingService from '../services/tracking.service.js';
import Booking from '../models/booking.model.js';
import Driver from '../models/driver.model.js';
import logger from '../utils/logger.js';

/**
 * Tracking WebSocket Handler
 * Namespace: /tracking
 */
export default function trackingSocketHandler(io) {
  // Authentication middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers['x-auth-token'];
    
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      // Normalize user object: some tokens use _id while existing code expects id
      socket.user = decoded;
      socket.user.id = decoded._id ? decoded._id.toString() : (decoded.id || decoded.userId);
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info('Client connected to tracking namespace:', { 
      socketId: socket.id, 
      userId: socket.user.id,
      role: socket.user.role 
    });

    // Throttled update handler per socket to prevent spamming (max 1 per 10s)
    const handleLocationUpdate = async (data) => {
      try {
        const { bookingId, latitude, longitude, accuracy, speed, heading, battery, networkType } = data;

        // Resolve the booking and its driver record
        const booking = await Booking.findById(bookingId).populate('driver');
        if (!booking) {
          return socket.emit('location:error', { success: false, message: 'Booking not found' });
        }

        const driverRecord = booking.driver;
        // If sender is a driver, verify they own the driver record for this booking
        if (socket.user.role === 'driver') {
          if (!driverRecord || driverRecord.user.toString() !== socket.user.id.toString()) {
            return socket.emit('location:error', {
              success: false,
              message: 'Unauthorized: Driver not assigned to this booking'
            });
          }
        }

        const driverId = socket.user.role === 'driver' ? driverRecord._id.toString() : data.driverId;

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
          timestamp: tracking.ts || tracking.timestamp
        });

        logger.debug('Location updated:', { bookingId, driverId, latitude, longitude });

        // Acknowledge to sender
        socket.emit('location:acknowledged', {
          success: true,
          timestamp: tracking.ts || tracking.timestamp
        });
      } catch (error) {
        logger.error('Location update error:', error);
        socket.emit('location:error', {
          success: false,
          message: error.message
        });
      }
    };

    const throttledUpdate = throttle(handleLocationUpdate, 10000, { leading: true, trailing: false });

    /**
     * Driver joins booking room
     * Event: driver:join
     * Payload: { driverId, bookingId }
     */
    socket.on('driver:join', async ({ driverId, bookingId }) => {
      // Security check: Only the driver themselves or staff can join as driver
      if (socket.user.role === 'driver') {
        const driverRecord = await Driver.findById(driverId);
        if (!driverRecord || driverRecord.user.toString() !== socket.user.id.toString()) {
          return socket.emit('location:error', { message: 'Unauthorized driver join' });
        }
      }

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
      // Security check: Verify watcher has access to this booking (simplified for now)
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
    socket.on('location:update', (data) => {
      throttledUpdate(data);
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
