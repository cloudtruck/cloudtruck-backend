import Booking from '../models/booking.model.js';
import mongoose from 'mongoose';
import Customer from '../models/customer.model.js';
import Driver from '../models/driver.model.js';
import Vehicle from '../models/vehicle.model.js';
import Staff from '../models/staff.model.js';
import AuditLog from '../models/auditLog.model.js';
import NotificationService from './notification.service.js';
import DocumentService from './document.service.js';
import ApiError from '../utils/ApiError.js';

/**
 * Booking Service
 * Handles all booking lifecycle operations
 */
class BookingService {
  /**
   * Create new booking
   * @param {Object} data - Booking data
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Created booking
   */
  static async createBooking(data, customerId, files = []) {
    const {
      pickupCity,
      pickupLat,
      pickupLng,
      pickupAddress,
      dropCity,
      dropLat,
      dropLng,
      dropAddress,
      materialType,
      weight,
      truckType,
      bodyType,
      loadDate,
      advanceRequired,
      additionalInstructions,
      expectedAmount,
      isHazardous,
      isFragile,
      requiresTemperatureControl,
      priority
    } = data;

    // Verify customer exists
    const customer = await Customer.findOne({ user: customerId, isDeleted: false });
    if (!customer) {
      throw new ApiError(404, 'Customer profile not found');
    }

    // Check credit limit if applicable
    if (customer.creditLimit > 0 && customer.outstandingAmount >= customer.creditLimit) {
      throw new ApiError(400, 'Credit limit exceeded. Please clear dues.');
    }

    // Generate booking ID
    const count = await Booking.countDocuments();
    const bookingId = `BK${Date.now()}${String(count + 1).padStart(4, '0')}`;

    const loadDateObj = new Date(loadDate);

    // Create booking
    const booking = await Booking.create({
      bookingId,
      customer: customer._id,
      pickup: {
        city: pickupCity,
        address: pickupAddress,
        location: {
          type: 'Point',
          coordinates: [pickupLng, pickupLat]
        }
      },
      drop: {
        city: dropCity,
        address: dropAddress,
        location: {
          type: 'Point',
          coordinates: [dropLng, dropLat]
        }
      },
      materialType,
      weight: {
        value: weight,
        unit: 'tons' // Default unit
      },
      truckTypeNeeded: truckType,
      bodyType: bodyType || 'open',
      loadDate: loadDateObj,
      loadTime: loadDateObj.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      advanceRequired,
      additionalInstructions,
      expectedAmount,
      isHazardous: isHazardous || false,
      isFragile: isFragile || false,
      requiresTemperatureControl: requiresTemperatureControl || false,
      priority: priority || 'medium',
      status: 'created',
      statusHistory: [
        {
          status: 'created',
          updatedBy: customerId, // This is User ID, which is fine for updatedBy ref User
          timestamp: new Date()
        }
      ]
    });

    // Update customer metrics
    customer.businessMetrics.totalBookings += 1;
    await customer.save();

    // Attach uploaded cargo images (if any)
    if (Array.isArray(files) && files.length > 0) {
      const cargoFiles = files.filter(f => f.fieldname === 'cargoImages');
      if (cargoFiles.length > 0) {
        const uploadedDocs = [];
        for (const file of cargoFiles) {
          try {
            const doc = await DocumentService.createDocument({
              entityType: 'booking',
              entityId: booking._id,
              documentType: 'cargo-image',
              file
            }, customerId);
            uploadedDocs.push(doc);
            booking.cargoDocuments = booking.cargoDocuments || [];
            booking.cargoDocuments.push(doc._id);
          } catch (err) {
            // Log and continue; document upload failure shouldn't block booking creation
            console.error('Failed to upload cargo image during booking creation:', err);
          }
        }
        if (uploadedDocs.length) {
          await booking.save();
        }
      }
    }

    // Send notifications
    await NotificationService.sendNotification({
      recipient: customerId,
      type: 'booking_created',
      title: 'Booking Created',
      message: `Your booking ${bookingId} has been created successfully`,
      entityType: 'booking',
      entityId: booking._id,
      channels: ['push', 'in-app']
    });

    // Notify staff
    const staffUsers = await Staff.find({ isActive: true, department: 'operations' });
    for (const staff of staffUsers) {
      await NotificationService.sendNotification({
        recipient: staff.user,
        type: 'new_booking_request',
        title: 'New Booking Request',
        message: `New booking ${bookingId} from ${pickupCity} to ${dropCity}`,
        entityType: 'booking',
        entityId: booking._id,
        channels: ['in-app']
      });
    }

    // Audit log
    await AuditLog.create({
      user: customerId,
      action: 'CREATE_BOOKING',
      entityType: 'booking',
      entityId: booking._id,
      changes: {
        before: null,
        after: booking.toObject()
      }
    });

    return booking;
  }

