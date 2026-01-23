import mongoose from 'mongoose';
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
   * @param {Object|string} actor - User creating the profile (Admin or Driver itself)
   * @returns {Promise<Object>} Created driver
   */
  static async createDriver(data, actor) {
    const actorId = actor?._id || actor;
    const {
      name,
      licenseNumber,
      licenseExpiry,
      aadhaarNumber,
      panNumber,
      preferredTruckTypes,
      emergencyContact,
      user: providedUserId,
      userId: providedUserIdAlt,
      newUser
    } = data;

    let targetUserId = providedUserId || providedUserIdAlt;

    // 1. Create new user if requested
    if (!targetUserId && newUser) {
      const { phone, email, password } = newUser;

      // Check for existing user with same phone/email
      const existingUser = await User.findOne({
        $or: [
          { phone: phone || undefined },
          { email: email || undefined }
        ],
        isDeleted: false
      });

      if (existingUser) {
        throw new ApiError(400, 'A user with this phone or email already exists');
      }

      const createdUser = await User.create({
        phone,
        email,
        password,
        role: 'driver',
        status: 'active',
        createdBy: actorId
      });
      targetUserId = createdUser._id;
    }

    // 2. Fallback to actor if no targetUser (self-registration)
    if (!targetUserId) {
      targetUserId = actorId;
    }

    // Check if driver profile already exists
    const existingDriver = await Driver.findOne({ user: targetUserId, isDeleted: false });
    if (existingDriver) {
      throw new ApiError(400, 'Driver profile already exists for this user');
    }

    // Verify license number is unique
    const duplicateLicense = await Driver.findOne({ licenseNumber, isDeleted: false });
    if (duplicateLicense) {
      throw new ApiError(400, 'License number already registered');
    }

    // Create driver
    const driver = await Driver.create({
      user: targetUserId,
      name,
      licenseNumber,
      licenseExpiry: new Date(licenseExpiry),
      aadhaarNumber,
      panNumber,
      preferredTruckTypes,
      emergencyContact,
      isVerified: false,
      availability: 'available',
      createdBy: actorId
    });

    // Audit log
    await AuditLog.create({
      user: actorId,
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
    // Deterministic lookup: prefer document _id, then fallback to user id
    const isValidId = mongoose.Types.ObjectId.isValid(driverId);

    if (!isValidId) {
      throw new ApiError(404, 'Driver not found');
    }

    // Try by document _id first
    let driver = await Driver.findOne({ _id: driverId, isDeleted: false })
      .populate('user', 'phone email status fcmToken')
      .populate('currentBooking', 'bookingId status pickup drop')
      .populate('nextBooking', 'bookingId status pickup drop')
      .populate('vehicles', 'vehicleNumber truckType');

    if (driver) return driver;

    // Fallback: try by user id
    driver = await Driver.findOne({ user: driverId, isDeleted: false })
      .populate('user', 'phone email status fcmToken')
      .populate('currentBooking', 'bookingId status pickup drop')
      .populate('nextBooking', 'bookingId status pickup drop')
      .populate('vehicles', 'vehicleNumber truckType');

    if (!driver) {
      throw new ApiError(404, 'Driver not found');
    }

    return driver;
  }

  static async getDriverByUserId(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(400, 'Invalid user id');
    }

    const driver = await Driver.findOne({ user: userId, isDeleted: false })
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
      isBlacklisted,
      status,
      search,
      city,
      matchPickupCity
    } = filters;

    const query = { isDeleted: false };
    const andConditions = [];

    if (city) {
      // Driver model doesn't have city directly, usually it's in address or lastKnownLocation. 
      // If we don't have it, we might skip it or check a metadata field if added later.
      // For now, let's assume we might have it or skip if not in model.
    }

    if (search) {
      andConditions.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { licenseNumber: { $regex: search, $options: 'i' } }
        ]
      });
    }

    if (status) {
      query.availability = status;
    }

    // Filter by availability for assignment
    if (isAvailable === true) {
      // Logic: (not offline) AND (has either slot empty)
      andConditions.push({ 
        availability: { $ne: 'offline' } 
      });
      andConditions.push({
        $or: [
          { nextBooking: null },
          { nextBooking: { $exists: false } },
          { currentBooking: null },
          { currentBooking: { $exists: false } }
        ]
      });
      query.isBlacklisted = false;
    } else if (isAvailable === false) {
      andConditions.push({
        $or: [
          { availability: { $ne: 'available' } },
          { nextBooking: { $ne: null } },
          { isBlacklisted: true }
        ]
      });
    }

    if (typeof isVerified === 'boolean') query.isVerified = isVerified;
    
    // Only set isBlacklisted if not already set by isAvailable
    if (typeof isBlacklisted === 'boolean' && isAvailable !== true) {
      query.isBlacklisted = isBlacklisted;
    }

    if (truckType) {
      andConditions.push({
        $or: [
          { preferredTruckTypes: truckType },
          { preferredTruckTypes: { $size: 0 } },
          { preferredTruckTypes: { $exists: false } },
          { preferredTruckTypes: null }
        ]
      });
    }

    if (minRating) query.rating = { $gte: minRating };

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    // Location-based search
    if (location && location.latitude && location.longitude) {
      query['lastKnownLocation.coordinates'] = {
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
      sort: pagination.sort || { rating: -1, createdAt: -1 },
      populate: [
        { path: 'user', select: 'phone status' },
        { path: 'currentBooking', select: 'bookingId status pickup drop' },
        { path: 'nextBooking', select: 'bookingId status' }
      ]
    });

    // Post-process for "Return Trip" logic and stricter availability
    if (isAvailable === true && result.data) {
      const completionStatuses = ['reached-destination', 'delivered', 'pod-received', 'closed'];

      result.data = result.data.filter(driver => {
        // 1. If completely idle, they are available
        if (!driver.currentBooking) return true;

        // 2. If on-trip, they must be at destination AND have no next trip
        const isFinishingCurrent = completionStatuses.includes(driver.currentBooking.status);
        const hasNoNextTrip = !driver.nextBooking;

        return isFinishingCurrent && hasNoNextTrip;
      });

      // Tag "Return Trip" candidates and sort them to the top
      if (matchPickupCity) {
        result.data = result.data.map(driver => {
          const dropCity = driver.currentBooking?.drop?.city || '';
          const isReturn = dropCity.toLowerCase() === matchPickupCity.toLowerCase();
          
          return { ...driver, isReturnTrip: isReturn };
        });

        // Sort: Return candidates first, then by rating
        result.data.sort((a, b) => {
          if (a.isReturnTrip && !b.isReturnTrip) return -1;
          if (!a.isReturnTrip && b.isReturnTrip) return 1;
          return (b.rating || 0) - (a.rating || 0);
        });
      }

      // Update total count after post-filtering
      result.pagination.total = result.data.length;
    }

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
    let driver = await Driver.findOne({ _id: driverId, isDeleted: false });
    
    // Fallback if not found by primary id
    if (!driver) {
      driver = await Driver.findOne({ user: driverId, isDeleted: false });
    }

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
        if (field === 'aadhaarNumber') {
          if (!driver.aadhaar) driver.aadhaar = {};
          driver.aadhaar.number = updateData[field];
        } else if (field === 'panNumber') {
          if (!driver.pan) driver.pan = {};
          driver.pan.number = updateData[field];
        } else {
          driver[field] = updateData[field];
        }
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
    // Attempt to find by user ID first as used in controllers
    let driver = await Driver.findOne({ user: driverId, isDeleted: false });

    if (!driver) {
      // Try by driver ID just in case
      driver = await Driver.findById(driverId);
    }

    if (!driver) {
      throw new ApiError(404, 'Driver not found');
    }

    // Use document method for consistent field updates and validation
    await driver.updateLocation(longitude, latitude);
  }

  /**
   * Update driver availability
   * @param {string} driverId - Driver ID
   * @param {boolean} isAvailable - Availability status
   * @returns {Promise<Object>} Updated driver
   */
  static async updateAvailability(driverId, isAvailable) {
    let driver = await Driver.findOne({ _id: driverId, isDeleted: false });

    if (!driver) {
      driver = await Driver.findOne({ user: driverId, isDeleted: false });
    }

    if (!driver) {
      throw new ApiError(404, 'Driver not found');
    }

    // Cannot set available if has current booking
    if (isAvailable && driver.currentBooking) {
      throw new ApiError(400, 'Cannot set available while assigned to a booking');
    }

    driver.availability = isAvailable ? 'available' : 'offline';
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

    // Audit log
    await AuditLog.create({
      user: verifiedBy,
      action: 'VERIFY_DRIVER',
      entityType: 'driver',
      entityId: driver._id,
      changes: {
        before: { isVerified: false },
        after: { isVerified: true }
      }
    });

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
   * Reject driver (mark verification as rejected)
   * @param {string} driverId - Driver ID
   * @param {string} reason - Rejection reason
   * @param {string} rejectedBy - Staff ID
   * @returns {Promise<Object>} Updated driver
   */
  static async rejectDriver(driverId, reason, rejectedBy) {
    const driver = await Driver.findById(driverId);

    if (!driver) {
      throw new ApiError(404, 'Driver not found');
    }

    const oldData = driver.toObject();

    // Mark as not verified and store rejection details
    driver.isVerified = false;
    driver.rejectionReason = reason;
    driver.rejectedAt = new Date();
    driver.rejectedBy = rejectedBy;
    await driver.save();

    // Audit log
    await AuditLog.create({
      user: rejectedBy,
      action: 'REJECT_DRIVER',
      entityType: 'driver',
      entityId: driver._id,
      changes: {
        before: oldData,
        after: driver.toObject()
      }
    });

    // Notify driver
    await NotificationService.sendNotification({
      recipient: driver.user,
      type: 'driver_rejected',
      title: 'Profile Rejected',
      message: `Your driver profile was rejected. Reason: ${reason}`,
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
    // Accept either a driver document _id or a user _id; resolve to driver document
    let driver = null;

    if (mongoose.Types.ObjectId.isValid(driverId)) {
      // Try as driver._id
      driver = await Driver.findById(driverId);
      if (!driver) {
        // Try as user id
        driver = await Driver.findOne({ user: driverId, isDeleted: false });
      }
    }

    if (!driver) {
      throw new ApiError(404, 'Driver not found');
    }

    const { startDate, endDate } = dateRange;
    const matchStage = {
      driver: driver._id,
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
   * Get driver trip history
   * @param {string} driverId - Driver ID
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated bookings
   */
  static async getTripHistory(driverId, pagination = {}) {
    const isValidId = mongoose.Types.ObjectId.isValid(driverId);
    if (!isValidId) {
      throw new ApiError(400, 'Invalid driver ID');
    }

    // Resolve driver document ID if user ID is provided
    let driverDocId = driverId;
    const driver = await Driver.findOne({ 
      $or: [{ _id: driverId }, { user: driverId }], 
      isDeleted: false 
    }).select('_id');
    
    if (!driver) {
      throw new ApiError(404, 'Driver not found');
    }
    driverDocId = driver._id;

    const query = {
      driver: driverDocId,
      isDeleted: false
    };

    const result = await Booking.paginate(query, {
      page: pagination.page || 1,
      limit: pagination.limit || 10,
      sort: pagination.sort || { createdAt: -1 },
      populate: [
        { path: 'customer', select: 'companyName' },
        { path: 'vehicle', select: 'vehicleNumber truckType' }
      ]
    });

    return result;
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
      availability: 'available',
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
