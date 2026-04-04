import VehicleService from '../services/vehicle.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import AuditLog from '../models/auditLog.model.js';
import Vehicle from '../models/vehicle.model.js';

/**
 * Create Vehicle
 * POST /api/v1/vehicles
 */
export const createVehicle = asyncHandler(async (req, res) => {
  const vehicleData = req.body;
  const createdBy = req.user._id;

  const vehicle = await VehicleService.createVehicle(vehicleData, createdBy);

  return res.status(201).json(
    new ApiResponse(201, vehicle, 'Vehicle created successfully')
  );
});

/**
 * Get Vehicle by ID
 * GET /api/v1/vehicles/:id
 */
export const getVehicleById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const vehicle = await VehicleService.getVehicleById(id);

  return res.status(200).json(
    new ApiResponse(200, vehicle, 'Vehicle fetched successfully')
  );
});

/**
 * Get All Vehicles
 * GET /api/v1/vehicles
 */
export const getAllVehicles = asyncHandler(async (req, res) => {
  const {
    isAvailable,
    truckType,
    bodyType,
    minCapacity,
    maxCapacity,
    owner,
    latitude,
    longitude,
    radius,
    hasGPS,
    hasFASTag,
    search,
    status,
    verificationStatus,
    ownershipType,
    page,
    limit,
    sort
  } = req.query;

  const filters = {
    isAvailable: isAvailable === 'true' ? true : isAvailable === 'false' ? false : undefined,
    truckType: truckType ? truckType.split(',') : undefined,
    bodyType,
    minCapacity: minCapacity ? parseFloat(minCapacity) : undefined,
    maxCapacity: maxCapacity ? parseFloat(maxCapacity) : undefined,
    owner,
    location: latitude && longitude ? { latitude: parseFloat(latitude), longitude: parseFloat(longitude) } : undefined,
    radius: radius ? parseFloat(radius) : undefined,
    hasGPS: hasGPS === 'true' ? true : hasGPS === 'false' ? false : undefined,
    hasFASTag: hasFASTag === 'true' ? true : hasFASTag === 'false' ? false : undefined,
    search,
    status,
    verificationStatus,
    ownershipType: ownershipType
      ? Array.isArray(ownershipType) ? ownershipType : ownershipType.split(',')
      : undefined,
  };

  const pagination = { page, limit, sort };

  const result = await VehicleService.getVehicles(filters, pagination);

  // Map paginate result to frontend contract: { vehicles: Vehicle[], pagination: {...} }
  let docsArray = [];
  let paginationRes = { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 20 };

  if (Array.isArray(result)) {
    docsArray = result;
  } else if (Array.isArray(result.data)) {
    docsArray = result.data;
    const p = result.pagination || {};
    paginationRes = {
      currentPage: p.page || 1,
      totalPages: p.pages || 1,
      totalItems: p.total || 0,
      itemsPerPage: p.limit || 20
    };
  }

  return res.status(200).json(
    new ApiResponse(200, { vehicles: docsArray, pagination: paginationRes }, 'Vehicles fetched successfully')
  );
});

/**
 * Get Vehicles by Driver
 * GET /api/v1/vehicles/driver/:driverId
 */
export const getVehiclesByDriver = asyncHandler(async (req, res) => {
  const { driverId } = req.params;

  const vehicles = await VehicleService.getVehiclesByDriver(driverId);

  return res.status(200).json(
    new ApiResponse(200, vehicles, 'Vehicles fetched successfully')
  );
});

/**
 * Get My Vehicles (Self-service for Driver)
 * GET /api/v1/vehicles/my-trucks
 */
export const getMyTrucks = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const vehicles = await VehicleService.getVehiclesByUserId(userId);

  return res.status(200).json(
    new ApiResponse(200, vehicles, 'My vehicles fetched successfully')
  );
});

/**
 * Get My Truck Detail (Self-service for Driver)
 * GET /api/v1/vehicles/my-trucks/:vehicleId
 * Returns full vehicle details enriched with owner's PAN and TDS document
 */
export const getMyTruckDetail = asyncHandler(async (req, res) => {
  const { vehicleId } = req.params;
  const userId = req.user._id;

  const vehicle = await VehicleService.getVehicleDetailsForDriver(vehicleId, userId);

  return res.status(200).json(
    new ApiResponse(200, vehicle, 'Vehicle details fetched successfully')
  );
});

/**
 * Update My Truck Detail (Self-service for Driver)
 * PATCH /api/v1/vehicles/my-trucks/:vehicleId
 */
export const updateMyTruck = asyncHandler(async (req, res) => {
  const { vehicleId } = req.params;
  const userId = req.user._id;
  const updateData = req.body;

  const vehicle = await VehicleService.updateMyTruck(userId, vehicleId, updateData);

  return res.status(200).json(
    new ApiResponse(200, vehicle, 'Vehicle updated successfully')
  );
});