  /**
   * Get bookings with filters and pagination
   * @param {Object} filters - Query filters
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Bookings with pagination
   */
  static async getBookings(filters = {}, pagination = {}) {
    const {
      customerId,
      driverId,
      status,
      startDate,
      endDate,
      truckType,
      city
    } = filters;

    const query = { isDeleted: false };

    if (customerId) query.customer = customerId;
    if (driverId) query.driver = driverId;
    if (status) {
      if (Array.isArray(status)) {
        query.status = { $in: status };
      } else {
        query.status = status;
      }
    }
    if (truckType) query.truckTypeNeeded = truckType;
    if (startDate || endDate) {
      query.loadDateTime = {};
      if (startDate) query.loadDateTime.$gte = new Date(startDate);
      if (endDate) query.loadDateTime.$lte = new Date(endDate);
    }
    if (city) {
      query.$or = [
        { 'pickup.city': new RegExp(city, 'i') },
        { 'drop.city': new RegExp(city, 'i') }
      ];
    }

    const result = await Booking.paginate(query, {
      page: pagination.page || 1,
      limit: pagination.limit || 20,
      sort: pagination.sort || { createdAt: -1 },
      populate: [
        { path: 'customer', select: 'companyName phone email' },
        { path: 'driver', select: 'name phone' },
        { path: 'vehicle', select: 'vehicleNumber truckType' },
        { path: 'assignedBy', select: 'name department' }
      ]
    });

    return result;
  }

  /**
   * Get booking by ID
   * @param {string} bookingId - Booking ID
   * @param {string} userId - User ID (for authorization)
   * @param {string} userRole - User role
   * @returns {Promise<Object>} Booking details
   */
  static async getBookingById(bookingId, userId, userRole) {
    let query = Booking.findOne({
      $or: [{ _id: bookingId }, { bookingId }],
      isDeleted: false
    });

    // Resolve role-based identity to domain entities
    let customerDocId = null;
    let driverDocId = null;
    if (userRole === 'customer') {
      const customerDoc = await Customer.findOne({ user: userId, isDeleted: false }).select('_id');
      if (!customerDoc) {
        throw new ApiError(404, 'Customer profile not found');
      }
      customerDocId = customerDoc._id.toString();
    } else if (userRole === 'driver') {
      const driverDoc = await Driver.findOne({ user: userId, isDeleted: false }).select('_id');
      if (!driverDoc) {
        throw new ApiError(404, 'Driver profile not found');
      }
      driverDocId = driverDoc._id.toString();
    }

    // Privacy: Drivers should not see customer contact details
    const customerFields = userRole === 'driver' 
      ? 'companyName' 
      : 'companyName phone email gstNumber';

    query = query
      .populate('customer', customerFields)
      .populate('driver', 'name phone licenseNumber')
      .populate('vehicle', 'vehicleNumber truckType capacity')
      .populate('assignedBy', 'name department')
      .populate('payments');

    const booking = await query;

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Authorization check
    if (userRole === 'customer' && booking.customer._id.toString() !== customerDocId) {
      throw new ApiError(403, 'Access denied');
    }
    if (userRole === 'driver' && booking.driver?._id.toString() !== driverDocId) {
      throw new ApiError(403, 'Access denied');
    }

    return booking;
  }

