import Driver from '../models/driver.model.js';
import User from '../models/user.model.js';
import Vehicle from '../models/vehicle.model.js';
import Booking from '../models/booking.model.js';
import AuditLog from '../models/auditLog.model.js';
import NotificationService from './notification.service.js';
import ApiError from '../utils/ApiError.js';

/**
 * Driver Service
 * Handles driver profile and operations management
 */
class DriverService {
  /**
   * Create driver profile
   * @param {Object} data - Driver data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Created driver
   */
  static async createDriver(data, userId) {
    const {
      name,
      licenseNumber,
      licenseExpiry,
      aadhaarNumber,
      panNumber,
      preferredTruckTypes,
      emergencyContact
    } = data;

    // Check if driver profile already exists
    const existingDriver = await Driver.findOne({ user: userId });
    if (existingDriver) {
      throw new ApiError(400, 'Driver profile already exists');
    }

    // Verify license number is unique
    const duplicateLicense = await Driver.findOne({ licenseNumber, isDeleted: false });
    if (duplicateLicense) {
      throw new ApiError(400, 'License number already registered');
    }

    // Create driver
    const driver = await Driver.create({
      user: userId,
      name,
      licenseNumber,
      licenseExpiry: new Date(licenseExpiry),
      aadhaarNumber,
      panNumber,
      preferredTruckTypes,
      emergencyContact,
      isVerified: false,
      isAvailable: true,
      createdBy: userId
    });

    // Audit log
    await AuditLog.create({
      user: userId,
      action: 'CREATE_DRIVER_PROFILE',
      entityType: 'driver',
      entityId: driver._id,
      changes: {
        before: null,
        after: driver.toObject()
      }
    });

    return driver;
  }

  /**
   * Get driver by ID
   * @param {string} driverId - Driver ID
   * @returns {Promise<Object>} Driver details
   */
  static async getDriverById(driverId) {
    const driver = await Driver.findOne({ _id: driverId, isDeleted: false })
      .populate('user', 'phone email status fcmToken')
      .populate('currentBooking', 'bookingId status pickup drop')
      .populate('vehicles', 'vehicleNumber truckType');

    if (!driver) {
      throw new ApiError(404, 'Driver not found');
    }

    return driver;
  }

