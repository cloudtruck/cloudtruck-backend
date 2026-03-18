import Booking from '../models/booking.model.js';
import mongoose from 'mongoose';
import Customer from '../models/customer.model.js';
import Driver from '../models/driver.model.js';
import Vehicle from '../models/vehicle.model.js';
import Staff from '../models/staff.model.js';
import User from '../models/user.model.js';
import AuditLog from '../models/auditLog.model.js';
import NotificationService from './notification.service.js';
import DocumentService from './document.service.js';
import LocationService from './location.service.js';
import EwayBillService from './ewayBill.service.js';
import EwayBill from '../models/ewayBill.model.js';
import MasterData from '../models/masterData.model.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

/**
 * Booking Service
 * Handles all booking lifecycle operations
 */
class BookingService {
  /**
   * Create new booking
   * @param {Object} data - Booking data
   * @param {string} userId - User ID of the person creating the booking
   * @param {Array} files - Uploaded files
   * @returns {Promise<Object>} Created booking
   */
  static async createBooking(data, userId, files = []) {
    const {
      pickupCity,
      pickupState,
      pickupLat,
      pickupLng,
      pickupAddress,
      pickupContactName,
      pickupContactPhone,
      dropCity,
      dropState,
      dropLat,
      dropLng,
      dropAddress,
      dropContactName,
      dropContactPhone,
      materialType,
      weight,
      weightUnit,
      truckType,
      bodyType,
      loadDate,
      expectedDeliveryDate,
      advanceRequired,
      additionalInstructions,
      expectedAmount,
      isHazardous,
      isFragile,
      requiresTemperatureControl,
      priority,
      customerId, // Optional customer profile ID for admin creation
      // Digitify / indent fields
      laneCode,
      sourceCode,
      destinationCode,
      supplier,
      indentType,
      exim,
      trafficController,
      supplierPrice,
      customerPrice,
      ratePerTon,
      expiryTime,
      postToSupplier,
      remarks,
      numberOfTrucks,
      // Direct Load / Direct Invoice fields
      vehicleId,
      driverId: driverIdFromData,
      customerAdvancePct,
      supplierAdvancePct,
      customerOnDelivery,
      customerPaysSupplier,
      supplierPaysSupplier,
      customerPodBalance,
      supplierPodBalance,
      invoiceTo,
      payTo,
      accountNo,
      podType,
      tripKm,
      bookingType,
    } = data;

    // Verify customer exists
    let customer;
    if (customerId && mongoose.isValidObjectId(customerId)) {
      customer = await Customer.findOne({ _id: customerId, isDeleted: false });
    } else {
      customer = await Customer.findOne({ user: userId, isDeleted: false });
    }

    if (!customer) {
      throw new ApiError(404, 'Customer profile not found');
    }

    // Check credit limit if applicable
    if (customer.creditLimit > 0 && customer.outstandingAmount >= customer.creditLimit) {
      throw new ApiError(400, 'Credit limit exceeded. Please clear dues.');
    }

    // Validate truckType against master data
    const validTruckType = await MasterData.findOne({
      category: 'truck-type',
      key: truckType,
      isActive: true,
      isDeleted: false
    });
    if (!validTruckType) {
      throw new ApiError(400, `Invalid truck type: '${truckType}'. Use a valid truck type from master data.`);
    }

    // Geocode Pickup
    let finalPickupLat = pickupLat;
    let finalPickupLng = pickupLng;
    let finalPickupAddress = pickupAddress;
    let pickupPlaceId = null;

    if (!pickupLat || !pickupLng) {
      const geocoded = await LocationService.geocodeAddress(`${pickupAddress}, ${pickupCity}`);
      if (geocoded) {
        finalPickupLat = geocoded.latitude;
        finalPickupLng = geocoded.longitude;
        finalPickupAddress = geocoded.formattedAddress;
        pickupPlaceId = geocoded.placeId;
      }
      // If geocoding unavailable, continue without coordinates
    } else {
      const reversed = await LocationService.reverseGeocode(pickupLat, pickupLng);
      if (reversed) {
        pickupPlaceId = reversed.placeId;
        if (!pickupAddress) finalPickupAddress = reversed.formattedAddress;
      }
    }

    // Geocode Drop
    let finalDropLat = dropLat;
    let finalDropLng = dropLng;
    let finalDropAddress = dropAddress;
    let dropPlaceId = null;

    if (!dropLat || !dropLng) {
      const geocoded = await LocationService.geocodeAddress(`${dropAddress}, ${dropCity}`);
      if (geocoded) {
        finalDropLat = geocoded.latitude;
        finalDropLng = geocoded.longitude;
        finalDropAddress = geocoded.formattedAddress;
        dropPlaceId = geocoded.placeId;
      }
      // If geocoding unavailable, continue without coordinates
    } else {
      const reversed = await LocationService.reverseGeocode(dropLat, dropLng);
      if (reversed) {
        dropPlaceId = reversed.placeId;
        if (!dropAddress) finalDropAddress = reversed.formattedAddress;
      }
    }

    const loadDateObj = loadDate ? new Date(loadDate) : null;

    // Create booking + update customer metrics in a transaction
    const session = await mongoose.startSession();
    let booking;
    try {
      await session.withTransaction(async () => {
        // bookingId is generated atomically by the model's pre-save hook
        const [created] = await Booking.create([{
          customer: customer._id,
          pickup: {
            city: pickupCity,
            state: pickupState,
            address: finalPickupAddress,
            location: {
              type: 'Point',
              coordinates: [finalPickupLng, finalPickupLat]
            },
            placeId: pickupPlaceId,
            contactPerson: {
              name: pickupContactName,
              phone: pickupContactPhone
            }
          },
          drop: {
            city: dropCity,
            state: dropState,
            address: finalDropAddress,
            location: {
              type: 'Point',
              coordinates: [finalDropLng, finalDropLat]
            },
            placeId: dropPlaceId,
            contactPerson: {
              name: dropContactName,
              phone: dropContactPhone
            }
          },
          materialType,
          weight: {
            value: weight,
            unit: weightUnit || 'tons'
          },
          truckTypeNeeded: truckType,
          bodyType: bodyType || 'open',
          ...(loadDateObj && {
            loadDate: loadDateObj,
            loadTime: loadDateObj.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          }),
          ...(expectedDeliveryDate && { expectedDeliveryDate: new Date(expectedDeliveryDate) }),
          advanceRequired,
          additionalInstructions,
          expectedAmount,
          isHazardous: isHazardous || false,
          isFragile: isFragile || false,
          requiresTemperatureControl: requiresTemperatureControl || false,
          priority: priority || 'medium',
          numberOfTrucks: numberOfTrucks || 1,
          // Digitify / indent fields
          laneCode: laneCode || undefined,
          sourceCode: sourceCode || undefined,
          destinationCode: destinationCode || undefined,
          supplier: supplier || undefined,
          indentType: indentType || null,
          exim: exim || 'domestic',
          trafficController: trafficController || undefined,
          supplierPrice: supplierPrice || 0,
          customerPrice: customerPrice || expectedAmount || 0,
          ratePerTon: ratePerTon || false,
          expiryTime: expiryTime ? new Date(expiryTime) : undefined,
          postToSupplier: postToSupplier !== false,
          remarks: remarks || undefined,
          createdByStaff: userId,
          // Direct Load / Direct Invoice fields
          customerAdvancePct: customerAdvancePct || 0,
          supplierAdvancePct: supplierAdvancePct || 0,
          customerOnDelivery: customerOnDelivery || 0,
          customerPaysSupplier: customerPaysSupplier || 0,
          supplierPaysSupplier: supplierPaysSupplier || 0,
          customerPodBalance: customerPodBalance || 0,
          supplierPodBalance: supplierPodBalance || 0,
          invoiceTo: invoiceTo || undefined,
          payTo: payTo || undefined,
          accountNo: accountNo || undefined,
          podType: podType || undefined,
          tripKm: tripKm || undefined,
          bookingType: bookingType || 'indent',
          status: 'created',
          statusHistory: [
            {
              status: 'created',
              updatedBy: userId,
              timestamp: new Date()
            }
          ]
        }], { session });

        booking = created;
        booking.calculateDistance();

        // Update customer metrics atomically
        customer.businessMetrics.totalBookings += 1;
        await customer.save({ session });
        await booking.save({ session });
      });
    } finally {
      await session.endSession();
    }

    // Auto-assign vehicle and driver if provided (Direct Load / Direct Invoice)
    if (vehicleId && mongoose.isValidObjectId(vehicleId)) {
      try {
        const vehicle = await Vehicle.findById(vehicleId);
        if (vehicle) {
          booking.vehicle = vehicle._id;
          // If driverId not provided, try to find driver from vehicle's owner
          let resolvedDriverId = driverIdFromData;
          if (!resolvedDriverId && vehicle.driver) resolvedDriverId = vehicle.driver;
          if (resolvedDriverId && mongoose.isValidObjectId(resolvedDriverId)) {
            const driver = await Driver.findById(resolvedDriverId);
            if (driver) {
              booking.driver = driver._id;
              booking.status = 'assigned';
              booking.statusHistory.push({ status: 'assigned', updatedBy: userId, timestamp: new Date() });
              // Update driver availability
              driver.currentBooking = booking._id;
              driver.status = 'on-trip';
              await driver.save();
              // Update vehicle
              vehicle.status = 'assigned';
              await vehicle.save();
            }
          }
          await booking.save();
        }
      } catch (assignErr) {
        // Non-fatal: booking created, assignment just failed silently
        logger.error('Direct load auto-assign failed:', assignErr);
      }
    }

    // Attach uploaded cargo images (if any) — outside transaction, non-critical
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
            }, customer._id);
            uploadedDocs.push(doc);
            booking.cargoDocuments = booking.cargoDocuments || [];
            booking.cargoDocuments.push(doc._id);
          } catch (err) {
            logger.error('Failed to upload cargo image during booking creation:', err);
          }
        }
        if (uploadedDocs.length) {
          await booking.save();
        }
      }
    }

    // Send notifications — fire-and-forget, don't block API response
    const bookingId = booking.bookingId;

    NotificationService.sendNotification({
      recipient: customer._id,
      type: 'booking_created',
      title: 'Booking Created',
      message: `Your booking ${bookingId} has been created successfully`,
      entityType: 'booking',
      entityId: booking._id,
      channels: ['push', 'in-app']
    }).catch(err => logger.error('Failed to send booking created notification:', err));

    // Notify staff in parallel
    Staff.find({ isActive: true, department: 'operations' }).then(staffUsers => {
      Promise.allSettled(
        staffUsers.map(staff =>
          NotificationService.sendNotification({
            recipient: staff.user,
            type: 'new_booking_request',
            title: 'New Booking Request',
            message: `New booking ${bookingId} from ${pickupCity} to ${dropCity}`,
            entityType: 'booking',
            entityId: booking._id,
            channels: ['in-app']
          })
        )
      ).catch(err => logger.error('Failed to send staff notifications:', err));
    }).catch(err => logger.error('Failed to fetch staff for notifications:', err));

    // Audit log — fire-and-forget
    AuditLog.create({
      user: userId,
      action: 'CREATE_BOOKING',
      entityType: 'booking',
      entityId: booking._id,
      changes: {
        before: null,
        after: booking.toObject()
      }
    }).catch(err => logger.error('Failed to create audit log for booking:', err));

    return booking;
  }

  /**
   * Get bookings with filters and pagination
   * @param {Object} filters - Query filters
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Bookings with pagination
   */
  static async getBookings(filters = {}, pagination = {}, options = {}) {
    const {
      customerId,
      driverId,
      driverUnassigned,
      status,
      paymentStatus,
      startDate,
      endDate,
      truckType,
      podPending,
      lrPending,
      city,
      search
    } = filters;

    const { maskCustomer = false } = options;

    const query = { isDeleted: false };

    if (customerId) query.customer = customerId;
    if (driverId) query.driver = driverId;
    if (driverUnassigned === true) query.driver = null;
    if (status) {
      if (Array.isArray(status)) {
        query.status = { $in: status };
      } else {
        query.status = status;
      }
    }
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (truckType) {
      const normalize = t => (t && typeof t === 'object' ? t.key : t);
      const typeArray = Array.isArray(truckType) ? truckType.map(normalize) : [normalize(truckType)];
      query.truckTypeNeeded = { $in: typeArray };
    }
    if (podPending === true) {
      query.status = query.status || { $in: ['delivered'] };
      query.$or = [
        { podDocuments: { $exists: false } },
        { podDocuments: { $size: 0 } }
      ];
    } else if (podPending === false) {
      query.podDocuments = { $exists: true, $not: { $size: 0 } };
    }
    if (lrPending === true) {
      if (!query.status) {
        query.status = { $in: ['assigned', 'driver-en-route', 'reached-pickup', 'loaded', 'in-transit', 'reached-destination'] };
      }
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { 'lrDetails.uploadedAt': { $exists: false } },
          { 'lrDetails.uploadedAt': null },
        ]
      });
    }
    if (startDate || endDate) {
      query.loadDate = {};
      if (startDate) query.loadDate.$gte = new Date(startDate);
      if (endDate) query.loadDate.$lte = new Date(endDate);
    }
    if (city) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { 'pickup.city': new RegExp(city, 'i') },
          { 'drop.city': new RegExp(city, 'i') }
        ]
      });
    }

    if (search) {
      // Find customers matching search to include in booking search
      const matchingCustomers = await Customer.find({
        companyName: new RegExp(search, 'i')
      }).select('_id');
      const customerIds = matchingCustomers.map((c) => c._id);

      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { bookingId: new RegExp(search, 'i') },
          { materialType: new RegExp(search, 'i') },
          { customer: { $in: customerIds } }
        ]
      });
    }

    const customerSelect = maskCustomer ? 'companyName' : 'companyName phone email';

    const result = await Booking.paginate(query, {
      page: pagination.page || 1,
      limit: pagination.limit || 20,
      sort: pagination.sort || { createdAt: -1 },
      populate: [
        { path: 'customer', select: customerSelect },
        { path: 'driver', select: 'name phone' },
        { path: 'vehicle', select: 'vehicleNumber truckType availability verificationStatus' },
        {
          path: 'assignedBy',
          select: 'name department',
          populate: { path: 'user', select: 'phone' }
        },
        { path: 'supervisor', select: 'name department', populate: { path: 'user', select: 'phone' } },
        { path: 'trafficController', select: 'name department', populate: { path: 'user', select: 'phone' } },
      ]
    });

    // Enrich createdByStaff name (still a User ref on booking)
    const docs = result.docs || [];
    if (docs.length) {
      const userIds = new Set();
      for (const b of docs) {
        if (b.createdByStaff) userIds.add(b.createdByStaff.toString());
      }
      if (userIds.size) {
        const ids = [...userIds];
        const staffList = await Staff.find({ user: { $in: ids }, isDeleted: false }).select('user name').lean();
        const staffByUser = {};
        for (const s of staffList) staffByUser[s.user.toString()] = s.name;
        result.docs = docs.map(b => {
          const plain = b.toObject ? b.toObject() : { ...b };
          if (plain.createdByStaff) {
            const uid = plain.createdByStaff.toString();
            plain.createdByStaff = { _id: plain.createdByStaff, name: staffByUser[uid] || null };
          }
          return plain;
        });
      }
    }

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
      .populate('vehicle', 'vehicleNumber truckType capacity availability verificationStatus currentBooking expiryDates')
      .populate({
        path: 'assignedBy',
        select: 'name department',
        populate: { path: 'user', select: 'phone' }
      })
      .populate('payments')
      .populate({ path: 'supervisor', select: 'name department', populate: { path: 'user', select: 'phone' } })
      .populate({ path: 'trafficController', select: 'name department', populate: { path: 'user', select: 'phone' } })
      .populate({ path: 'lrDetails.documents', select: 'url fileType originalName' })
      .populate({ path: 'lrDetails.uploadedBy', select: 'name' })
      .populate({ path: 'podDetails.receiverSignatureDocument', select: 'url fileType' })
      .populate({ path: 'loadingDocuments', select: 'url fileType originalName' })
      .populate({ path: 'otherDocuments', select: 'url fileType originalName' });

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
      assigned: ['driver-en-route', 'cancelled'],
      'driver-en-route': ['reached-pickup'],
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

    if (newStatus === 'loaded') {
      booking.actualLoadTime = new Date();
    } else if (newStatus === 'delivered') {
      booking.actualDeliveryTime = new Date();

      // Update metrics for driver, vehicle and customer
      if (booking.driver) {
        await Driver.findByIdAndUpdate(booking.driver, {
          $inc: { 
            totalTrips: 1, 
            'performance.completedTrips': 1 
          }
        });
      }
      if (booking.vehicle) {
        await Vehicle.findByIdAndUpdate(booking.vehicle, {
          $inc: { 
            'stats.totalTrips': 1, 
            'stats.completedTrips': 1 
          }
        });
      }
      if (booking.customer) {
        await Customer.findByIdAndUpdate(booking.customer, {
          $inc: { 'businessMetrics.completedBookings': 1 }
        });
      }
    } else if (newStatus === 'cancelled') {
      if (booking.customer) {
        await Customer.findByIdAndUpdate(booking.customer, {
          $inc: { 'businessMetrics.cancelledBookings': 1 }
        });
      }
    }

    // Update driver and vehicle availability based on status
    const onTripStatuses = ['driver-en-route', 'reached-pickup', 'loaded', 'in-transit'];
    const availableStatuses = ['reached-destination', 'delivered', 'pod-received'];

    if (onTripStatuses.includes(newStatus)) {
      if (booking.driver) {
        await Driver.findByIdAndUpdate(booking.driver, { availability: 'on-trip' });
      }
      if (booking.vehicle) {
        await Vehicle.findByIdAndUpdate(booking.vehicle, { availability: 'on-trip' });
      }
    } else if (availableStatuses.includes(newStatus)) {
      if (booking.driver) {
        const driver = await Driver.findById(booking.driver);
        if (driver) {
          // Reset availability — booking has reached a terminal/available state.
          // Don't guard on currentBooking match; seeded/legacy drivers may not have it set.
          if (!driver.nextBooking) {
            driver.availability = 'available';
            driver.currentBooking = null;
          }

          // Update last known location to destination on reached-destination
          if (newStatus === 'reached-destination' && booking.drop && booking.drop.location) {
            driver.lastKnownLocation = booking.drop.location;
            driver.lastLocationAt = new Date();
          }
          await driver.save();

          if (newStatus === 'reached-destination') {
            // Send notification to driver about availability
            await NotificationService.sendNotification({
              recipient: driver.user,
              type: 'driver_available_for_return',
              title: 'You are now available',
              message: `You have reached destination for ${booking.bookingId} and are available for new bookings from this location.`,
              entityType: 'driver',
              entityId: driver._id,
              channels: ['push', 'in-app']
            });
          }
        }
      }
      if (booking.vehicle) {
        await Vehicle.findByIdAndUpdate(booking.vehicle, { availability: 'available' });
      }
    } else if (newStatus === 'closed') {
      // Final release or promotion of next booking
      if (booking.driver) {
        const driver = await Driver.findById(booking.driver);
        if (driver) {
          // Only promote/clear if the booking being closed IS the current one
          if (driver.currentBooking?.toString() === booking._id.toString()) {
            if (driver.nextBooking) {
              driver.currentBooking = driver.nextBooking;
              driver.nextBooking = null;
              driver.availability = 'on-trip';
              
              // Notify driver that next booking is now active
              try {
                await NotificationService.sendNotification({
                  recipient: driver.user,
                  type: 'next_booking_active',
                  title: 'Next Trip Active',
                  message: 'Your next assigned trip is now active.',
                  entityType: 'booking',
                  entityId: driver.currentBooking,
                  channels: ['push', 'in-app']
                });
              } catch (notifyError) {
                console.error('Failed to send notification to driver:', notifyError);
              }
            } else {
              driver.currentBooking = null;
              driver.availability = 'available';
            }
          } else if (driver.nextBooking?.toString() === booking._id.toString()) {
            // If we closed the next booking instead (e.g. cancelled/closed by mistake), just clear it
            driver.nextBooking = null;
          }
          await driver.save();
        }
      }
      if (booking.vehicle) {
        const vehicle = await Vehicle.findById(booking.vehicle);
        if (vehicle) {
          if (vehicle.currentBooking?.toString() === booking._id.toString()) {
            if (vehicle.nextBooking) {
              vehicle.currentBooking = vehicle.nextBooking;
              vehicle.nextBooking = null;
              vehicle.availability = 'on-trip';
            } else {
              vehicle.currentBooking = null;
              vehicle.availability = 'available';
            }
          } else if (vehicle.nextBooking?.toString() === booking._id.toString()) {
            vehicle.nextBooking = null;
          }
          await vehicle.save();
        }
      }
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
   * Update booking details (limited fields)
   * @param {string} bookingId - Booking ID
   * @param {Object} updateData - Fields to update
   * @param {string} userId - User ID performing update
   * @returns {Promise<Object>} Updated booking
   */
  static async updateBooking(bookingId, updateData, userId) {
    const booking = await Booking.findOne({
      $or: [{ _id: bookingId }, { bookingId }],
      isDeleted: false
    });

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Only allow updates for non-terminal statuses
    if (['delivered', 'pod-received', 'cancelled', 'closed'].includes(booking.status)) {
      throw new ApiError(400, 'Cannot update booking in its current status');
    }

    // Store old values for audit
    const oldValues = {};

    // Define allowed fields for update
    const allowedFields = [
      'pickupCity', 'pickupState', 'pickupLat', 'pickupLng', 'pickupAddress',
      'pickupContactName', 'pickupContactPhone',
      'dropCity', 'dropState', 'dropLat', 'dropLng', 'dropAddress',
      'dropContactName', 'dropContactPhone',
      'materialType', 'weight', 'truckType', 'bodyType', 'expectedDeliveryDate',
      'additionalInstructions', 'isHazardous', 'isFragile', 'requiresTemperatureControl',
      // Indent-specific fields
      'trafficController', 'numberOfTrucks', 'customerPrice', 'supplierPrice',
      'truckTypeNeeded', 'expiryTime', 'postToSupplier', 'supervisor',
      'laneCode', 'indentType', 'remarks',
    ];

    // Update only allowed fields
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        oldValues[field] = booking[field];
        
        // Handle mapped fields for contactPerson
        if (field === 'pickupContactName') {
          booking.pickup.contactPerson.name = updateData[field];
        } else if (field === 'pickupContactPhone') {
          booking.pickup.contactPerson.phone = updateData[field];
        } else if (field === 'dropContactName') {
          booking.drop.contactPerson.name = updateData[field];
        } else if (field === 'dropContactPhone') {
          booking.drop.contactPerson.phone = updateData[field];
        } else if (field === 'weight') {
          // weight may arrive as a number (validator coerces it) — preserve unit
          const incoming = updateData[field];
          if (typeof incoming === 'number') {
            booking.weight = { value: incoming, unit: booking.weight?.unit || 'tons' };
          } else if (incoming && typeof incoming === 'object') {
            booking.weight = incoming;
          }
        } else {
          booking[field] = updateData[field];
        }
      }
    });

    // Recalculate distance if coordinates changed
    if (updateData.pickupLat || updateData.pickupLng || updateData.dropLat || updateData.dropLng) {
      booking.calculateDistance();
    }

    booking.updatedBy = userId;
    await booking.save();

    // Audit log
    await AuditLog.create({
      user: userId,
      action: 'UPDATE_BOOKING_DETAILS',
      entityType: 'booking',
      entityId: booking._id,
      changes: {
        before: oldValues,
        after: updateData
      }
    });

    return booking;
  }

  /**
   * Assign driver and vehicle to booking
   * @param {string} bookingId - Booking ID
   * @param {string} driverId - Driver ID
   * @param {string} vehicleId - Vehicle ID
   * @param {string} userId - User ID (Staff member)
   * @returns {Promise<Object>} Updated booking
   */
  static async assignDriver(bookingId, driverId, vehicleId, userId) {
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

    // Find staff profile
    const staff = await Staff.findOne({ user: userId });
    if (!staff) {
      throw new ApiError(403, 'Only staff members can assign drivers');
    }

    // Verify driver exists and is available
    const driver = await Driver.findById(driverId);
    if (!driver || driver.isDeleted) {
      throw new ApiError(404, 'Driver not found');
    }
    
    if (driver.availability === 'offline') {
      throw new ApiError(400, 'Driver is offline');
    }
    
    // Allow assignment if they have at least one slot empty (current or next)
    if (driver.currentBooking && driver.nextBooking) {
      throw new ApiError(400, 'Driver is already fully booked with current and next assignments');
    }

    if (driver.isBlacklisted) {
      throw new ApiError(400, 'Driver is blacklisted');
    }

    // Verify vehicle exists and is available
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle || vehicle.isDeleted) {
      throw new ApiError(404, 'Vehicle not found');
    }
    
    if (vehicle.availability === 'offline') {
      throw new ApiError(400, 'Vehicle is offline');
    }
    
    if (vehicle.currentBooking && vehicle.nextBooking) {
      throw new ApiError(400, 'Vehicle already has both current and next bookings assigned');
    }

    if (vehicle.verificationStatus !== 'verified') {
      throw new ApiError(400, 'Vehicle is not verified');
    }

    // Verify vehicle matches booking requirements
    if (vehicle.truckType !== booking.truckTypeNeeded) {
      throw new ApiError(400, 'Vehicle type does not match booking requirements');
    }

    // Save booking first, then update driver & vehicle. If any step fails, rollback booking to previous state.
    const oldBookingState = {
      driver: booking.driver,
      vehicle: booking.vehicle,
      status: booking.status,
      assignedBy: booking.assignedBy,
      assignedAt: booking.assignedAt
    };

    try {
      // Update booking
      booking.driver = driverId;
      booking.vehicle = vehicleId;
      booking.assignedBy = staff._id;
      booking.assignedAt = new Date();
      booking.status = 'assigned';
      booking.statusHistory.push({
        status: 'assigned',
        updatedBy: userId,
        timestamp: new Date(),
        note: `Assigned driver ${driver.name} with vehicle ${vehicle.vehicleNumber}`
      });

      await booking.save();

      // Update driver assignment
      if (driver.currentBooking) {
        driver.nextBooking = booking._id;
        // Keep status as available since they are still on current booking at destination
      } else {
        driver.currentBooking = booking._id;
        driver.availability = 'on-trip';
      }
      await driver.save();

      // Update vehicle assignment
      if (vehicle.currentBooking) {
        vehicle.nextBooking = booking._id;
      } else {
        vehicle.currentBooking = booking._id;
        vehicle.availability = 'on-trip';
      }
      await vehicle.save();

      // Update staff metrics
      staff.performance.bookingsAssigned += 1;
      staff.assignedBookings.push(booking._id);
      await staff.save();

      // Check if booking has linked E-way bill and auto-sync Part-B
      try {
        const linkedEwayBill = await EwayBill.findOne({
          bookingId: booking._id,
          isDeleted: false,
          status: { $in: ['draft', 'active'] }
        });

        if (linkedEwayBill) {
          logger.info(`Auto-syncing Part-B for E-way bill ${linkedEwayBill.ewayBillNumber} with vehicle ${vehicle.vehicleNumber}`);
          
          // Get transporter ID if staff has it in metadata
          const transporterId = staff.metadata?.transporterId || null;
          
          await EwayBillService.autoSyncPartB(
            linkedEwayBill._id,
            vehicle.vehicleNumber,
            transporterId
          );
          
          logger.info(`Part-B auto-synced successfully for E-way bill ${linkedEwayBill.ewayBillNumber}`);
        }
      } catch (ewayBillError) {
        // Log error but don't fail the assignment
        logger.error(`Error auto-syncing E-way bill Part-B for booking ${booking.bookingId}:`, ewayBillError.message);
        // Continue with the assignment even if E-way bill sync fails
      }

      // Audit log
      await AuditLog.create({
        user: userId,
        action: 'ASSIGN_DRIVER',
        entityType: 'booking',
        entityId: booking._id,
        changes: {
          before: { driver: null, vehicle: null, status: 'assigned' },
          after: { driver: driverId, vehicle: vehicleId }
        }
      });

    } catch (err) {
      // Rollback booking if something fails after booking was saved
      booking.driver = oldBookingState.driver;
      booking.vehicle = oldBookingState.vehicle;
      booking.status = oldBookingState.status;
      booking.assignedBy = oldBookingState.assignedBy;
      booking.assignedAt = oldBookingState.assignedAt;
      await booking.save().catch(() => {}); // best-effort rollback
      throw err;
    }

    // Send notifications (outside of critical section)
    await NotificationService.sendNotification({
      recipient: driver.user,
      type: 'booking_assigned',
      title: 'New Booking Assigned',
      message: `You have been assigned booking ${booking.bookingId}`,
      entityType: 'booking',
      entityId: booking._id,
      channels: ['push', 'in-app']
    });

    await NotificationService.sendNotification({
      recipient: booking.customer,
      type: 'driver_assigned',
      title: 'Driver Assigned',
      message: `Driver ${driver.name} has been assigned to your booking`,
      entityType: 'booking',
      entityId: booking._id,
      channels: ['push', 'sms', 'in-app']
    });

    return booking.populate([
      { path: 'driver', select: 'name phone' },
      { path: 'vehicle', select: 'vehicleNumber truckType' }
    ]);
  }

  /**
   * Return recent booking related activities based on AuditLog
   * @param {Object} opts - { limit }
   */
  static async getDashboardActivities(opts = {}) {
    const { limit = 20 } = opts;
    // Relevant actions mapping
    const ACTIONS = [
      'CREATE_BOOKING',
      'ASSIGN_DRIVER',
      'UPDATE_BOOKING_STATUS',
      'UPLOAD_DOCUMENT',
      'MARK_PAYMENT_RECEIVED',
      'CREATE_PAYMENT',
      'UPDATE_PAYMENT'
    ];

    const logs = await AuditLog.find({ entityType: 'booking', action: { $in: ACTIONS } })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    // Map audit log to activity shape expected by frontend
    const activities = logs.map((l) => {
      let type = 'status_update';
      if (l.action === 'CREATE_BOOKING') type = 'booking_created';
      else if (l.action === 'ASSIGN_DRIVER') type = 'driver_assigned';
      else if (l.action === 'UPLOAD_DOCUMENT' && l.context && /pod/i.test(l.context.description || '')) type = 'pod_uploaded';
      else if (l.action === 'MARK_PAYMENT_RECEIVED' || l.action === 'CREATE_PAYMENT') type = 'payment_received';

      return {
        _id: l._id,
        type,
        message: l.context?.description || `${l.action} on booking`,
        bookingId: l.entityId,
        timestamp: l.timestamp,
        metadata: l.context || {}
      };
    });

    return activities;
  }

  /**
   * Booking trends over last N days
   * @param {Object} opts - { days }
   */
  static async getBookingTrends(opts = {}) {
    const { days = 7 } = opts;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    // Bookings created per day
    const created = await Booking.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, isDeleted: false } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          bookings: { $sum: 1 }
        }
      }
    ]);

    // Bookings delivered per day (use podDetails.deliveredAt when available)
    const delivered = await Booking.aggregate([
      { $match: { 'podDetails.deliveredAt': { $exists: true, $ne: null }, isDeleted: false } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$podDetails.deliveredAt' } },
          delivered: { $sum: 1 }
        }
      }
    ]);

    // Build day map
    const dayMap = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = { date: d.toDateString().slice(0, 3), bookings: 0, delivered: 0 };
    }

    created.forEach((c) => {
      if (dayMap[c._id]) dayMap[c._id].bookings = c.bookings;
    });

    delivered.forEach((d) => {
      if (dayMap[d._id]) dayMap[d._id].delivered = d.delivered;
    });

    return Object.values(dayMap);
  }

  /**
   * Status breakdown counts
   */
  static async getStatusBreakdown() {
    const agg = await Booking.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {};
    agg.forEach((r) => {
      result[r._id] = r.count;
    });

    return result;
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
        let wasModified = false;
        
        if (driver.currentBooking?.toString() === booking._id.toString()) {
          if (driver.nextBooking) {
            driver.currentBooking = driver.nextBooking;
            driver.nextBooking = null;
          } else {
            driver.currentBooking = null;
          }
          wasModified = true;
        } else if (driver.nextBooking?.toString() === booking._id.toString()) {
          driver.nextBooking = null;
          wasModified = true;
        }

        // Only update availability if we actually changed their booking status
        // and they don't have an active trip remaining.
        if (wasModified) {
          if (!driver.currentBooking) {
            driver.availability = 'available';
          } else {
            // They still have a booking. If they were on-trip, they stay on-trip.
            // If they were at destination, they are available.
            // For safety, if they have a current booking, check its status?
            // Actually, keep current availability unless it's null.
            if (driver.availability === null) {
              driver.availability = 'available';
            }
          }
          await driver.save();
        }
      }
    }

    // Release vehicle if assigned
    if (booking.vehicle) {
      const vehicle = await Vehicle.findById(booking.vehicle);
      if (vehicle) {
        if (vehicle.currentBooking?.toString() === booking._id.toString()) {
          if (vehicle.nextBooking) {
            vehicle.currentBooking = vehicle.nextBooking;
            vehicle.nextBooking = null;
          } else {
            vehicle.currentBooking = null;
          }
        } else if (vehicle.nextBooking?.toString() === booking._id.toString()) {
          vehicle.nextBooking = null;
        }
        vehicle.availability = 'available';
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

    // Also compute period-over-period percent changes (compare to previous period of same length)
    // Determine current period start/end
    const currentStart = startDate ? new Date(startDate) : (function(){ const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); return d; })();
    const currentEnd = endDate ? new Date(endDate) : (function(){ const d = new Date(); d.setHours(23,59,59,999); return d; })();

    const periodMs = currentEnd.getTime() - currentStart.getTime() + 1;
    const prevEnd = new Date(currentStart.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - (periodMs - 1));

    const prevMatchStage = { isDeleted: false };
    if (customerId) prevMatchStage.customer = new mongoose.Types.ObjectId(customerId);
    prevMatchStage.createdAt = { $gte: prevStart, $lte: prevEnd };

    const prevStatsAgg = await Booking.aggregate([
      { $match: prevMatchStage },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalBookings: { $sum: 1 }
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

    const prevTotals = (prevStatsAgg[0] && prevStatsAgg[0].totals[0]) || { totalBookings: 0 };
    const prevStatusArray = (prevStatsAgg[0] && prevStatsAgg[0].statusBreakdown) || [];
    const prevStatusBreakdown = prevStatusArray.reduce((acc, curr) => { acc[curr._id] = curr.count; return acc; }, {});

    const computeChange = (curr, prev) => {
      if (!prev && !curr) return { value: 0, isPositive: false };
      if (!prev && curr) return { value: 100, isPositive: true };
      const diff = curr - prev;
      const pct = Math.round((diff / prev) * 100);
      return { value: pct, isPositive: pct >= 0 };
    };

    const currentNewRequests = (statusBreakdown['created'] || 0) + (statusBreakdown['under-review'] || 0);
    const prevNewRequests = (prevStatusBreakdown['created'] || 0) + (prevStatusBreakdown['under-review'] || 0);

    const result = {
      total: totals.totalBookings,
      totalRevenue: totals.totalRevenue,
      newRequests: currentNewRequests,
      assigned: statusBreakdown['assigned'] || 0,
      inTransit: statusBreakdown['in-transit'] || 0,
      delivered: statusBreakdown['delivered'] || 0,
      podPending: statusBreakdown['pod-received'] || 0,
      cancelled: statusBreakdown['cancelled'] || 0,
      statusBreakdown,

      // Changes
      newRequestsChange: computeChange(currentNewRequests, prevNewRequests),
      assignedChange: computeChange(statusBreakdown['assigned'] || 0, prevStatusBreakdown['assigned'] || 0),
      inTransitChange: computeChange(statusBreakdown['in-transit'] || 0, prevStatusBreakdown['in-transit'] || 0),
      deliveredChange: computeChange(statusBreakdown['delivered'] || 0, prevStatusBreakdown['delivered'] || 0),
      podPendingChange: computeChange(statusBreakdown['pod-received'] || 0, prevStatusBreakdown['pod-received'] || 0)
    };

    return result;
  }

  /**
   * Get available (unassigned) loads for drivers (Fix 6)
   * @param {Object} filters - city, truckType, page, limit
   * @param {string} driverId - (Optional) Current driver profile ID for pre-filtering compatible loads
   * @returns {Promise<Object>} Paginated result
   */
  static async getAvailableLoads({ city, pickupCity, dropCity, truckType, latitude, longitude, radius, loadDate, driverId, page = 1, limit = 20 }) {
    const query = {
      isDeleted: false,
      status: { $in: ['created', 'under-review'] },
      driver: null
    };

    if (city) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { 'pickup.city': new RegExp(city, 'i') },
          { 'drop.city': new RegExp(city, 'i') }
        ]
      });
    }

    if (pickupCity) {
      query['pickup.city'] = new RegExp(pickupCity, 'i');
    }

    if (dropCity) {
      query['drop.city'] = new RegExp(dropCity, 'i');
    }

    if (truckType) {
      const normalize = t => (t && typeof t === 'object' ? t.key : t);
      const typeArray = Array.isArray(truckType) ? truckType.map(normalize) : [normalize(truckType)];
      query.truckTypeNeeded = { $in: typeArray };
    }

    if (loadDate) {
      const startOfDay = new Date(loadDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(loadDate);
      endOfDay.setHours(23, 59, 59, 999);
      query.loadDate = { $gte: startOfDay, $lte: endOfDay };
    }

    // Location-based search (within radius of pickup)
    // Use $geoWithin/$centerSphere instead of $near — compatible with sort + pagination
    if (latitude && longitude) {
      const rad = parseFloat(radius) || 50; // default 50km
      const earthRadiusKm = 6371;
      query['pickup.location'] = {
        $geoWithin: {
          $centerSphere: [
            [parseFloat(longitude), parseFloat(latitude)],
            rad / earthRadiusKm
          ]
        }
      };
    }

    // If driverId provided and no explicit truckType filter, restrict to driver's verified fleet
    if (driverId && !truckType) {
      const vehicles = await Vehicle.find({ owner: driverId, isDeleted: false, verificationStatus: 'verified' }).select('truckType').lean();
      if (vehicles.length > 0) {
        const myTruckTypes = [...new Set(vehicles.map(v => v.truckType))];
        query.truckTypeNeeded = { $in: myTruckTypes };
      } else {
        return { data: [], pagination: { page: parseInt(page), limit: parseInt(limit), total: 0, pages: 0 } };
      }
    }

    const result = await Booking.paginate(query, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      sort: { createdAt: -1 },
      populate: [
        { path: 'customer', select: 'companyName' },
        { path: 'driver', select: 'name phone' },
        { path: 'vehicle', select: 'vehicleNumber truckType' }
      ]
    });

    return result;
  }

  /**
   * Express driver interest in an available load (Fix 7)
   * @param {string} bookingId - Booking ID
   * @param {string} driverId - Driver profile ID
   * @returns {Promise<Object>} Updated booking
   */
  static async expressInterest(bookingId, driverId) {
    const driver = await Driver.findById(driverId);
    if (!driver || !driver.isVerified) {
      throw new ApiError(403, 'Your profile must be verified by an admin before you can express interest');
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');

    if (!['created', 'under-review'].includes(booking.status)) {
      throw new ApiError(400, 'This load is no longer available');
    }

    // Check if driver has a verified vehicle matching the load's truckType
    const matchingVehicles = await Vehicle.find({
      owner: driverId,
      truckType: booking.truckTypeNeeded,
      isDeleted: false,
      verificationStatus: 'verified'
    });

    if (matchingVehicles.length === 0) {
      throw new ApiError(400, `You do not have a verified ${booking.truckTypeNeeded} vehicle to carry this load`);
    }

    // Check if all matching vehicles are busy (optional strictness, but let's just check if they have at least one)
    // Even if busy now, they might be free by load date. But if strict, we'd check availability: 'available'.

    // Use .equals() for Mongoose ObjectId comparison
    if (booking.interestedDrivers.some(id => id.equals(driverId))) {
      throw new ApiError(409, 'You have already expressed interest in this load');
    }

    booking.interestedDrivers.push(driverId);
    await booking.save();

    logger.info('Driver expressed interest:', { bookingId, driverId });
    return booking;
  }

  // ── Payment Requests ─────────────────────────────────────────────────────────

  static async requestPayment(bookingId, userId, { amount, note }) {
    const booking = await Booking.findOne({ _id: bookingId, isDeleted: false })
      .populate('driver', 'name user _id');
    if (!booking) throw new ApiError(404, 'Booking not found');

    const driver = await Driver.findOne({ user: userId, isDeleted: false });
    if (!driver || !booking.driver || booking.driver._id.toString() !== driver._id.toString()) {
      throw new ApiError(403, 'Access denied: not your booking');
    }

    if (!['delivered', 'pod-received', 'closed'].includes(booking.status)) {
      throw new ApiError(400, 'Payment can only be requested for completed trips');
    }

    const hasPending = booking.paymentRequests?.some(r => r.status === 'pending');
    if (hasPending) throw new ApiError(409, 'A payment request is already pending for this trip');

    booking.paymentRequests.push({ amount, note, requestedBy: userId });
    await booking.save();

    NotificationService.notifyPayoutRequested(
      { name: booking.driver.name, _id: driver._id },
      amount,
      booking._id
    ).catch(() => {});

    return booking.paymentRequests[booking.paymentRequests.length - 1];
  }

  static async processPaymentRequest(bookingId, requestId, userId, { action, rejectionReason, utrNumber }) {
    const booking = await Booking.findOne({ _id: bookingId, isDeleted: false })
      .populate('driver', 'user name _id');
    if (!booking) throw new ApiError(404, 'Booking not found');

    const request = booking.paymentRequests.id(requestId);
    if (!request) throw new ApiError(404, 'Payment request not found');
    if (request.status !== 'pending') throw new ApiError(400, `Request is already ${request.status}`);

    request.processedAt = new Date();
    request.processedBy = userId;

    if (action === 'pay') {
      request.status = 'paid';
      const { WalletService } = await import('./wallet.service.js');
      const driver = await Driver.findOne({ user: booking.driver.user });
      await WalletService.credit(driver._id, {
        amount: request.amount,
        type: 'balance',
        bookingRef: booking.bookingId,
        note: utrNumber ? `UTR: ${utrNumber}` : 'Payment settled by admin',
        createdBy: userId,
      });
      NotificationService.notifyPayoutProcessed(booking.driver.user, 'approved', request.amount, utrNumber).catch(() => {});
    } else {
      request.status = 'rejected';
      request.rejectionReason = rejectionReason;
      NotificationService.notifyPayoutProcessed(booking.driver.user, 'rejected', request.amount, null, rejectionReason).catch(() => {});
    }

    await booking.save();
    return request;
  }

  static async getAllPaymentRequests(page = 1, limit = 20, status) {
    const match = { isDeleted: false, 'paymentRequests.0': { $exists: true } };

    const bookings = await Booking.find(match)
      .populate('driver', 'name phone')
      .select('bookingId driver paymentRequests pickup drop')
      .sort({ updatedAt: -1 })
      .lean();

    let requests = bookings.flatMap(b =>
      b.paymentRequests
        .filter(r => !status || r.status === status)
        .map(r => ({
          ...r,
          bookingId: b.bookingId,
          bookingObjectId: b._id,
          driver: b.driver,
          pickup: b.pickup?.city,
          drop: b.drop?.city,
        }))
    );

    requests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    const total = requests.length;
    requests = requests.slice((page - 1) * limit, page * limit);

    return {
      requests,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }
}

export default BookingService;