  /**
   * Update booking status
   * @param {string} bookingId - Booking ID
   * @param {string} newStatus - New status
   * @param {string} userId - User ID performing update
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Updated booking
   */
  static async updateStatus(bookingId, newStatus, userId, metadata = {}) {
    const booking = await Booking.findOne({
      $or: [{ _id: bookingId }, { bookingId }],
      isDeleted: false
    });

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Validate status transition
    const validTransitions = {
      created: ['under-review', 'cancelled'],
      'under-review': ['assigned', 'cancelled'],
      assigned: ['driver-enroute-to-pickup', 'cancelled'],
      'driver-enroute-to-pickup': ['reached-pickup'],
      'reached-pickup': ['loaded'],
      loaded: ['in-transit'],
      'in-transit': ['reached-destination'],
      'reached-destination': ['delivered'],
      delivered: ['pod-received'],
      'pod-received': ['closed']
    };

    if (!validTransitions[booking.status]?.includes(newStatus)) {
      throw new ApiError(400, `Invalid status transition from ${booking.status} to ${newStatus}`);
    }

    // Store old status for audit
    const oldStatus = booking.status;

    // Update status
    booking.status = newStatus;
    booking.statusHistory.push({
      status: newStatus,
      updatedBy: userId,
      timestamp: new Date(),
      note: metadata.note
    });

    // Update specific fields based on status
    if (newStatus === 'loaded') {
      booking.actualLoadTime = new Date();
    } else if (newStatus === 'delivered') {
      booking.actualDeliveryTime = new Date();
    }

    await booking.save();

    // Send notifications
    const notificationMap = {
      assigned: {
        title: 'Truck Assigned',
        message: 'A truck has been assigned to your booking'
      },
      loaded: {
        title: 'Cargo Loaded',
        message: 'Your cargo has been loaded and shipment started'
      },
      'in-transit': {
        title: 'In Transit',
        message: 'Your shipment is now in transit'
      },
      delivered: {
        title: 'Delivered',
        message: 'Your shipment has been delivered'
      },
      'pod-received': {
        title: 'POD Received',
        message: 'Proof of delivery has been uploaded'
      }
    };

    if (notificationMap[newStatus]) {
      await NotificationService.sendNotification({
        recipient: booking.customer,
        type: `booking_${newStatus}`,
        title: notificationMap[newStatus].title,
        message: notificationMap[newStatus].message,
        entityType: 'booking',
        entityId: booking._id,
        channels: ['push', 'sms', 'in-app']
      });
    }

    // Audit log
    await AuditLog.create({
      user: userId,
      action: 'UPDATE_BOOKING_STATUS',
      entityType: 'booking',
      entityId: booking._id,
      changes: {
        before: { status: oldStatus },
        after: { status: newStatus }
      },
      metadata: { note: metadata.note }
    });

    return booking;
  }

  /**
   * Assign driver and vehicle to booking
   * @param {string} bookingId - Booking ID
   * @param {string} driverId - Driver ID
   * @param {string} vehicleId - Vehicle ID
   * @param {string} assignedBy - Staff ID
   * @returns {Promise<Object>} Updated booking
   */
  static async assignDriver(bookingId, driverId, vehicleId, assignedBy) {
    const booking = await Booking.findOne({
      $or: [{ _id: bookingId }, { bookingId }],
      isDeleted: false
    });

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    if (!['created', 'under-review'].includes(booking.status)) {
      throw new ApiError(400, 'Cannot assign driver. Booking already assigned or in progress');
    }

    // Verify driver exists and is available
    const driver = await Driver.findById(driverId);
    if (!driver || driver.isDeleted) {
      throw new ApiError(404, 'Driver not found');
    }
    if (!driver.isAvailable) {
      throw new ApiError(400, 'Driver is not available');
    }
    if (driver.isBlacklisted) {
      throw new ApiError(400, 'Driver is blacklisted');
    }

    // Verify vehicle exists and is available
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle || vehicle.isDeleted) {
      throw new ApiError(404, 'Vehicle not found');
    }
    if (!vehicle.isAvailable) {
      throw new ApiError(400, 'Vehicle is not available');
    }

    // Verify vehicle matches booking requirements
    if (vehicle.truckType !== booking.truckTypeNeeded) {
      throw new ApiError(400, 'Vehicle type does not match booking requirements');
    }

    // Update booking
    booking.driver = driverId;
    booking.vehicle = vehicleId;
    booking.assignedBy = assignedBy;
    booking.assignedAt = new Date();
    booking.status = 'assigned';
    booking.statusHistory.push({
      status: 'assigned',
      updatedBy: assignedBy,
      timestamp: new Date(),
      note: `Assigned driver ${driver.name} with vehicle ${vehicle.vehicleNumber}`
    });

    await booking.save();

    // Update driver availability
    driver.isAvailable = false;
    driver.currentBooking = booking._id;
    await driver.save();

    // Update vehicle availability
    vehicle.isAvailable = false;
    vehicle.currentBooking = booking._id;
    await vehicle.save();

    // Update staff metrics
    const staff = await Staff.findById(assignedBy);
    if (staff) {
      staff.performance.bookingsAssigned += 1;
      staff.assignedBookings.push(booking._id);
      await staff.save();
    }

    // Notify driver
    await NotificationService.sendNotification({
      recipient: driver.user,
      type: 'booking_assigned',
      title: 'New Booking Assigned',
      message: `You have been assigned booking ${booking.bookingId}`,
      entityType: 'booking',
      entityId: booking._id,
      channels: ['push', 'in-app']
    });

