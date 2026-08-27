import Vehicle from '../models/vehicle.model.js';
import Driver from '../models/driver.model.js';
import Supplier from '../models/supplier.model.js';
import Booking from '../models/booking.model.js';
import AuditLog from '../models/auditLog.model.js';
import ApiError from '../utils/ApiError.js';

/**
 * Vehicle Service
 * Handles fleet vehicle management operations
 */
class VehicleService {
  /**
   * Create vehicle
   * @param {Object} data - Vehicle data
   * @param {string} createdBy - User ID
   * @returns {Promise<Object>} Created vehicle
   */
  static async createVehicle(data, createdBy) {
    const {
      vehicleNumber,
      truckType,
      length,
      capacity,
      bodyType,
      manufacturer,
      model,
      year,
      owner,
      ownerRef: ownerRefInput,
      ownershipType,
      registrationState,
      permitType,
      expiryDates,
      hasGPS,
      hasFASTag
    } = data;

    // Normalize ownerRef — support both legacy `owner` and new `ownerRef`
    const resolvedOwnerRef = ownerRefInput
      ? ownerRefInput
      : owner
        ? { kind: 'Driver', item: owner }
        : null;

    // Owner is required only for market (attached) trucks; own/leased belong to Cloudtruck
    const effectiveOwnershipType = ownershipType || 'own';
    if (!resolvedOwnerRef && effectiveOwnershipType === 'attached') {
      throw new ApiError(400, 'Market trucks require an owner (driver or supplier)');
    }

    // Check if vehicle number already exists
    const existingVehicle = await Vehicle.findOne({
      vehicleNumber: vehicleNumber.toUpperCase(),
      isDeleted: false
    });

    if (existingVehicle) {
      throw new ApiError(400, 'Vehicle number already registered');
    }

    // Verify owner exists (only when ownerRef is provided)
    if (resolvedOwnerRef) {
      if (resolvedOwnerRef.kind === 'Driver') {
        const driver = await Driver.findById(resolvedOwnerRef.item);
        if (!driver || driver.isDeleted) {
          throw new ApiError(404, 'Vehicle owner (driver) not found');
        }
      } else if (resolvedOwnerRef.kind === 'Supplier') {
        const Supplier = (await import('../models/supplier.model.js')).default;
        const supplier = await Supplier.findOne({ _id: resolvedOwnerRef.item, isDeleted: false });
        if (!supplier) throw new ApiError(404, 'Vehicle owner (supplier) not found');
      }
    }

    // Create vehicle
    const vehicle = await Vehicle.create({
      vehicleNumber: vehicleNumber.toUpperCase(),
      truckType,
      length,
      capacity,
      bodyType,
      manufacturer,
      model,
      year,
      ownershipType: effectiveOwnershipType,
      ...(resolvedOwnerRef && {
        ownerRef: resolvedOwnerRef,
        owner: resolvedOwnerRef.kind === 'Driver' ? resolvedOwnerRef.item : undefined,
      }),
      registrationState,
      permitType,
      expiryDates,
      hasGPS,
      hasFASTag,
      availability: 'available',
      createdBy
    });

    // Update driver's vehicle list if Driver-owned
    if (resolvedOwnerRef?.kind === 'Driver') {
      await Driver.findByIdAndUpdate(resolvedOwnerRef.item, {
        $addToSet: { vehicles: vehicle._id }
      });
    }

    // Audit log
    await AuditLog.create({
      user: createdBy,
      action: 'CREATE_VEHICLE',
      entityType: 'vehicle',
      entityId: vehicle._id,
      changes: {
        before: null,
        after: vehicle.toObject()
      }
    });

    return vehicle;
  }