  /**
   * Get drivers with filters
   * @param {Object} filters - Query filters
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Drivers list
   */
  static async getDrivers(filters = {}, pagination = {}) {
    const {
      isAvailable,
      isVerified,
      truckType,
      location,
      radius = 50, // km
      minRating,
      isBlacklisted
    } = filters;

    const query = { isDeleted: false };

    if (typeof isAvailable === 'boolean') query.isAvailable = isAvailable;
    if (typeof isVerified === 'boolean') query.isVerified = isVerified;
    if (typeof isBlacklisted === 'boolean') query.isBlacklisted = isBlacklisted;
    if (truckType) query.preferredTruckTypes = truckType;
    if (minRating) query['performance.rating'] = { $gte: minRating };

    // Location-based search
    if (location && location.latitude && location.longitude) {
      query['currentLocation.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [location.longitude, location.latitude]
          },
          $maxDistance: radius * 1000 // Convert km to meters
        }
      };
    }

    const result = await Driver.paginate(query, {
      page: pagination.page || 1,
      limit: pagination.limit || 20,
      sort: pagination.sort || { 'performance.rating': -1, createdAt: -1 },
      populate: [
        { path: 'user', select: 'phone status' },
        { path: 'currentBooking', select: 'bookingId status' }
      ]
    });

    return result;
  }

  /**
   * Update driver profile
   * @param {string} driverId - Driver ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - User performing update
   * @returns {Promise<Object>} Updated driver
   */
  static async updateDriver(driverId, updateData, userId) {
    const driver = await Driver.findOne({ _id: driverId, isDeleted: false });

    if (!driver) {
      throw new ApiError(404, 'Driver not found');
    }

    const oldData = driver.toObject();

    // Update allowed fields
    const allowedFields = [
      'name',
      'licenseExpiry',
      'aadhaarNumber',
      'panNumber',
      'preferredTruckTypes',
      'emergencyContact',
      'bankDetails'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        driver[field] = updateData[field];
      }
    });

    driver.updatedBy = userId;
    await driver.save();

    // Audit log
    await AuditLog.create({
      user: userId,
      action: 'UPDATE_DRIVER_PROFILE',
      entityType: 'driver',
      entityId: driver._id,
      changes: {
        before: oldData,
        after: driver.toObject()
      }
    });

    return driver;
  }

  /**
   * Update driver location
   * @param {string} driverId - Driver ID
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @returns {Promise<void>}
   */
  static async updateLocation(driverId, latitude, longitude) {
    const driver = await Driver.findById(driverId);

    if (!driver) {
      throw new ApiError(404, 'Driver not found');
    }

    driver.currentLocation = {
      type: 'Point',
      coordinates: [longitude, latitude]
    };
    driver.lastLocationUpdate = new Date();

    await driver.save();
  }

  /**
   * Update driver availability
   * @param {string} driverId - Driver ID
   * @param {boolean} isAvailable - Availability status
   * @returns {Promise<Object>} Updated driver
   */
  static async updateAvailability(driverId, isAvailable) {
    const driver = await Driver.findById(driverId);

    if (!driver) {
      throw new ApiError(404, 'Driver not found');
    }

    // Cannot set available if has current booking
    if (isAvailable && driver.currentBooking) {
      throw new ApiError(400, 'Cannot set available while assigned to a booking');
    }

    driver.isAvailable = isAvailable;
    await driver.save();

    return driver;
  }

  /**
   * Update driver performance metrics
   * @param {string} driverId - Driver ID
   * @param {Object} metrics - Performance metrics
   * @returns {Promise<Object>} Updated driver
   */
  static async updatePerformance(driverId, metrics) {
    const driver = await Driver.findById(driverId);

    if (!driver) {
      throw new ApiError(404, 'Driver not found');
    }

    if (metrics.completedTrips !== undefined) {
      driver.performance.completedTrips = metrics.completedTrips;
    }
    if (metrics.onTimeDeliveries !== undefined) {
      const total = driver.performance.completedTrips || 1;
      driver.performance.onTimeDeliveryRate = (metrics.onTimeDeliveries / total) * 100;
    }
    if (metrics.rating !== undefined) {
      driver.performance.rating = metrics.rating;
    }
    if (metrics.totalEarnings !== undefined) {
      driver.performance.totalEarnings = metrics.totalEarnings;
    }

    await driver.save();

    return driver;
  }

  /**
   * Add rating to driver
   * @param {string} driverId - Driver ID
   * @param {number} rating - Rating (1-5)
   * @param {string} feedback - Feedback text
   * @param {string} bookingId - Booking ID
   * @returns {Promise<Object>} Updated driver
   */
  static async addRating(driverId, rating, feedback, bookingId) {
    if (rating < 1 || rating > 5) {
      throw new ApiError(400, 'Rating must be between 1 and 5');
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      throw new ApiError(404, 'Driver not found');
    }

    // Update rating using model method
    await driver.updateRating(rating);

    // Could store individual ratings for history
    // await Rating.create({ driver: driverId, booking: bookingId, rating, feedback });

    return driver;
  }

  /**
   * Verify driver
   * @param {string} driverId - Driver ID
   * @param {string} verifiedBy - Staff ID
   * @returns {Promise<Object>} Updated driver
   */
  static async verifyDriver(driverId, verifiedBy) {
    const driver = await Driver.findById(driverId);

    if (!driver) {
      throw new ApiError(404, 'Driver not found');
    }

    driver.isVerified = true;
    driver.verifiedAt = new Date();
    driver.verifiedBy = verifiedBy;
    await driver.save();

    // Update user status
    await User.findByIdAndUpdate(driver.user, { status: 'active' });

    // Notify driver
    await NotificationService.sendNotification({
      recipient: driver.user,
      type: 'driver_verified',
      title: 'Profile Verified',
      message: 'Your driver profile has been verified. You can now accept bookings.',
      entityType: 'driver',
      entityId: driver._id,
      channels: ['push', 'sms', 'in-app']
    });

    return driver;
  }

  /**
   * Blacklist driver
   * @param {string} driverId - Driver ID
   * @param {string} reason - Blacklist reason
   * @param {string} blacklistedBy - Staff ID
   * @returns {Promise<Object>} Updated driver
   */
  static async blacklistDriver(driverId, reason, blacklistedBy) {
    const driver = await Driver.findById(driverId);

    if (!driver) {
      throw new ApiError(404, 'Driver not found');
    }

    await driver.blacklist(reason, blacklistedBy);

    // Block user account
    await User.findByIdAndUpdate(driver.user, { status: 'blocked' });

    // Notify driver
    await NotificationService.sendNotification({
      recipient: driver.user,
      type: 'driver_blacklisted',
      title: 'Account Suspended',
      message: `Your account has been suspended. Reason: ${reason}`,
      entityType: 'driver',
      entityId: driver._id,
      channels: ['push', 'sms']
    });

    return driver;
  }

  /**
   * Remove from blacklist
   * @param {string} driverId - Driver ID
   * @returns {Promise<Object>} Updated driver
   */
  static async removeFromBlacklist(driverId) {
    const driver = await Driver.findById(driverId);

    if (!driver) {
      throw new ApiError(404, 'Driver not found');
    }

    await driver.removeFromBlacklist();

    // Unblock user account
    await User.findByIdAndUpdate(driver.user, { status: 'active' });

    return driver;
  }

  /**
   * Get driver performance report
   * @param {string} driverId - Driver ID
   * @param {Object} dateRange - Date range filter
   * @returns {Promise<Object>} Performance report
   */
  static async getPerformanceReport(driverId, dateRange = {}) {
    const driver = await Driver.findById(driverId);

    if (!driver) {
      throw new ApiError(404, 'Driver not found');
    }

    const { startDate, endDate } = dateRange;
    const matchStage = {
      driver: driverId,
      status: { $in: ['delivered', 'pod-received', 'closed'] }
    };

    if (startDate || endDate) {
      matchStage.actualDeliveryTime = {};
      if (startDate) matchStage.actualDeliveryTime.$gte = new Date(startDate);
      if (endDate) matchStage.actualDeliveryTime.$lte = new Date(endDate);
    }

    const bookings = await Booking.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' },
          avgDeliveryTime: { $avg: '$actualDeliveryTime' },
          onTimeDeliveries: {
            $sum: {
              $cond: [{ $lte: ['$actualDeliveryTime', '$loadDateTime'] }, 1, 0]
            }
          }
        }
      }
    ]);

    const stats = bookings[0] || {
      totalBookings: 0,
      totalRevenue: 0,
      avgDeliveryTime: 0,
      onTimeDeliveries: 0
    };

    return {
      driver: {
        name: driver.name,
        rating: driver.performance.rating,
        totalTrips: driver.performance.completedTrips
      },
      period: { startDate, endDate },
      stats
    };
  }

  /**
   * Get nearby drivers
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @param {number} radius - Radius in km
   * @param {string} truckType - Required truck type
   * @returns {Promise<Array>} Nearby drivers
   */
  static async getNearbyDrivers(latitude, longitude, radius = 50, truckType) {
    const query = {
      isDeleted: false,
      isAvailable: true,
      isVerified: true,
      isBlacklisted: false,
      currentLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: radius * 1000
        }
      }
    };

    if (truckType) {
      query.preferredTruckTypes = truckType;
    }

    const drivers = await Driver.find(query)
      .select('name phone currentLocation performance')
      .populate('user', 'phone')
      .limit(20);

    return drivers;
  }

  /**
   * Soft delete driver
   * @param {string} driverId - Driver ID
   * @param {string} deletedBy - User ID
   * @returns {Promise<Object>} Deleted driver
   */
  static async deleteDriver(driverId, deletedBy) {
    const driver = await Driver.findById(driverId);

    if (!driver) {
      throw new ApiError(404, 'Driver not found');
    }

    if (driver.currentBooking) {
      throw new ApiError(400, 'Cannot delete driver with active booking');
    }

    await driver.softDelete(deletedBy);

    // Audit log
    await AuditLog.create({
      user: deletedBy,
      action: 'DELETE_DRIVER',
      entityType: 'driver',
      entityId: driver._id,
      changes: {
        before: driver.toObject(),
        after: { isDeleted: true }
      }
    });

    return driver;
  }
}

export default DriverService;
