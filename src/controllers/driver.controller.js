import DriverService from '../services/driver.service.js';
import VehicleService from '../services/vehicle.service.js';
import Driver from '../models/driver.model.js';
import { mapBooking } from './booking.controller.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';

// Helper: normalize driver document to frontend shape
const mapDriver = (drv) => {
  const d = drv.toObject ? drv.toObject() : drv;
  return {
    _id: d._id,
    user: d.user ? (d.user._id ? { _id: d.user._id } : { _id: d.user }) : undefined,
    userId: d.user && d.user._id ? d.user._id : d.user,
    name: d.name,
    phone: d.user?.phone || d.phone,
    email: d.user?.email,
    profilePhoto: d.profilePhoto,
    licenseNumber: d.licenseNumber,
    licenseExpiry: d.licenseExpiry,
    licensePhoto: d.licenseImage || null,
    aadhaarNumber: d.aadhaar?.number,
    aadhaarPhoto: d.documents?.aadhaarDocument?.url || null,
    panNumber: d.pan?.number,
    panPhoto: d.documents?.panDocument?.url || null,
    chequePhoto: d.documents?.chequeImage?.url || null,
    tdsDocument: d.documents?.tdsDocument?.url || null,
    bankDetails: d.bankDetails || null,
    gstin: d.gstin || null,
    status: d.isBlacklisted ? 'blocked' : d.availability || (d.isBlacklisted ? 'blocked' : 'offline'),
    isVerified: d.isVerified,
    isBlacklisted: d.isBlacklisted,
    blacklistReason: d.blacklistReason,
    preferredTruckTypes: d.preferredTruckTypes,
    vehicles: d.vehicles || [],
    currentLocation: d.lastKnownLocation,
    lastActive: d.lastLocationAt,
    totalTrips: d.performance?.completedTrips || 0,
    rating: d.performance?.averageRating || 0,
    isReturnTrip: d.isReturnTrip,
    kycStatus: d.kycStatus,
    accountInfoStatus: d.accountInfoStatus,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    rejectionReason: d.rejectionReason,
    rejectedAt: d.rejectedAt
  };
};

/**
 * Create Driver Profile
 * POST /api/v1/drivers
 */
export const createDriver = asyncHandler(async (req, res) => {
  const driverData = req.body;
  const actor = req.user; // The user performing the action (may be driver, staff, or super-admin)

  const driver = await DriverService.createDriver(driverData, actor);

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
    new ApiResponse(200, mapDriver(driver), 'Driver fetched successfully')
  );
});

export const getDriverByUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const driver = await DriverService.getDriverByUserId(userId);

  return res.status(200).json(
    new ApiResponse(200, mapDriver(driver), 'Driver fetched by user successfully')
  );
});

/**
 * Get Available Drivers
 * GET /api/v1/drivers/available
 */