  /**
   * Add a truck via driver self-service
   * @param {string} userId - Authenticated user ID
   * @param {Object} data - Truck data from request body
   * @returns {Promise<Object>} Created vehicle
   */
  /**
   * Derive bodyType from a truckType key (MasterData key format)
   */
  static deriveBodyType(truckTypeKey = '') {
    const key = truckTypeKey.toLowerCase();
    if (key.includes('container')) return 'container';
    if (key.includes('tanker'))    return 'tanker';
    if (key.includes('flatbed'))   return 'flatbed';
    if (key.includes('refrigerated') || key.includes('reefer')) return 'refrigerated';
    return 'open';
  }

  static async addDriverTruck(userId, data) {
    const driver = await Driver.findOne({ user: userId, isDeleted: false });
    if (!driver) {
      throw new ApiError(404, 'Driver profile not found');
    }

    const normalizedNumber = data.truckNumber.replace(/-/g, '').toUpperCase();
    const existingVehicle = await Vehicle.findOne({
      vehicleNumber: normalizedNumber,
      isDeleted: false
    });
    if (existingVehicle) {
      throw new ApiError(400, 'Vehicle with this number already exists');
    }

    const vehicle = await Vehicle.create({
      vehicleNumber: normalizedNumber,
      truckType: data.truckType,
      height: { value: data.truckHeight, unit: 'ft' },
      length: { value: data.truckLength, unit: 'ft' },
      capacity: { value: data.truckCapacity, unit: 'tons' },
      expiryDates: { insurance: new Date(data.insuranceExpiryDate) },
      bodyType: VehicleService.deriveBodyType(data.truckType),
      owner: driver._id,
      ownerRef: { kind: 'Driver', item: driver._id },
      driverPhoneNumber: data.driverPhoneNumber,
      // lastKnownLocation requires valid GeoJSON coordinates — city-only is stripped
      // by the pre-validate hook. City is stored separately in registrationCity.
      registrationCity: data.currentCity,
      availability: 'available',
      createdBy: userId
    });

    await Driver.findByIdAndUpdate(driver._id, {
      $addToSet: { vehicles: vehicle._id }
    });

    await AuditLog.create({
      user: userId,
      action: 'DRIVER_ADD_TRUCK',
      entityType: 'vehicle',
      entityId: vehicle._id,
      changes: {
        before: null,
        after: vehicle.toObject()
      }
    });

    return vehicle;
  }

  /**
   * Get vehicle by ID
   * @param {string} vehicleId - Vehicle ID
   * @returns {Promise<Object>} Vehicle details
   */
  static async getVehicleById(vehicleId) {
    const vehicle = await Vehicle.findOne({ _id: vehicleId, isDeleted: false })
      .populate({ path: 'ownerRef.item', select: 'name phone licenseNumber displayName companyName' })
      .populate('currentDriver', 'name phone')
      .populate('currentBooking', 'bookingId status pickup drop')
      .populate('nextBooking', 'bookingId status pickup drop')
      .populate('documents.rcDocument', 'type status url');

    if (!vehicle) {
      throw new ApiError(404, 'Vehicle not found');
    }

    return vehicle;
  }

