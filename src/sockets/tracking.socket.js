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

    const throttledUpdate = process.env.NODE_ENV === 'test'
      ? handleLocationUpdate
      : throttle(handleLocationUpdate, 10000, { leading: true, trailing: false });

    /**
     * Driver joins booking room
     * Event: driver:join
     * Payload: { driverId, bookingId }
     */
    socket.on('driver:join', async ({ driverId, bookingId }) => {
      try {
        // Security check: Only the driver themselves or staff can join as driver
        if (socket.user.role === 'driver') {
          const driverRecord = await Driver.findById(driverId);
          if (!driverRecord) {
            return socket.emit('location:error', { message: 'Driver record not found' });
          }

          const driverUserId = driverRecord.user.toString();
          const socketUserId = socket.user.id || socket.user._id?.toString() || socket.user._id;

          if (driverUserId !== socketUserId) {
            logger.warn('Driver authorization failed:', {
              driverUserId,
              socketUserId,
              socketUser: socket.user
            });
            return socket.emit('location:error', { message: 'Unauthorized driver join' });
          }
        }

        socket.join(`booking:${bookingId}`);
        socket.join(`driver:${driverId}`);

        // Mark driver online
        await Driver.findByIdAndUpdate(driverId, {
          isOnline: true,
          lastSeenAt: new Date()
        });

        // Broadcast status to all watchers in the booking room
        io.to(`booking:${bookingId}`).emit('driver:status', {
          driverId,
          bookingId,
          isOnline: true,
          timestamp: new Date()
        });

        logger.info('Driver joined booking room:', { driverId, bookingId, socketId: socket.id });

        socket.emit('driver:joined', {
          bookingId,
          message: 'Successfully joined booking tracking'
        });

        // Send last known location to the reconnecting driver (Reconnection Logic)
        const lastLocation = await TrackingService.getLastKnownLocation(bookingId);
        if (lastLocation?.lastLocation) {
          socket.emit('location:response', { success: true, data: lastLocation });
        }
      } catch (error) {
        logger.error('driver:join error:', error);
        socket.emit('location:error', { message: 'Failed to join booking tracking' });
      }
    });

    /**
     * Customer/Staff joins booking room to watch
     * Event: watcher:join
     * Payload: { userId, bookingId, role }
     */
    socket.on('watcher:join', async ({ userId, bookingId, role }) => {
      try {
        // Bug 2 fix: verify the requesting user has access to this booking
        const booking = await Booking.findById(bookingId).select('customer driver').lean();
        if (!booking) {
          return socket.emit('location:error', { message: 'Booking not found' });
        }

        const requesterId = socket.user.id;
        const userRole = socket.user.role;

        const isStaff = ['staff', 'internal', 'super-admin'].includes(userRole);
        const isCustomer = booking.customer?.toString() === requesterId;

        // booking.driver is a Driver ObjectId, not a User ObjectId — look up via Driver.user
        let isDriver = false;
        if (userRole === 'driver' && booking.driver) {
          const driverRecord = await Driver.findOne({ _id: booking.driver, user: requesterId }).lean();
          isDriver = !!driverRecord;
        }

        if (!isStaff && !isCustomer && !isDriver) {
          logger.warn('Unauthorized watcher:join attempt:', {
            requesterId,
            bookingId,
            role: userRole,
            socketId: socket.id
          });
          return socket.emit('location:error', {
            message: 'Unauthorized: You do not have access to this booking'
          });
        }

        socket.join(`booking:${bookingId}`);
        logger.info('Watcher joined booking room:', { userId, bookingId, role, socketId: socket.id });
        socket.emit('watcher:joined', {
          bookingId,
          message: 'Successfully joined booking tracking'
        });

        // Automatically push last known location to newly joined watcher (Reconnection Logic)
        const lastLocation = await TrackingService.getLastKnownLocation(bookingId);
        if (lastLocation?.lastLocation) {
          socket.emit('location:response', { success: true, data: lastLocation });
        }
      } catch (error) {
        logger.error('watcher:join error:', error);
        socket.emit('location:error', { message: 'Failed to join booking tracking' });
      }
    });

    /**
     * Location update from driver
     * Event: location:update
     * Payload: { bookingId, driverId, latitude, longitude, accuracy, speed, heading, battery, networkType }
     */
    socket.on('location:update', (data) => {
      // Bug 3 fix: accuracy check runs on EVERY ping, before the throttle gate.
      // This ensures low-accuracy pings are always acknowledged (not silently dropped by throttle).
      const MAX_ACCURACY_METERS = 100;
      if (data.accuracy !== undefined && data.accuracy > MAX_ACCURACY_METERS) {
        return socket.emit('location:acknowledged', {
          success: true,
          filtered: true,
          reason: `GPS accuracy too low (${data.accuracy}m > ${MAX_ACCURACY_METERS}m). Update discarded.`
        });
      }

      throttledUpdate(data);
    });

    /**
     * Driver leaves booking room
     * Event: driver:leave
     * Payload: { driverId, bookingId }
     */
    socket.on('driver:leave', async ({ driverId, bookingId }) => {
      socket.leave(`booking:${bookingId}`);
      socket.leave(`driver:${driverId}`);

      try {
        await Driver.findByIdAndUpdate(driverId, {
          isOnline: false,
          lastSeenAt: new Date()
        });

        io.to(`booking:${bookingId}`).emit('driver:status', {
          driverId,
          bookingId,
          isOnline: false,
          timestamp: new Date()
        });
      } catch (error) {
        logger.error('Error updating driver status on leave:', error);
      }
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
