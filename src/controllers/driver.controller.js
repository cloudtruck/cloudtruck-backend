import DriverService from '../services/driver.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';

/**
 * Create Driver Profile
 * POST /api/v1/drivers
 */
export const createDriver = asyncHandler(async (req, res) => {
  const driverData = req.body;
  const userId = req.user._id;

  const driver = await DriverService.createDriver(driverData, userId);

  return res.status(201).json(
    new ApiResponse(201, driver, 'Driver profile created successfully')
  );
});

/**
 * Get Driver by ID
 * GET /api/v1/drivers/:id
 */
export const getDriverById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const driver = await DriverService.getDriverById(id);

  return res.status(200).json(
    new ApiResponse(200, driver, 'Driver fetched successfully')
  );
});

/**
 * Get All Drivers
 * GET /api/v1/drivers
 */
export const getAllDrivers = asyncHandler(async (req, res) => {
  const {
    isAvailable,
    isVerified,
    truckType,
    latitude,
    longitude,
    radius,
    minRating,
    isBlacklisted,
    page,
    limit,
    sort
  } = req.query;

  const filters = {
    isAvailable: isAvailable === 'true' ? true : isAvailable === 'false' ? false : undefined,
    isVerified: isVerified === 'true' ? true : isVerified === 'false' ? false : undefined,
    isBlacklisted: isBlacklisted === 'true' ? true : isBlacklisted === 'false' ? false : undefined,
    truckType,
    location: latitude && longitude ? { latitude: parseFloat(latitude), longitude: parseFloat(longitude) } : undefined,
    radius: radius ? parseFloat(radius) : undefined,
    minRating: minRating ? parseFloat(minRating) : undefined
  };

  const pagination = { page, limit, sort };

  const result = await DriverService.getDrivers(filters, pagination);

  return res.status(200).json(
    new ApiResponse(200, result, 'Drivers fetched successfully')
  );
});

/**
 * Update Driver Profile
 * PATCH /api/v1/drivers/:id
 */
export const updateDriver = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const userId = req.user._id;

  const driver = await DriverService.updateDriver(id, updateData, userId);

  return res.status(200).json(
    new ApiResponse(200, driver, 'Driver updated successfully')
  );
});

/**
 * Update Driver Location
 * POST /api/v1/drivers/:id/location
 */
export const updateLocation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { latitude, longitude } = req.body;

  await DriverService.updateLocation(id, latitude, longitude);

  return res.status(200).json(
    new ApiResponse(200, null, 'Location updated successfully')
  );
});

/**
 * Update My Location (Driver)
 * POST /api/v1/drivers/my-location
 */
export const updateMyLocation = asyncHandler(async (req, res) => {
  const driverId = req.user._id;
  const { latitude, longitude } = req.body;

  await DriverService.updateLocation(driverId, latitude, longitude);

  return res.status(200).json(
    new ApiResponse(200, null, 'Location updated successfully')
  );
});

/**
 * Update Driver Availability
 * PATCH /api/v1/drivers/:id/availability
 */
export const updateAvailability = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isAvailable } = req.body;

  const driver = await DriverService.updateAvailability(id, isAvailable);

  return res.status(200).json(
    new ApiResponse(200, driver, 'Availability updated successfully')
  );
});

/**
 * Update My Availability (Driver)
 * PATCH /api/v1/drivers/my-availability
 */
export const updateMyAvailability = asyncHandler(async (req, res) => {
  const driverId = req.user._id;
  const { isAvailable } = req.body;

  const driver = await DriverService.updateAvailability(driverId, isAvailable);

  return res.status(200).json(
    new ApiResponse(200, driver, 'Availability updated successfully')
  );
});

/**
 * Add Rating to Driver
 * POST /api/v1/drivers/:id/rating
 */
export const addRating = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, feedback, bookingId } = req.body;

  const driver = await DriverService.addRating(id, rating, feedback, bookingId);

  return res.status(200).json(
    new ApiResponse(200, driver, 'Rating added successfully')
  );
});

/**
 * Verify Driver
 * POST /api/v1/drivers/:id/verify
 */
export const verifyDriver = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const verifiedBy = req.user._id;

  const driver = await DriverService.verifyDriver(id, verifiedBy);

  return res.status(200).json(
    new ApiResponse(200, driver, 'Driver verified successfully')
  );
});

/**
 * Blacklist Driver
 * POST /api/v1/drivers/:id/blacklist
 */
export const blacklistDriver = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const blacklistedBy = req.user._id;

  const driver = await DriverService.blacklistDriver(id, reason, blacklistedBy);

  return res.status(200).json(
    new ApiResponse(200, driver, 'Driver blacklisted successfully')
  );
});

/**
 * Remove from Blacklist
 * POST /api/v1/drivers/:id/remove-blacklist
 */
export const removeFromBlacklist = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const driver = await DriverService.removeFromBlacklist(id);

  return res.status(200).json(
    new ApiResponse(200, driver, 'Driver removed from blacklist successfully')
  );
});

/**
 * Get Driver Performance Report
 * GET /api/v1/drivers/:id/performance
 */
export const getPerformanceReport = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;

  const dateRange = { startDate, endDate };

  const report = await DriverService.getPerformanceReport(id, dateRange);

  return res.status(200).json(
    new ApiResponse(200, report, 'Performance report fetched successfully')
  );
});

/**
 * Get My Performance (Driver)
 * GET /api/v1/drivers/my-performance
 */
export const getMyPerformance = asyncHandler(async (req, res) => {
  const driverId = req.user._id;
  const { startDate, endDate } = req.query;

  const dateRange = { startDate, endDate };

  const report = await DriverService.getPerformanceReport(driverId, dateRange);

  return res.status(200).json(
    new ApiResponse(200, report, 'Performance report fetched successfully')
  );
});

/**
 * Get Nearby Drivers
 * GET /api/v1/drivers/nearby
 */
export const getNearbyDrivers = asyncHandler(async (req, res) => {
  const { latitude, longitude, radius, truckType } = req.query;

  const drivers = await DriverService.getNearbyDrivers(
    parseFloat(latitude),
    parseFloat(longitude),
    radius ? parseFloat(radius) : 50,
    truckType
  );

  return res.status(200).json(
    new ApiResponse(200, drivers, 'Nearby drivers fetched successfully')
  );
});

/**
 * Delete Driver
 * DELETE /api/v1/drivers/:id
 */
export const deleteDriver = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deletedBy = req.user._id;

  const driver = await DriverService.deleteDriver(id, deletedBy);

  return res.status(200).json(
    new ApiResponse(200, driver, 'Driver deleted successfully')
  );
});

/**
 * Get My Profile (Driver)
 * GET /api/v1/drivers/my-profile
 */
export const getMyProfile = asyncHandler(async (req, res) => {
  const driverId = req.user._id;

  const driver = await DriverService.getDriverById(driverId);

  return res.status(200).json(
    new ApiResponse(200, driver, 'Profile fetched successfully')
  );
});