  /**
   * Get full vehicle details for a driver viewing their own truck
   * Includes PAN (select: false override) and TDS document from driver profile
   * @param {string} vehicleId - Vehicle ID
   * @param {string} userId - Authenticated user ID
   * @returns {Promise<Object>} Enriched vehicle details
   */
  static async getVehicleDetailsForDriver(vehicleId, userId) {
    const driver = await Driver.findOne({ user: userId, isDeleted: false })
      .select('+pan.number')
      .populate('documents.tdsDocument', 'type status url');

    if (driver) {
      const vehicle = await Vehicle.findOne({ _id: vehicleId, $or: [{ 'ownerRef.item': driver._id }, { owner: driver._id }], isDeleted: false })
        .populate('documents.rcDocument', 'type status url')
        .populate('currentBooking', 'bookingId status')
        .lean();

      if (!vehicle) {
        throw new ApiError(404, 'Vehicle not found');
      }

      return {
        ...vehicle,
        ownerName: driver.name,
        ownerLicenseNumber: driver.licenseNumber,
        ownerLicenseImage: driver.licenseImage,
        ownerPan: driver.pan?.number || null,
        tdsDocument: driver.documents?.tdsDocument || null,
        // Resolved last location: GPS city takes priority, falls back to registrationCity
        resolvedCity: vehicle.lastKnownLocation?.city || vehicle.registrationCity || null,
      };
    }

    const supplier = await Supplier.findOne({ user: userId, isDeleted: false });
    if (supplier) {
      const vehicle = await Vehicle.findOne({
        _id: vehicleId,
        $or: [{ 'ownerRef.item': supplier._id }, { supplierOwner: supplier._id }],
        isDeleted: false,
      })
        .populate('documents.rcDocument', 'type status url')
        .populate('currentBooking', 'bookingId status')
        .lean();

      if (!vehicle) {
        throw new ApiError(404, 'Vehicle not found');
      }

      return {
        ...vehicle,
        ownerName: supplier.displayName || supplier.companyName,
        ownerLicenseNumber: '—',
        ownerLicenseImage: null,
        ownerPan: supplier.panNumber || null,
        tdsDocument: null,
        resolvedCity: vehicle.lastKnownLocation?.city || vehicle.registrationCity || null,
      };
    }

    throw new ApiError(404, 'Profile not found');
  }

  /**
   * Update a truck via driver/supplier self-service
   * @param {string} userId - Authenticated user ID
   * @param {string} vehicleId - Vehicle ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated vehicle
   */
  static async updateMyTruck(userId, vehicleId, data) {
    const driver = await Driver.findOne({ user: userId, isDeleted: false });
    const supplier = !driver ? await Supplier.findOne({ user: userId, isDeleted: false }) : null;

    if (!driver && !supplier) {
      throw new ApiError(404, 'Profile not found');
    }

    const ownerFilter = driver
      ? { $or: [{ 'ownerRef.item': driver._id }, { owner: driver._id }] }
      : { $or: [{ 'ownerRef.item': supplier._id }, { supplierOwner: supplier._id }] };

    const vehicle = await Vehicle.findOne({ _id: vehicleId, ...ownerFilter, isDeleted: false });
    if (!vehicle) {
      throw new ApiError(404, 'Vehicle not found or you do not have permission to update it');
    }

    const oldData = vehicle.toObject();

    // Map allowed driver-updateable fields
    if (data.truckNumber) vehicle.vehicleNumber = data.truckNumber.replace(/-/g, '').toUpperCase();
    if (data.truckType) {
      vehicle.truckType = data.truckType;
      vehicle.bodyType = VehicleService.deriveBodyType(data.truckType);
    }
    if (data.truckHeight) vehicle.height = { value: data.truckHeight, unit: 'ft' };
    if (data.truckLength) vehicle.length = { value: data.truckLength, unit: 'ft' };
    if (data.truckCapacity) vehicle.capacity = { value: data.truckCapacity, unit: 'tons' };
    if (data.insuranceExpiryDate) vehicle.expiryDates.insurance = new Date(data.insuranceExpiryDate);
    if (data.driverPhoneNumber) vehicle.driverPhoneNumber = data.driverPhoneNumber;
    if (data.currentCity) vehicle.registrationCity = data.currentCity;

    // License number is stored on the driver profile
    if (data.licenseNumber) {
      driver.licenseNumber = data.licenseNumber;
      await driver.save();
    }

    vehicle.updatedBy = userId;
    // Set to pending verification if key fields changed
    vehicle.verificationStatus = 'pending';

    await vehicle.save();

    await AuditLog.create({
      user: userId,
      action: 'UPDATE_VEHICLE',
      entityType: 'vehicle',
      entityId: vehicle._id,
      changes: {
        before: oldData,
        after: vehicle.toObject()
      }
    }).catch(() => null);

    return vehicle;
  }