/**
 * Update Vehicle
 * PATCH /api/v1/vehicles/:id
 */
export const updateVehicle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const userId = req.user._id;

  const vehicle = await VehicleService.updateVehicle(id, updateData, userId);

  return res.status(200).json(
    new ApiResponse(200, vehicle, 'Vehicle updated successfully')
  );
});

/**
 * Update Vehicle Location
 * POST /api/v1/vehicles/:id/location
 */
export const updateLocation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { latitude, longitude } = req.body;

  await VehicleService.updateLocation(id, latitude, longitude);

  return res.status(200).json(
    new ApiResponse(200, null, 'Location updated successfully')
  );
});

/**
 * Update Vehicle Availability
 * PATCH /api/v1/vehicles/:id/availability
 */
export const updateAvailability = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isAvailable } = req.body;

  const vehicle = await VehicleService.updateAvailability(id, isAvailable);

  return res.status(200).json(
    new ApiResponse(200, vehicle, 'Availability updated successfully')
  );
});

/**
 * Add Maintenance Record
 * POST /api/v1/vehicles/:id/maintenance
 */
export const addMaintenance = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const maintenanceData = req.body;

  const vehicle = await VehicleService.addMaintenance(id, maintenanceData);

  return res.status(200).json(
    new ApiResponse(200, vehicle, 'Maintenance record added successfully')
  );
});

/**
 * Get Available Vehicles for Booking
 * GET /api/v1/vehicles/available
 */
export const getAvailableVehicles = asyncHandler(async (req, res) => {
  const { truckType, minCapacity, latitude, longitude, radius, loadDate } = req.query;

  const requirements = {
    truckType,
    minCapacity: minCapacity ? parseFloat(minCapacity) : undefined,
    location: latitude && longitude ? { latitude: parseFloat(latitude), longitude: parseFloat(longitude) } : undefined,
    radius: radius ? parseFloat(radius) : undefined,
    loadDate
  };

  const vehicles = await VehicleService.getAvailableVehicles(requirements);

  return res.status(200).json(
    new ApiResponse(200, vehicles, 'Available vehicles fetched successfully')
  );
});

/**
 * Get Vehicle Statistics
 * GET /api/v1/vehicles/:id/stats
 */
export const getVehicleStats = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const stats = await VehicleService.getVehicleStats(id);

  return res.status(200).json(
    new ApiResponse(200, stats, 'Vehicle statistics fetched successfully')
  );
});

/**
 * Get All Vehicle Statistics
 * GET /api/v1/vehicles/stats/all
 */
export const getAllVehicleStats = asyncHandler(async (req, res) => {
  const stats = await VehicleService.getVehicleStats();

  return res.status(200).json(
    new ApiResponse(200, stats, 'Vehicle statistics fetched successfully')
  );
});

/**
 * Verify Vehicle
 * POST /api/v1/vehicles/:id/verify
 */
export const verifyVehicle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const verifiedBy = req.user._id;

  const vehicle = await VehicleService.verifyVehicle(id, verifiedBy);

  return res.status(200).json(
    new ApiResponse(200, vehicle, 'Vehicle verified successfully')
  );
});

/**
 * Reject Vehicle
 * POST /api/v1/vehicles/:id/reject
 */
export const rejectVehicle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const rejectedBy = req.user._id;

  const vehicle = await VehicleService.rejectVehicle(id, reason, rejectedBy);

  return res.status(200).json(
    new ApiResponse(200, vehicle, 'Vehicle rejected successfully')
  );
});

/**
 * Delete Vehicle
 * DELETE /api/v1/vehicles/:id
 */
export const deleteVehicle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deletedBy = req.user._id;

  const vehicle = await VehicleService.deleteVehicle(id, deletedBy);

  return res.status(200).json(
    new ApiResponse(200, vehicle, 'Vehicle deleted successfully')
  );
});

/**
 * Add Note to Vehicle
 * POST /api/v1/vehicles/:id/notes
 */
export const addVehicleNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  if (!text?.trim()) throw new ApiError(400, 'Note text is required');
  const vehicle = await Vehicle.findById(id);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  await AuditLog.create({
    user: req.user._id,
    action: 'ADD_VEHICLE_NOTE',
    entityType: 'vehicle',
    entityId: vehicle._id,
    context: { module: 'vehicle-management', description: text.trim(), severity: 'low' }
  });
  return res.status(201).json(new ApiResponse(201, {}, 'Note added'));
});

/**
 * Get Vehicle Audit Logs (comments)
 * GET /api/v1/vehicles/:id/notes
 */
export const getVehicleNotes = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const logs = await AuditLog.find({ entityType: 'vehicle', entityId: id })
    .sort({ timestamp: -1 })
    .limit(50)
    .populate('user', 'name email phone');
  return res.status(200).json(new ApiResponse(200, logs, 'Notes fetched'));
});

