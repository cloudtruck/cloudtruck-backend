import mongoose from 'mongoose';
import Driver from '../models/driver.model.js';
import User from '../models/user.model.js';
import Vehicle from '../models/vehicle.model.js';
import Booking from '../models/booking.model.js';
import AuditLog from '../models/auditLog.model.js';
import Document from '../models/document.model.js';
import MasterData from '../models/masterData.model.js';
import DocumentService from './document.service.js';
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

      // Check for existing user with same phone/email (only check if provided)
      const orConditions = [];
      if (phone) orConditions.push({ phone });
      if (email) orConditions.push({ email });

      if (orConditions.length > 0) {
        const existingUser = await User.findOne({
          $or: orConditions,
          isDeleted: false
        });

        if (existingUser) {
          throw new ApiError(400, 'A user with this phone or email already exists');
        }
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
    if (filters.kycStatus) query.kycStatus = filters.kycStatus;
    if (filters.accountInfoStatus) query.accountInfoStatus = filters.accountInfoStatus;

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

    if (minRating) query['performance.averageRating'] = { $gte: minRating };

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
      sort: pagination.sort || { 'performance.averageRating': -1, createdAt: -1 },
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
          return (b.performance?.averageRating || 0) - (a.performance?.averageRating || 0);
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
      driver.performance.averageRating = metrics.rating;
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

    if (driver.licenseExpiry && new Date(driver.licenseExpiry) < new Date()) {
      throw new ApiError(400, 'Cannot verify driver: license has expired');
    }

    driver.isVerified = true;
    driver.verifiedAt = new Date();
    driver.verifiedBy = verifiedBy;
    driver.kycStatus = 'verified';
    driver.accountInfoStatus = 'verified';
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
    driver.kycStatus = 'rejected';
    driver.accountInfoStatus = 'rejected';
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
        rating: driver.performance.averageRating,
        totalTrips: driver.performance.completedTrips
      },
      period: { startDate, endDate },
      stats
    };
  }

  /**
   * Get driver trip history
   * @param {string} driverId - Driver ID
   * @param {Object} filters - Query filters (status, startDate, endDate, search, truckType, customerName)
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated bookings
   */
  static async getTripHistory(driverId, filters = {}, pagination = {}) {
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

    const { status, startDate, endDate, search, truckType, customerName } = filters;

    const query = {
      driver: driverDocId,
      isDeleted: false
    };

    // Filter by booking status
    // Special case: 'active' maps to multiple in-progress statuses
    const ACTIVE_STATUSES = ['assigned', 'driver-en-route', 'reached-pickup', 'loaded', 'in-transit', 'reached-destination'];

    if (status) {
      if (status === 'active') {
        query.status = { $in: ACTIVE_STATUSES };
      } else {
        query.status = status;
      }
    }

    // Filter by date range (based on createdAt)
    // Bare dates (YYYY-MM-DD) are treated as IST (UTC+05:30) since the business operates in India.
    // Full ISO strings with offset (e.g. 2026-02-23T00:00:00+05:30) are used as-is.
    if (startDate || endDate) {
      const IST_OFFSET = '+05:30';
      query.createdAt = {};
      if (startDate) {
        const isBareDateStart = /^\d{4}-\d{2}-\d{2}$/.test(startDate);
        query.createdAt.$gte = isBareDateStart
          ? new Date(`${startDate}T00:00:00${IST_OFFSET}`)
          : new Date(startDate);
      }
      if (endDate) {
        const isBareDateEnd = /^\d{4}-\d{2}-\d{2}$/.test(endDate);
        query.createdAt.$lte = isBareDateEnd
          ? new Date(`${endDate}T23:59:59.999${IST_OFFSET}`)
          : new Date(endDate);
      }
    }

    // Search by bookingId or pickup/drop city
    if (search) {
      query.$or = [
        { bookingId: { $regex: search, $options: 'i' } },
        { 'pickup.city': { $regex: search, $options: 'i' } },
        { 'drop.city': { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by truck type
    if (truckType) {
      query.truckTypeNeeded = truckType;
    }

    // Filter by customer/company name — resolve matching customer IDs first
    if (customerName) {
      const Customer = mongoose.model('Customer');
      const matchingCustomers = await Customer.find({
        companyName: { $regex: customerName, $options: 'i' },
        isDeleted: false
      }).select('_id').lean();

      query.customer = { $in: matchingCustomers.map(c => c._id) };
    }

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
      lastKnownLocation: {
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
      .select('name phone lastKnownLocation performance')
      .populate('user', 'phone')
      .limit(20);

    return drivers;
  }

  /**
   * Get wallet summary for a driver — derived from booking advances + balances.
   * Returns { balance, transactions[] } sorted newest-first.
   * @param {string} userId - Authenticated driver user ID
   * @returns {Promise<Object>} { balance: Number, transactions: Array }
   */
  static async getMyWallet(userId) {
    const driver = await Driver.findOne({ user: userId, isDeleted: false }).select('_id name');
    if (!driver) throw new ApiError(404, 'Driver profile not found');

    // Statuses where advance has been disbursed to driver
    const ADVANCE_STATUSES = ['in-transit', 'reached-destination', 'delivered', 'pod-received', 'closed'];
    // Statuses where full balance has been paid to driver
    const BALANCE_STATUSES = ['pod-received', 'closed'];

    const bookings = await Booking.find({
      driver: driver._id,
      isDeleted: false,
      status: { $in: [...new Set([...ADVANCE_STATUSES, ...BALANCE_STATUSES])] },
    })
      .select('bookingId status advanceRequired finalAmount expectedAmount pickup drop createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    const transactions = [];

    for (const b of bookings) {
      const freight = b.finalAmount || b.expectedAmount || 0;
      const advance = b.advanceRequired || 0;
      const balance = Math.max(0, freight - advance);
      const route = `${b.pickup?.city || ''} - ${b.drop?.city || ''}`.trim();
      const label = b.bookingId ? `#${b.bookingId} ${route}` : route;

      if (ADVANCE_STATUSES.includes(b.status) && advance > 0) {
        transactions.push({
          type: 'advance',
          title: 'Advance',
          subtitle: label,
          amount: advance,
          date: b.createdAt,
          bookingId: b.bookingId,
        });
      }

      if (BALANCE_STATUSES.includes(b.status) && balance > 0) {
        transactions.push({
          type: 'balance',
          title: 'Balance',
          subtitle: label,
          amount: balance,
          date: b.updatedAt,
          bookingId: b.bookingId,
        });
      }
    }

    // Sort newest first
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Compute running balance (all credits — no debit tracking without a bank-payout model)
    const balance = transactions.reduce((sum, t) => sum + t.amount, 0);

    return { balance, transactions };
  }

  /**
   * Submit KYC details (driver self-service)
   * @param {string} userId - Authenticated user ID
   * @param {Object} data - KYC data (fullName, panNumber, city, referralCode, truckType)
   * @returns {Promise<Object>} Updated driver
   */
  static async submitKyc(userId, data) {
    const driver = await Driver.findOne({ user: userId, isDeleted: false });
    if (!driver) {
      throw new ApiError(404, 'Driver profile not found');
    }

    if (driver.kycStatus === 'verified') {
      throw new ApiError(400, `KYC already ${driver.kycStatus}`);
    }

    // Validate truck type exists in MasterData
    const truckTypeEntry = await MasterData.findOne({
      category: 'truck-type',
      key: data.truckType.toLowerCase(),
      isDeleted: false,
      isActive: true
    });
    if (!truckTypeEntry) {
      throw new ApiError(400, 'Invalid truck type');
    }

    const oldData = driver.toObject();

    driver.name = data.fullName;
    if (!driver.pan) driver.pan = {};
    driver.pan.number = data.panNumber;
    driver.city = data.city;
    driver.licenseNumber = data.licenseNumber;
    if (data.referralCode) driver.referralCode = data.referralCode;
    driver.preferredTruckTypes = [data.truckType];
    driver.kycStatus = 'submitted';
    driver.kycSubmittedAt = new Date();
    driver.updatedBy = userId;

    await driver.save();

    // Audit log
    await AuditLog.create({
      user: userId,
      action: 'SUBMIT_DRIVER_KYC',
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
   * Submit account/financial info (driver self-service)
   * @param {string} userId - Authenticated user ID
   * @param {Object} data - Account info fields
   * @param {Object} files - Multer files (chequeImage, tdsDocument, aadhaarDocument)
   * @returns {Promise<Object>} Updated driver
   */
  static async submitAccountInfo(userId, data, files) {
    const driver = await Driver.findOne({ user: userId, isDeleted: false });
    if (!driver) {
      throw new ApiError(404, 'Driver profile not found');
    }

    const oldData = driver.toObject();

    if (driver.accountInfoStatus === 'verified') {
      throw new ApiError(400, `Account information already ${driver.accountInfoStatus}`);
    }

    // Upload each file and create Document records
    const fileFields = ['chequeImage', 'tdsDocument', 'aadhaarDocument', 'panDocument'];
    const documentIds = {};

    for (const field of fileFields) {
      const file = files[field]?.[0];
      if (!file) continue;

      const uploadResult = await DocumentService.uploadDocument(file.path, 'driver-account', {
        entityType: 'driver',
        entityId: driver._id.toString()
      });

      const doc = await Document.create({
        ownerRef: { kind: 'driver', item: driver._id },
        type: field,
        url: uploadResult.url,
        providerId: uploadResult.cloudinaryId,
        format: uploadResult.format,
        bytes: uploadResult.size,
        uploadedBy: userId,
        status: 'uploaded'
      });

      documentIds[field] = doc._id;
    }

    // Update driver fields
    driver.bankDetails = {
      accountHolderName: data.accountHolderName,
      accountNumber: data.accountNumber,
      ifscCode: data.ifscCode
    };

    if (!driver.aadhaar) driver.aadhaar = {};
    driver.aadhaar.number = data.aadhaarNumber;

    if (!driver.pan) driver.pan = {};
    driver.pan.number = data.panNumber;

    if (data.gstin) driver.gstin = data.gstin;

    if (!driver.documents) driver.documents = {};
    if (documentIds.chequeImage) driver.documents.chequeImage = documentIds.chequeImage;
    if (documentIds.tdsDocument) driver.documents.tdsDocument = documentIds.tdsDocument;
    if (documentIds.aadhaarDocument) driver.documents.aadhaarDocument = documentIds.aadhaarDocument;
    if (documentIds.panDocument) driver.documents.panDocument = documentIds.panDocument;

    driver.accountInfoStatus = 'submitted';
    driver.accountInfoSubmittedAt = new Date();
    driver.updatedBy = userId;

    await driver.save();

    // Audit log
    await AuditLog.create({
      user: userId,
      action: 'SUBMIT_DRIVER_ACCOUNT_INFO',
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
   * Soft delete driver
   * @param {string} driverId - Driver ID
   * @param {string} deletedBy - User ID
   * @returns {Promise<Object>} Deleted driver
   */
  /**
   * Driver self-deletes their own account
   * @param {string} userId - User ID (from JWT)
   * @returns {Promise<void>}
   */
  static async deleteMyAccount(userId) {
    const driver = await Driver.findOne({ user: userId });
    if (!driver) throw new ApiError(404, 'Driver profile not found');

    // Block if there is an active booking
    const activeBooking = await Booking.findOne({
      assignedDriver: driver._id,
      status: { $in: ['assigned', 'driver-en-route', 'loading', 'in-transit', 'reached-destination'] }
    });
    if (activeBooking) {
      throw new ApiError(400, 'Cannot delete account while you have an active trip. Please complete or cancel it first.');
    }

    // Soft-delete driver doc
    await driver.softDelete(userId);

    // Soft-delete user doc
    await User.findByIdAndUpdate(userId, { isDeleted: true, deletedAt: new Date() });

    // Revoke all refresh tokens
    const RefreshToken = (await import('../models/refreshToken.model.js')).default;
    await RefreshToken.updateMany(
      { user: userId, isRevoked: false },
      { isRevoked: true, revokedAt: new Date(), revokedReason: 'account_deleted' }
    );

    // Audit log
    await AuditLog.create({
      user: userId,
      action: 'DELETE_OWN_ACCOUNT',
      entityType: 'driver',
      entityId: driver._id,
      changes: { before: { isDeleted: false }, after: { isDeleted: true } }
    });
  }

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