  /**
   * Get vehicles with filters
   * @param {Object} filters - Query filters
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Vehicles list
   */
  static async getVehicles(filters = {}, pagination = {}) {
    const {
      isAvailable,
      truckType,
      bodyType,
      minCapacity,
      maxCapacity,
      owner,
      location,
      radius = 50,
      hasGPS,
      hasFASTag,
      search,
      status,
      verificationStatus,
      ownershipType,
    } = filters;

    const query = { isDeleted: false };

    if (isAvailable === true) {
      query.availability = 'available';
      query.verificationStatus = 'verified';
      query.currentBooking = null;
    } else if (isAvailable === false) {
      query.$or = [
        { availability: { $ne: 'available' } },
        { verificationStatus: { $ne: 'verified' } },
        { currentBooking: { $ne: null } }
      ];
    }
    if (truckType) query.truckType = Array.isArray(truckType) ? { $in: truckType } : truckType;
    if (bodyType) query.bodyType = bodyType;
    if (minCapacity) query['capacity.value'] = { ...query['capacity.value'], $gte: minCapacity };
    if (maxCapacity) query['capacity.value'] = { ...query['capacity.value'], $lte: maxCapacity };
    if (owner) query['ownerRef.item'] = owner;
    if (typeof hasGPS === 'boolean') query['features.hasGPS'] = hasGPS;
    if (typeof hasFASTag === 'boolean') query['features.hasFastTag'] = hasFASTag;
    if (status) {
      // Frontend might send 'available', 'on-trip' which are availability values
      if (['available', 'on-trip', 'maintenance', 'offline'].includes(status)) {
        query.availability = status;
      } else {
        query.status = status;
      }
    }
    if (verificationStatus) query.verificationStatus = verificationStatus;
    if (ownershipType) {
      query.ownershipType = Array.isArray(ownershipType) ? { $in: ownershipType } : ownershipType;
    }

    // Search by vehicle number or registration state
    if (search) {
      query.$or = [
        { vehicleNumber: new RegExp(search, 'i') },
        { registrationState: new RegExp(search, 'i') }
      ];
    }

    // Location-based search
    if (location && location.latitude && location.longitude) {
      query['lastKnownLocation.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [location.longitude, location.latitude]
          },
          $maxDistance: radius * 1000
        }
      };
    }

    const result = await Vehicle.paginate(query, {
      page: pagination.page || 1,
      limit: pagination.limit || 20,
      sort: pagination.sort || { createdAt: -1 },
      populate: [
        { path: 'ownerRef.item', select: 'name phone displayName companyName' },
        { path: 'currentDriver', select: 'name phone' },
        { path: 'currentBooking', select: 'bookingId status' }
      ]
    });

    return result;
  }

  /**
   * Update vehicle
   * @param {string} vehicleId - Vehicle ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - User performing update
   * @returns {Promise<Object>} Updated vehicle
   */
  static async updateVehicle(vehicleId, updateData, userId) {
    const vehicle = await Vehicle.findOne({ _id: vehicleId, isDeleted: false });

    if (!vehicle) {
      throw new ApiError(404, 'Vehicle not found');
    }

    const oldData = vehicle.toObject();

    // Update allowed fields
    const allowedFields = [
      'vehicleNumber',
      'truckType',
      'length',
      'capacity',
      'bodyType',
      'manufacturer',
      'model',
      'year',
      'owner',
      'ownerRef',
      'supplierOwner',
      'currentDriver',
      'ownershipType',
      'registrationState',
      'registrationCity',
      'permitType',
      'expiryDates',
      'hasGPS',
      'hasFASTag',
      'availability',
      'status'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        vehicle[field] = updateData[field];
      }
    });

    vehicle.updatedBy = userId;
    await vehicle.save();

    // Update driver's vehicle list if owner changed
    if (updateData.owner && updateData.owner !== oldData.owner?.toString()) {
      // Remove from old owner
      if (oldData.owner) {
        await Driver.findByIdAndUpdate(oldData.owner, {
          $pull: { vehicles: vehicle._id }
        });
      }
      // Add to new owner
      await Driver.findByIdAndUpdate(updateData.owner, {
        $addToSet: { vehicles: vehicle._id }
      });
    }

    // Update driver's vehicle list if the operating driver changed (own/leased trucks)
    if ('currentDriver' in updateData && updateData.currentDriver !== oldData.currentDriver?.toString()) {
      if (oldData.currentDriver) {
        await Driver.findByIdAndUpdate(oldData.currentDriver, {
          $pull: { vehicles: vehicle._id }
        });
      }
      if (updateData.currentDriver) {
        await Driver.findByIdAndUpdate(updateData.currentDriver, {
          $addToSet: { vehicles: vehicle._id }
        });
      }
    }

    // Audit log
    await AuditLog.create({
      user: userId,
      action: 'UPDATE_VEHICLE',
      entityType: 'vehicle',
      entityId: vehicle._id,
      changes: {
        before: oldData,
        after: vehicle.toObject()
      }
    });

    return vehicle;
  }

  /**
   * Update vehicle location
   * @param {string} vehicleId - Vehicle ID
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @returns {Promise<void>}
   */
  static async updateLocation(vehicleId, latitude, longitude) {
    const vehicle = await Vehicle.findById(vehicleId);

    if (!vehicle) {
      throw new ApiError(404, 'Vehicle not found');
    }

    vehicle.lastKnownLocation = {
      type: 'Point',
      coordinates: [longitude, latitude]
    };
    vehicle.lastLocationUpdate = new Date();

    await vehicle.save();
  }

  /**
   * Update vehicle availability
   * @param {string} vehicleId - Vehicle ID
   * @param {boolean} isAvailable - Availability status
   * @returns {Promise<Object>} Updated vehicle
   */
  static async updateAvailability(vehicleId, isAvailable) {
    const vehicle = await Vehicle.findById(vehicleId);

    if (!vehicle) {
      throw new ApiError(404, 'Vehicle not found');
    }

    // Cannot set available if has current booking
    if (isAvailable && vehicle.currentBooking) {
      throw new ApiError(400, 'Cannot set available while assigned to a booking');
    }

    vehicle.availability = isAvailable ? 'available' : 'maintenance';
    await vehicle.save();

    return vehicle;
  }

  /**
   * Add maintenance record
   * @param {string} vehicleId - Vehicle ID
   * @param {Object} maintenanceData - Maintenance details
   * @returns {Promise<Object>} Updated vehicle
   */
  static async addMaintenance(vehicleId, maintenanceData) {
    const { type, description, cost, serviceDate, nextServiceDue, serviceCenter } = maintenanceData;

    const vehicle = await Vehicle.findById(vehicleId);

    if (!vehicle) {
      throw new ApiError(404, 'Vehicle not found');
    }

    vehicle.maintenanceHistory.push({
      type,
      description,
      cost,
      serviceDate: new Date(serviceDate),
      nextServiceDue: nextServiceDue ? new Date(nextServiceDue) : undefined,
      serviceCenter
    });

    await vehicle.save();

    return vehicle;
  }

  /**
   * Get available vehicles for booking
   * @param {Object} requirements - Booking requirements
   * @returns {Promise<Array>} Available vehicles
   */
  static async getAvailableVehicles(requirements) {
    const {
      truckType,
      minCapacity,
      location,
      radius = 100,
      loadDate
    } = requirements;

    const query = {
      isDeleted: false,
      availability: 'available',
      verificationStatus: 'verified',
      truckType
    };

    if (minCapacity) {
      query['capacity.value'] = { $gte: minCapacity };
    }

    // Check for active bookings during requested time
    if (loadDate) {
      const conflictingBookings = await Booking.find({
        status: { $nin: ['delivered', 'pod-received', 'closed', 'cancelled'] },
        loadDateTime: {
          $gte: new Date(loadDate),
          $lte: new Date(new Date(loadDate).getTime() + 48 * 60 * 60 * 1000) // 48 hours window
        },
        isDeleted: false
      }).select('vehicle');

      const busyVehicleIds = conflictingBookings.map(b => b.vehicle).filter(Boolean);
      if (busyVehicleIds.length > 0) {
        query._id = { $nin: busyVehicleIds };
      }
    }

    let vehicles = await Vehicle.find(query)
      .populate({ path: 'ownerRef.item', select: 'name phone performance displayName companyName' })
      .lean();

    // Filter by location if provided
    if (location && location.latitude && location.longitude) {
      vehicles = vehicles.filter(v => {
        if (!v.lastKnownLocation?.coordinates) return false;

        const [vLng, vLat] = v.lastKnownLocation.coordinates;
        const distance = this.calculateDistance(
          location.latitude,
          location.longitude,
          vLat,
          vLng
        );

        return distance <= radius;
      });
    }

    return vehicles;
  }

  /**
   * Get vehicles for a driver
   * @param {string} driverId
   * @returns {Promise<Array>} Vehicles
   */
  static async getVehiclesByDriver(driverId) {
    const driver = await Driver.findOne({ _id: driverId, isDeleted: false });
    if (!driver) {
      throw new ApiError(404, 'Driver not found');
    }

    // Match vehicles the driver owns (market/attached trucks) OR is currently
    // assigned to operate (own/leased trucks, which belong to Cloudtruck/financier
    // rather than the driver). Ownership alone excludes drivers without their own truck.
    const vehicles = await Vehicle.find({
      $or: [
        { 'ownerRef.item': driverId, 'ownerRef.kind': 'Driver' },
        { owner: driverId },
        { currentDriver: driverId }
      ],
      isDeleted: false
    })
      .populate({ path: 'ownerRef.item', select: 'name phone displayName companyName' })
      .lean();

    return vehicles;
  }

  /**
   * Get vehicles for a driver or supplier by User ID
   * @param {string} userId - Auth user ID
   * @returns {Promise<Array>} Vehicles list
   */
  static async getVehiclesByUserId(userId) {
    const driver = await Driver.findOne({ user: userId, isDeleted: false });
    if (driver) {
      return await this.getVehiclesByDriver(driver._id);
    }

    const supplier = await Supplier.findOne({ user: userId, isDeleted: false });
    if (supplier) {
      return await Vehicle.find({
        $or: [
          { 'ownerRef.item': supplier._id, 'ownerRef.kind': 'Supplier' },
          { supplierOwner: supplier._id },
        ],
        isDeleted: false,
      })
        .populate({ path: 'ownerRef.item', select: 'name phone displayName companyName' })
        .sort('-createdAt')
        .lean();
    }

    throw new ApiError(404, 'Profile not found');
  }

  /**
   * Get vehicle statistics
   * @param {string} vehicleId - Vehicle ID (optional)
   * @returns {Promise<Object>} Statistics
   */
  static async getVehicleStats(vehicleId) {
    const matchStage = { isDeleted: false };
    if (vehicleId) matchStage._id = vehicleId;

    const stats = await Vehicle.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'bookings',
          localField: '_id',
          foreignField: 'vehicle',
          as: 'bookings'
        }
      },
      {
        $project: {
          vehicleNumber: 1,
          truckType: 1,
          totalTrips: { $size: '$bookings' },
          completedTrips: {
            $size: {
              $filter: {
                input: '$bookings',
                as: 'booking',
                cond: {
                  $in: ['$$booking.status', ['delivered', 'pod-received', 'closed']]
                }
              }
            }
          },
          totalRevenue: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$bookings',
                    as: 'booking',
                    cond: { $eq: ['$$booking.status', 'closed'] }
                  }
                },
                as: 'booking',
                in: '$$booking.finalAmount'
              }
            }
          },
          maintenanceCost: { $sum: '$maintenanceHistory.cost' }
        }
      }
    ]);

    return vehicleId ? stats[0] : stats;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   * @param {number} lat1 - Latitude 1
   * @param {number} lon1 - Longitude 1
   * @param {number} lat2 - Latitude 2
   * @param {number} lon2 - Longitude 2
   * @returns {number} Distance in km
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Verify vehicle
   * @param {string} vehicleId - Vehicle ID
   * @param {string} verifiedBy - Staff ID
   * @returns {Promise<Object>} Updated vehicle
   */
  static async verifyVehicle(vehicleId, verifiedBy) {
    const vehicle = await Vehicle.findById(vehicleId);

    if (!vehicle) {
      throw new ApiError(404, 'Vehicle not found');
    }

    vehicle.verificationStatus = 'verified';
    vehicle.verificationDetails = {
      verifiedBy,
      verifiedAt: new Date()
    };
    await vehicle.save();

    // Audit log
    await AuditLog.create({
      user: verifiedBy,
      action: 'VERIFY_VEHICLE',
      entityType: 'vehicle',
      entityId: vehicle._id,
      changes: {
        before: { verificationStatus: 'pending' },
        after: { verificationStatus: 'verified' }
      }
    });

    return vehicle;
  }

  /**
   * Reject vehicle
   * @param {string} vehicleId - Vehicle ID
   * @param {string} reason - Rejection reason
   * @param {string} rejectedBy - Staff ID
   * @returns {Promise<Object>} Updated vehicle
   */
  static async rejectVehicle(vehicleId, reason, rejectedBy) {
    const vehicle = await Vehicle.findById(vehicleId);

    if (!vehicle) {
      throw new ApiError(404, 'Vehicle not found');
    }

    const oldStatus = vehicle.verificationStatus;
    vehicle.verificationStatus = 'rejected';
    vehicle.verificationDetails = {
      verifiedBy: rejectedBy,
      verifiedAt: new Date(),
      rejectionReason: reason
    };
    await vehicle.save();

    // Audit log
    await AuditLog.create({
      user: rejectedBy,
      action: 'REJECT_VEHICLE',
      entityType: 'vehicle',
      entityId: vehicle._id,
      changes: {
        before: { verificationStatus: oldStatus },
        after: { verificationStatus: 'rejected', rejectionReason: reason }
      }
    });

    // Notify vehicle owner if Driver-owned
    const ownerDriverId = vehicle.ownerRef?.kind === 'Driver' ? vehicle.ownerRef?.item : vehicle.owner;
    if (ownerDriverId) {
      const driver = await Driver.findById(ownerDriverId);
      if (driver && driver.user) {
        await NotificationService.sendNotification({
          recipient: driver.user,
          type: 'vehicle_rejected',
          title: 'Vehicle Rejected',
          message: `Your vehicle ${vehicle.vehicleNumber} was rejected. Reason: ${reason}`,
          entityType: 'vehicle',
          entityId: vehicle._id,
          channels: ['push', 'in-app']
        });
      }
    }

    return vehicle;
  }

  /**
   * Soft delete vehicle
   * @param {string} vehicleId - Vehicle ID
   * @param {string} deletedBy - User ID
   * @returns {Promise<Object>} Deleted vehicle
   */
  static async deleteVehicle(vehicleId, deletedBy) {
    const vehicle = await Vehicle.findById(vehicleId);

    if (!vehicle) {
      throw new ApiError(404, 'Vehicle not found');
    }

    if (vehicle.currentBooking) {
      throw new ApiError(400, 'Cannot delete vehicle with active booking');
    }

    await vehicle.softDelete(deletedBy);

    // Remove from owner's vehicle list (only if Driver-owned)
    const deleteOwnerDriverId = vehicle.ownerRef?.kind === 'Driver' ? vehicle.ownerRef?.item : vehicle.owner;
    if (deleteOwnerDriverId) {
      await Driver.findByIdAndUpdate(deleteOwnerDriverId, {
        $pull: { vehicles: vehicle._id }
      });
    }

    // Audit log
    await AuditLog.create({
      user: deletedBy,
      action: 'DELETE_VEHICLE',
      entityType: 'vehicle',
      entityId: vehicle._id,
      changes: {
        before: vehicle.toObject(),
        after: { isDeleted: true }
      }
    });

    return vehicle;
  }
}

export default VehicleService;
