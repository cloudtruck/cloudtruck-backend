import VehicleService from '../services/vehicle.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';

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
    search
  };

  const pagination = { page, limit, sort };

  const result = await VehicleService.getVehicles(filters, pagination);

  return res.status(200).json(
    new ApiResponse(200, result, 'Vehicles fetched successfully')
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
