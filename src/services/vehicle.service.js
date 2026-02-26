import Vehicle from '../models/vehicle.model.js';
import Driver from '../models/driver.model.js';
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
      registrationState,
      permitType,
      expiryDates,
      hasGPS,
      hasFASTag
    } = data;

    // Check if vehicle number already exists
    const existingVehicle = await Vehicle.findOne({
      vehicleNumber: vehicleNumber.toUpperCase(),
      isDeleted: false
    });

    if (existingVehicle) {
      throw new ApiError(400, 'Vehicle number already registered');
    }

    // Verify owner exists if provided
    if (owner) {
      const driver = await Driver.findById(owner);
      if (!driver || driver.isDeleted) {
        throw new ApiError(404, 'Vehicle owner (driver) not found');
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
      owner,
      registrationState,
      permitType,
      expiryDates,
      hasGPS,
      hasFASTag,
      availability: 'available',
      createdBy
    });

    // Update driver's vehicle list
    if (owner) {
      await Driver.findByIdAndUpdate(owner, {
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
      bodyType: 'open',
      owner: driver._id,
      driverPhoneNumber: data.driverPhoneNumber,
      lastKnownLocation: {
        city: data.currentCity
      },
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
      .populate('owner', 'name phone licenseNumber')
      .populate('currentBooking', 'bookingId status pickup drop')
      .populate('nextBooking', 'bookingId status pickup drop')
      .populate('documents', 'type status fileUrl expiryDate');

    if (!vehicle) {
      throw new ApiError(404, 'Vehicle not found');
    }

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
      verificationStatus
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
    if (owner) query.owner = owner;
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
        { path: 'owner', select: 'name phone' },
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
      'registrationState',
      'permitType',
      'expiryDates',
      'hasGPS',
      'hasFASTag',
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
      .populate('owner', 'name phone performance.rating')
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

    const vehicles = await Vehicle.find({ owner: driverId, isDeleted: false })
      .populate('owner', 'name phone')
      .lean();

    return vehicles;
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

    // Remove from owner's vehicle list
    if (vehicle.owner) {
      await Driver.findByIdAndUpdate(vehicle.owner, {
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
