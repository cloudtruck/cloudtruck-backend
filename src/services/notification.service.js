import admin from '../config/firebase.js';
import logger from '../utils/logger.js';
import User from '../models/user.model.js';
import Driver from '../models/driver.model.js';
import Customer from '../models/customer.model.js';
import Staff from '../models/staff.model.js';
import Notification from '../models/notification.model.js';

class NotificationService {
  /**
   * Send push notification via Firebase
   * @param {String} fcmToken - Firebase Cloud Messaging token
   * @param {Object} notification - Notification data
   * @returns {Promise<void>}
   */
  static async sendPushNotification(fcmToken, notification) {
    const { title, body, data = {}, imageUrl } = notification;

    const message = {
      token: fcmToken,
      notification: {
        title,
        body,
        ...(imageUrl && { imageUrl })
      },
      data: {
        ...data,
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        timestamp: new Date().toISOString()
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'cloudtruck_notifications'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    try {
      const response = await admin.messaging().send(message);
      logger.info('Push notification sent:', { fcmToken: fcmToken.substring(0, 10) + '...', response });
    } catch (error) {
      logger.error('Failed to send push notification:', error);
      // Don't throw error - notification failure shouldn't break the flow
    }
  }

  /**
   * Send notification to user
   * @param {String} userId - User ID
   * @param {Object} notification - Notification data
   * @returns {Promise<void>}
   */
  static async sendToUser(userId, notification) {
    const user = await User.findById(userId).select('fcmToken');
    if (!user || !user.fcmToken) {
      logger.warn('User not found or no FCM token:', { userId });
      return;
    }

    await this.sendPushNotification(user.fcmToken, notification);
  }

  /**
   * Send notification to multiple users
   * @param {Array} userIds - Array of user IDs
   * @param {Object} notification - Notification data
   * @returns {Promise<void>}
   */
  static async sendToMultipleUsers(userIds, notification) {
    const users = await User.find({ _id: { $in: userIds }, fcmToken: { $exists: true, $ne: null } }).select('fcmToken');

    const tokens = users.map((u) => u.fcmToken);
    if (tokens.length === 0) return;

    const { title, body, data = {}, imageUrl } = notification;

    const message = {
      notification: { title, body, ...(imageUrl && { imageUrl }) },
      data: {
        ...data,
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        timestamp: new Date().toISOString()
      },
      android: { priority: 'high' },
      tokens
    };

    try {
      const response = await admin.messaging().sendMulticast(message);
      logger.info(`Multicast notification sent to ${tokens.length} users:`, { successCount: response.successCount, failureCount: response.failureCount });
    } catch (error) {
      logger.error('Failed to send multicast notification:', error);
    }
  }

  /**
   * Notify new booking created
   * @param {Object} booking - Booking object
   * @returns {Promise<void>}
   */
  static async notifyNewBooking(booking) {
    // Get all active staff
    const staff = await Staff.find({ isActive: true }).populate('user', 'fcmToken');
    const staffUserIds = staff.map((s) => s.user._id);

    await this.sendToMultipleUsers(staffUserIds, {
      title: 'New Booking Created',
      body: `Booking ${booking.bookingId} from ${booking.pickupCity} to ${booking.dropCity}`,
      data: {
        type: 'new_booking',
        bookingId: booking._id.toString(),
        action: 'view_booking'
      }
    });
  }

  /**
   * Notify driver assigned
   * @param {Object} booking - Booking object
   * @param {String} driverId - Driver ID
   * @returns {Promise<void>}
   */
  static async notifyDriverAssigned(booking, driverId) {
    const driver = await Driver.findById(driverId).populate('user', '_id');

    await this.sendToUser(driver.user._id, {
      title: 'New Trip Assigned',
      body: `You have been assigned to booking ${booking.bookingId}`,
      data: {
        type: 'driver_assigned',
        bookingId: booking._id.toString(),
        action: 'view_trip'
      }
    });

    // Notify customer
    const customer = await Customer.findById(booking.customer).populate('user', '_id');
    if (customer) {
      await this.sendToUser(customer.user._id, {
        title: 'Driver Assigned',
        body: `Driver has been assigned to your booking ${booking.bookingId}`,
        data: {
          type: 'driver_assigned',
          bookingId: booking._id.toString(),
          action: 'track_shipment'
        }
      });
    }
  }

  /**
   * Notify status update
   * @param {Object} booking - Booking object
   * @param {String} oldStatus - Previous status
   * @param {String} newStatus - New status
   * @returns {Promise<void>}
   */
  static async notifyStatusUpdate(booking, oldStatus, newStatus) {
    const statusMessages = {
      'under-review': 'Your booking is under review',
      'driver-en-route': 'Driver is on the way to pickup',
      'reached-pickup': 'Driver has reached pickup location',
      loaded: 'Shipment has been loaded',
      'in-transit': 'Shipment is in transit',
      'reached-destination': 'Driver has reached destination',
      delivered: 'Shipment delivered successfully',
      'pod-received': 'POD has been uploaded',
      closed: 'Booking closed'
    };

    // Notify customer
    const customer = await Customer.findById(booking.customer).populate('user', '_id');
    if (customer) {
      await this.sendToUser(customer.user._id, {
        title: `Booking ${booking.bookingId} Updated`,
        body: statusMessages[newStatus] || `Status updated to ${newStatus}`,
        data: {
          type: 'status_update',
          bookingId: booking._id.toString(),
          status: newStatus,
          action: 'track_shipment'
        }
      });
    }

    // Notify driver
    if (booking.driver) {
      const driver = await Driver.findById(booking.driver).populate('user', '_id');
      if (driver) {
        await this.sendToUser(driver.user._id, {
          title: `Booking ${booking.bookingId} Updated`,
          body: statusMessages[newStatus] || `Status updated to ${newStatus}`,
          data: {
            type: 'status_update',
            bookingId: booking._id.toString(),
            status: newStatus,
            action: 'view_trip'
          }
        });
      }
    }
  }

  /**
   * Notify payment success
   * @param {Object} booking - Booking object
   * @param {Object} payment - Payment object
   * @returns {Promise<void>}
   */
  static async notifyPaymentSuccess(booking, payment) {
    // Notify customer
    const customer = await Customer.findById(booking.customer).populate('user', '_id');
    if (customer) {
      await this.sendToUser(customer.user._id, {
        title: 'Payment Successful',
        body: `Payment of ₹${payment.amount} for booking ${booking.bookingId} completed`,
        data: {
          type: 'payment_success',
          bookingId: booking._id.toString(),
          paymentId: payment._id.toString(),
          action: 'view_booking'
        }
      });
    }

    // Notify staff
    if (booking.assignedStaff) {
      const staff = await Staff.findById(booking.assignedStaff).populate('user', '_id');
      if (staff) {
        await this.sendToUser(staff.user._id, {
          title: 'Payment Received',
          body: `Payment of ₹${payment.amount} received for booking ${booking.bookingId}`,
          data: {
            type: 'payment_received',
            bookingId: booking._id.toString(),
            paymentId: payment._id.toString(),
            action: 'view_booking'
          }
        });
      }
    }
  }

  /**
   * Notify delay added
   * @param {Object} booking - Booking object
   * @param {Object} delay - Delay object
   * @returns {Promise<void>}
   */
  static async notifyDelay(booking, delay) {
    // Notify customer
    const customer = await Customer.findById(booking.customer).populate('user', '_id');
    if (customer) {
      await this.sendToUser(customer.user._id, {
        title: `Delay in Booking ${booking.bookingId}`,
        body: `Delay of ${delay.duration} minutes: ${delay.reason}`,
        data: {
          type: 'delay_notification',
          bookingId: booking._id.toString(),
          action: 'track_shipment'
        }
      });
    }
  }

  /**
   * Notify booking cancelled
   * @param {Object} booking - Booking object
   * @param {String} reason - Cancellation reason
   * @returns {Promise<void>}
   */
  static async notifyBookingCancelled(booking, reason) {
    const notifications = [];

    // Notify customer
    const customer = await Customer.findById(booking.customer).populate('user', '_id');
    if (customer) {
      notifications.push(
        this.sendToUser(customer.user._id, {
          title: `Booking ${booking.bookingId} Cancelled`,
          body: `Reason: ${reason}`,
          data: {
            type: 'booking_cancelled',
            bookingId: booking._id.toString(),
            action: 'view_booking'
          }
        })
      );
    }

    // Notify driver if assigned
    if (booking.driver) {
      const driver = await Driver.findById(booking.driver).populate('user', '_id');
      if (driver) {
        notifications.push(
          this.sendToUser(driver.user._id, {
            title: `Booking ${booking.bookingId} Cancelled`,
            body: `Reason: ${reason}`,
            data: {
              type: 'booking_cancelled',
              bookingId: booking._id.toString(),
              action: 'view_trips'
            }
          })
        );
      }
    }

    // Notify assigned staff
    if (booking.assignedStaff) {
      const staff = await Staff.findById(booking.assignedStaff).populate('user', '_id');
      if (staff) {
        notifications.push(
          this.sendToUser(staff.user._id, {
            title: `Booking ${booking.bookingId} Cancelled`,
            body: `Reason: ${reason}`,
            data: {
              type: 'booking_cancelled',
              bookingId: booking._id.toString(),
              action: 'view_booking'
            }
          })
        );
      }
    }

    await Promise.all(notifications);
  }

  /**
   * Send custom notification
   * @param {String} userId - User ID
   * @param {String} title - Notification title
   * @param {String} message - Notification message
   * @param {Object} data - Additional data
   * @returns {Promise<void>}
   */
  static async sendCustomNotification(userId, title, message, data = {}) {
    await this.sendToUser(userId, {
      title,
      body: message,
      data: {
        type: 'custom',
        ...data
      }
    });
  }

  /**
   * Generic send notification wrapper for existing call sites
   * Accepts an object: { recipient, recipients, type, title, message, entityType, entityId, channels, data }
   */
  static async sendNotification({ recipient, recipients, type, title, message, entityType, entityId, channels = ['push'], data = {} }) {
    // Normalize recipients
    const resolveId = (r) => (r && r._id ? r._id.toString() : (r ? r.toString() : null));

    // Build notification payload
    const payload = {
      title,
      body: message,
      data: {
        event: type,
        entityType,
        entityId: entityId ? entityId.toString() : undefined,
        ...data
      }
    };

    try {
      // If explicit recipients array provided
      const userIds = Array.isArray(recipients) ? recipients.map(resolveId) : (Array.isArray(recipient) ? recipient.map(resolveId) : null);

      if (userIds && userIds.length > 0) {
        // Create notification records
        const notifications = userIds.map((uid) => ({
          user: uid,
          type: channels.includes('sms') ? 'sms' : channels.includes('in-app') ? 'in-app' : 'push',
          channel: channels.includes('sms') ? 'twilio' : 'firebase',
          title: payload.title,
          body: payload.body,
          data: payload.data,
          entity: { type: entityType || 'system', id: entityId }
        }));

        await Notification.insertMany(notifications);

        // Send push to multiple users if needed
        if (channels.includes('push') || channels.includes('in-app')) {
          await this.sendToMultipleUsers(userIds, payload);
        }

        // SMS handling: not implemented here, log for now
        if (channels.includes('sms')) {
          logger.warn('SMS channel requested but no SMS service is configured', { userIds });
        }

        return;
      }

      // Single recipient
      const userId = resolveId(recipient);
      if (!userId) {
        logger.warn('sendNotification called without valid recipient', { recipient });
        return;
      }

      // Create a notification record
      await Notification.create({
        user: userId,
        type: channels.includes('sms') ? 'sms' : channels.includes('in-app') ? 'in-app' : 'push',
        channel: channels.includes('sms') ? 'twilio' : 'firebase',
        title: payload.title,
        body: payload.body,
        data: payload.data,
        entity: { type: entityType || 'system', id: entityId }
      });

      // Send push/in-app as appropriate
      if (channels.includes('push') || channels.includes('in-app')) {
        await this.sendToUser(userId, payload);
      }

      if (channels.includes('sms')) {
        logger.warn('SMS channel requested but no SMS service is configured for user', { userId });
      }
    } catch (err) {
      logger.error('Error in sendNotification wrapper', err);
    }
  }
}

export default NotificationService;