export const getAvailableDrivers = asyncHandler(async (req, res) => {
  const { truckType, city, latitude, longitude, lat, lng, radius, matchPickupCity } = req.query;

  const latToUse = latitude || lat;
  const lngToUse = longitude || lng;

  const filters = {
    isAvailable: true,
    isVerified: true,
    isBlacklisted: false,
    truckType: truckType && truckType !== 'undefined' ? truckType : undefined,
    location: latToUse && lngToUse ? { latitude: parseFloat(latToUse), longitude: parseFloat(lngToUse) } : undefined,
    radius: radius ? parseFloat(radius) : undefined,
    matchPickupCity
  };

  const result = await DriverService.getDrivers(filters, { limit: 100 });
  
  // Handle both paginated and non-paginated results from service
  const docs = result.docs || result.results || result.data || (Array.isArray(result) ? result : []);
  
  return res.status(200).json(
    new ApiResponse(200, docs.map(mapDriver), 'Available drivers fetched successfully')
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

  // Map paginate result to frontend contract: { drivers: Driver[], pagination: {...} }
  // Support multiple paginate shapes (plugin returns { data, pagination })
  let docsArray = [];
  let paginationRes = { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 20 };

  if (Array.isArray(result)) {
    docsArray = result;
  } else if (Array.isArray(result.docs)) {
    docsArray = result.docs;
    paginationRes = {
      currentPage: result.page || 1,
      totalPages: result.totalPages || 1,
      totalItems: result.totalDocs || 0,
      itemsPerPage: result.limit || 20
    };
  } else if (Array.isArray(result.results)) {
    docsArray = result.results;
    paginationRes = {
      currentPage: result.page || 1,
      totalPages: result.totalPages || 1,
      totalItems: result.totalDocs || 0,
      itemsPerPage: result.limit || 20
    };
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

  const drivers = docsArray.map((d) => {
    const drv = d.toObject ? d.toObject() : d;
    return {
      _id: drv._id,
      user: drv.user ? (drv.user._id ? { _id: drv.user._id } : { _id: drv.user }) : undefined,
      userId: drv.user && drv.user._id ? drv.user._id : drv.user,
      name: drv.name,
      phone: drv.user?.phone || drv.phone,
      email: drv.user?.email,
      profilePhoto: drv.profilePhoto,
      licenseNumber: drv.licenseNumber,
      status: drv.isBlacklisted ? 'blocked' : drv.availability || (drv.isBlacklisted ? 'blocked' : 'offline'),
      isVerified: drv.isVerified,
      isBlacklisted: drv.isBlacklisted,
      blacklistReason: drv.blacklistReason,
      preferredTruckTypes: drv.preferredTruckTypes,
      vehicles: drv.vehicles || [],
      currentLocation: drv.lastKnownLocation,
      lastActive: drv.lastLocationAt,
      totalTrips: drv.performance?.completedTrips || 0,
      rating: drv.performance?.averageRating || 0,
      createdAt: drv.createdAt,
      updatedAt: drv.updatedAt,
      rejectionReason: drv.rejectionReason,
      rejectedAt: drv.rejectedAt
    };
  });
  return res.status(200).json(
    new ApiResponse(200, { drivers, pagination: paginationRes }, 'Drivers fetched successfully')
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
 * Reject Driver
 * POST /api/v1/drivers/:id/reject
 */
export const rejectDriver = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const rejectedBy = req.user._id;

  const driver = await DriverService.rejectDriver(id, reason, rejectedBy);

  return res.status(200).json(
    new ApiResponse(200, driver, 'Driver rejected successfully')
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
 * Get Driver Trip History
 * GET /api/v1/drivers/:id/trip-history
 */
export const getTripHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page, limit, sort, status, startDate, endDate, search, truckType, customerName } = req.query;

  const filters = { status, startDate, endDate, search, truckType, customerName };
  const pagination = { page, limit, sort };

  const result = await DriverService.getTripHistory(id, filters, pagination);
  const trips = result.data.map(mapBooking);

  const paginationRes = {
    currentPage: result.pagination.page,
    totalPages: result.pagination.pages,
    totalItems: result.pagination.total,
    itemsPerPage: result.pagination.limit
  };

  return res.status(200).json(
    new ApiResponse(200, { trips, pagination: paginationRes }, 'Trip history fetched successfully')
  );
});

/**
 * Get My Trip History (Driver)
 * GET /api/v1/drivers/my-trip-history
 */
export const getMyTripHistory = asyncHandler(async (req, res) => {
  const driverId = req.user._id;
  const { page, limit, sort, status, startDate, endDate, search, truckType, customerName } = req.query;

  const filters = { status, startDate, endDate, search, truckType, customerName };
  const pagination = { page, limit, sort };

  const result = await DriverService.getTripHistory(driverId, filters, pagination);
  const trips = result.data.map(mapBooking);

  const paginationRes = {
    currentPage: result.pagination.page,
    totalPages: result.pagination.pages,
    totalItems: result.pagination.total,
    itemsPerPage: result.pagination.limit
  };

  return res.status(200).json(
    new ApiResponse(200, { trips, pagination: paginationRes }, 'Trip history fetched successfully')
  );
});

/**
 * Get My Wallet (Driver)
 * GET /api/v1/drivers/my-wallet
 */
export const getMyWallet = asyncHandler(async (req, res) => {
  const wallet = await DriverService.getMyWallet(req.user._id);
  return res.status(200).json(
    new ApiResponse(200, wallet, 'Wallet fetched successfully')
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
 * Driver deletes own account
 * DELETE /api/v1/drivers/my-account
 */
export const deleteMyAccount = asyncHandler(async (req, res) => {
  await DriverService.deleteMyAccount(req.user._id);
  return res.status(200).json(
    new ApiResponse(200, null, 'Account deleted successfully')
  );
});

/**
 * Submit KYC (Driver)
 * POST /api/v1/drivers/my-kyc
 */
export const submitKyc = asyncHandler(async (req, res) => {
  const driver = await DriverService.submitKyc(req.user._id, req.body);

  return res.status(201).json(
    new ApiResponse(201, driver, 'KYC submitted successfully')
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

/**
 * Get My Account Information (Driver)
 * GET /api/v1/drivers/my-account-info
 */
export const getMyAccountInfo = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const driver = await Driver.findOne({ user: userId, isDeleted: false })
    .populate('documents.chequeImage documents.tdsDocument documents.aadhaarDocument documents.panDocument')
    .select('bankDetails gstin documents accountInfoStatus accountInfoSubmittedAt aadhaar pan rejectionReason rejectedAt');

  if (!driver) {
    throw new ApiError(404, 'Driver profile not found');
  }

  return res.status(200).json(
    new ApiResponse(200, driver, 'Account information fetched successfully')
  );
});

/**
 * Submit Account Info (Driver)
 * POST /api/v1/drivers/my-account-info
 */
/**
 * Add My Truck (Driver)
 * POST /api/v1/drivers/my-truck
 */
export const addMyTruck = asyncHandler(async (req, res) => {
  const vehicle = await VehicleService.addDriverTruck(req.user._id, req.body);

  return res.status(201).json(
    new ApiResponse(201, vehicle, 'Truck added successfully')
  );
});

/**
 * Submit Account Info (Driver)
 * POST /api/v1/drivers/my-account-info
 */
export const submitAccountInfo = asyncHandler(async (req, res) => {
  const driver = await DriverService.submitAccountInfo(req.user._id, req.body, req.files);

  return res.status(201).json(
    new ApiResponse(201, driver, 'Account information submitted successfully')
  );
});