    // Notify customer
    await NotificationService.sendNotification({
      recipient: booking.customer,
      type: 'driver_assigned',
      title: 'Driver Assigned',
      message: `Driver ${driver.name} has been assigned to your booking`,
      entityType: 'booking',
      entityId: booking._id,
      channels: ['push', 'sms', 'in-app']
    });

    // Audit log
    await AuditLog.create({
      user: assignedBy,
      action: 'ASSIGN_DRIVER',
      entityType: 'booking',
      entityId: booking._id,
      changes: {
        before: { driver: null, vehicle: null },
        after: { driver: driverId, vehicle: vehicleId }
      }
    });

    return booking.populate([
      { path: 'driver', select: 'name phone' },
      { path: 'vehicle', select: 'vehicleNumber truckType' }
    ]);
  }

  /**
   * Cancel booking
   * @param {string} bookingId - Booking ID
   * @param {string} userId - User ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Updated booking
   */
  static async cancelBooking(bookingId, userId, reason) {
    const booking = await Booking.findOne({
      $or: [{ _id: bookingId }, { bookingId }],
      isDeleted: false
    });

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Check if cancellation is allowed
    if (['delivered', 'pod-received', 'closed', 'cancelled'].includes(booking.status)) {
      throw new ApiError(400, 'Cannot cancel booking in current status');
    }

    const oldStatus = booking.status;

    // Update booking
    booking.status = 'cancelled';
    booking.statusHistory.push({
      status: 'cancelled',
      updatedBy: userId,
      timestamp: new Date(),
      note: reason
    });

    await booking.save();

    // Release driver if assigned
    if (booking.driver) {
      const driver = await Driver.findById(booking.driver);
      if (driver) {
        driver.isAvailable = true;
        driver.currentBooking = null;
        await driver.save();
      }
    }

    // Release vehicle if assigned
    if (booking.vehicle) {
      const vehicle = await Vehicle.findById(booking.vehicle);
      if (vehicle) {
        vehicle.isAvailable = true;
        vehicle.currentBooking = null;
        await vehicle.save();
      }
    }

    // Notify relevant parties
    await NotificationService.sendNotification({
      recipient: booking.customer,
      type: 'booking_cancelled',
      title: 'Booking Cancelled',
      message: `Booking ${booking.bookingId} has been cancelled. Reason: ${reason}`,
      entityType: 'booking',
      entityId: booking._id,
      channels: ['push', 'sms', 'in-app']
    });

    // Audit log
    await AuditLog.create({
      user: userId,
      action: 'CANCEL_BOOKING',
      entityType: 'booking',
      entityId: booking._id,
      changes: {
        before: { status: oldStatus },
        after: { status: 'cancelled' }
      },
      metadata: { reason }
    });

    return booking;
  }

  /**
   * Add delay to booking
   * @param {string} bookingId - Booking ID
   * @param {Object} delayData - Delay information
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated booking
   */
  static async addDelay(bookingId, delayData, userId) {
    const { reason, estimatedDelay } = delayData;

    const booking = await Booking.findOne({
      $or: [{ _id: bookingId }, { bookingId }],
      isDeleted: false
    });

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Add delay
    booking.delays.push({
      reason,
      estimatedDelay,
      reportedBy: userId,
      reportedAt: new Date()
    });

    await booking.save();

    // Notify customer
    await NotificationService.sendNotification({
      recipient: booking.customer,
      type: 'booking_delayed',
      title: 'Booking Delayed',
      message: `Booking ${booking.bookingId} is delayed. Reason: ${reason}`,
      entityType: 'booking',
      entityId: booking._id,
      channels: ['push', 'sms', 'in-app']
    });

    return booking;
  }

  /**
   * Get booking statistics
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Statistics
   */
  static async getStatistics(filters = {}) {
    const { startDate, endDate, customerId } = filters;

    const matchStage = { isDeleted: false };
    if (customerId) {
      matchStage.customer = new mongoose.Types.ObjectId(customerId);
    }
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const stats = await Booking.aggregate([
      { $match: matchStage },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalBookings: { $sum: 1 },
                totalRevenue: { $sum: { $ifNull: ['$finalAmount', '$expectedAmount', 0] } }
              }
            }
          ],
          statusBreakdown: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ]
        }
      }
    ]);

    const totals = stats[0].totals[0] || { totalBookings: 0, totalRevenue: 0 };
    const statusBreakdownArray = stats[0].statusBreakdown || [];
    
    const statusBreakdown = statusBreakdownArray.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    return {
      totalBookings: totals.totalBookings,
      totalRevenue: totals.totalRevenue,
      statusBreakdown
    };
  }
}

export default BookingService;
