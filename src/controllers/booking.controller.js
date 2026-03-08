import BookingService from '../services/booking.service.js';
import Driver from '../models/driver.model.js';
import MasterData from '../models/masterData.model.js';
import TrackingService from '../services/tracking.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import mongoose from 'mongoose';

/**
 * Create Booking
 * POST /api/v1/bookings
 */
export const createBooking = asyncHandler(async (req, res) => {
  const bookingData = req.body;
  const userId = req.user._id;
  const files = req.files; // multer parsed files (cargoImages)

  const booking = await BookingService.createBooking(bookingData, userId, files);

  return res.status(201).json(
    new ApiResponse(201, booking, 'Booking created successfully')
  );
});

/**
 * Get Truck Types
 * GET /api/v1/bookings/truck-types
 */
export const getTruckTypes = asyncHandler(async (req, res) => {
  const truckTypes = await MasterData.findByCategory('truck-type');

  const data = truckTypes.map(t => ({
    key: t.key,
    displayName: t.displayName,
    displayOrder: t.displayOrder,
    imageUrl: t.imageUrl,
    description: t.description
  }));

  return res.status(200).json(
    new ApiResponse(200, data, 'Truck types fetched successfully')
  );
});

/**
 * Get All Bookings
 * GET /api/v1/bookings
 */
// Helper: normalize booking document to frontend Booking shape
export const mapBooking = (b) => {
  const bk = b.toObject ? b.toObject() : b;
  return {
    _id: bk._id,
    bookingId: bk.bookingId,
    customer: bk.customer ? {
      _id: bk.customer._id || bk.customer,
      companyName: bk.customer.companyName,
      phone: bk.customer.phone,
      contactPerson: bk.customer.contactPerson
    } : null,
    pickup: {
      city: bk.pickup?.city,
      state: bk.pickup?.state,
      address: bk.pickup?.address,
      latLng: bk.pickup?.location || bk.pickup?.latLng
    },
    drop: {
      city: bk.drop?.city,
      state: bk.drop?.state,
      address: bk.drop?.address,
      latLng: bk.drop?.location || bk.drop?.latLng
    },
    materialType: bk.materialType,
    weight: bk.weight,
    truckTypeNeeded: bk.truckTypeNeeded,
    bodyType: bk.bodyType,
    estimatedDistance: (() => {
      if (bk.estimatedDistance?.value) return bk.estimatedDistance.value;
      // Fallback: compute on the fly from stored coordinates (handles seeded data)
      const pc = bk.pickup?.location?.coordinates;
      const dc = bk.drop?.location?.coordinates;
      if (!pc || !dc || pc.length < 2 || dc.length < 2) return null;
      if (pc[0] === 0 && pc[1] === 0) return null; // dummy coordinates
      const dLat = (dc[1] - pc[1]) * Math.PI / 180;
      const dLon = (dc[0] - pc[0]) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(pc[1] * Math.PI / 180) * Math.cos(dc[1] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
      return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10 || null;
    })(),
    loadDateTime: bk.loadDateTime || bk.loadDate || bk.loadDateTime,
    status: bk.status,
    paymentStatus: bk.paymentStatus,
    expectedAmount: bk.expectedAmount,
    finalAmount: bk.finalAmount,
    freight: bk.finalAmount || bk.expectedAmount || 0,
    advanceRequired: bk.advanceRequired,
    balance: (bk.finalAmount || bk.expectedAmount || 0) - (bk.advanceRequired || 0),
    additionalInstructions: bk.additionalInstructions,
    isHazardous: bk.isHazardous,
    isFragile: bk.isFragile,
    requiresTemperatureControl: bk.requiresTemperatureControl,
    driver: bk.driver ? { _id: bk.driver._id || bk.driver, name: bk.driver.name, phone: bk.driver.phone } : undefined,
    vehicle: bk.vehicle ? { _id: bk.vehicle._id || bk.vehicle, vehicleNumber: bk.vehicle.vehicleNumber, truckType: bk.vehicle.truckType } : undefined,
    assignedAt: bk.assignedAt,
    statusHistory: bk.statusHistory || [],
    interestedCount: (bk.interestedDrivers || []).length,
    images: bk.cargoDocuments || bk.images || [],
    createdAt: bk.createdAt,
    updatedAt: bk.updatedAt
  };
};

export const getAllBookings = asyncHandler(async (req, res) => {
  const {
    customerId,
    driverId,
    status,
    paymentStatus,
    startDate,
    endDate,
    dateFrom,
    dateTo,
    truckType,
    podPending,
    city,
    search,
    page,
    limit,
    sort
  } = req.query;

  const filters = {
    customerId,
    driverId,
    status: status ? status.split(',') : undefined,
    paymentStatus,
    startDate: startDate || dateFrom,
    endDate: endDate || dateTo,
    truckType: truckType ? truckType.split(',') : undefined,
    podPending: podPending === 'true' ? true : podPending === 'false' ? false : undefined,
    city,
    search
  };

  const pagination = { page, limit, sort };

  const result = await BookingService.getBookings(filters, pagination, {});

  // Support multiple paginate shapes
  let docs = [];
  let p = {};
  if (Array.isArray(result)) docs = result;
  else if (Array.isArray(result.data)) docs = result.data, p = result.pagination || {};
  else if (Array.isArray(result.docs)) docs = result.docs, p = { page: result.page, limit: result.limit, total: result.totalDocs };
  else if (Array.isArray(result.results)) docs = result.results, p = { page: result.page, limit: result.limit, total: result.totalDocs };

  const distanceMap = {};
  await Promise.all(docs.map(async (b) => {
    distanceMap[b._id] = await TrackingService.calculateDistanceTraveled(b._id);
  }));

  const bookings = docs.map(b => ({
    ...mapBooking(b),
    distanceTraveled: distanceMap[b._id] ?? 0
  }));

  const paginationRes = {
    currentPage: p.page || result.page || 1,
    totalPages: p.pages || result.pages || Math.ceil((p.total || result.total || 0) / (p.limit || result.limit || 20)),
    totalItems: p.total || result.total || result.totalDocs || 0,
    itemsPerPage: p.limit || result.limit || 20
  };

  return res.status(200).json(
    new ApiResponse(200, { bookings, pagination: paginationRes }, 'Bookings fetched successfully')
  );
});

/**
 * Get Available Loads (unassigned bookings for drivers to browse)
 * GET /api/v1/bookings/available-loads
 * Fix 6
 */
export const getAvailableLoads = asyncHandler(async (req, res) => {
  const { city, pickupCity, dropCity, truckType, latitude, longitude, radius, loadDate, page, limit } = req.query;

  // Resolve current driver ObjectId to pre-filter by their fleet capabilities
  let currentDriverId = null;
  try {
    const d = await Driver.findOne({ user: req.user._id }).select('_id').lean();
    if (d) currentDriverId = d._id;
  } catch (_) { /* non-driver callers */ }

  const result = await BookingService.getAvailableLoads({
    city,
    pickupCity,
    dropCity,
    truckType,
    latitude,
    longitude,
    radius,
    loadDate,
    driverId: currentDriverId,
    page,
    limit
  });

  const docs = Array.isArray(result.data) ? result.data
    : Array.isArray(result.docs) ? result.docs
    : Array.isArray(result.results) ? result.results
    : [];

  const loads = docs.map(b => {
    const mapped = mapBooking(b);
    mapped.alreadyInterested = currentDriverId
      ? (b.interestedDrivers || []).some(id => String(id) === String(currentDriverId))
      : false;
    return mapped;
  });

  return res.status(200).json(
    new ApiResponse(200, {
      loads,
      pagination: {
        page: result.page || result.pagination?.page || 1,
        limit: result.limit || result.pagination?.limit || 20,
        total: result.totalDocs || result.pagination?.total || docs.length,
        pages: result.totalPages || result.pagination?.pages || 1
      }
    }, 'Available loads fetched')
  );
});

/**
 * Express Driver Interest in a Load
 * POST /api/v1/bookings/:id/express-interest
 * Fix 7
 */
export const expressInterest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  // Resolve driver profile ID from user
  const driver = await Driver.findOne({ user: userId, isDeleted: false }).select('_id');
  if (!driver) throw new ApiError(404, 'Driver profile not found');

  await BookingService.expressInterest(id, driver._id);

  return res.status(200).json(
    new ApiResponse(200, null, 'Interest submitted successfully')
  );
});

/**
 * Get Booking by ID
 * GET /api/v1/bookings/:id
 */
export const getBookingById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid booking ID format');
  }

  const userId = req.user._id;
  const userRole = req.user.role;

  const booking = await BookingService.getBookingById(id, userId, userRole);
  const distanceTraveled = await TrackingService.calculateDistanceTraveled(booking._id);

  return res.status(200).json(
    new ApiResponse(200, { ...booking.toObject(), distanceTraveled }, 'Booking fetched successfully')
  );
});

/**
 * Update Booking Status
 * PATCH /api/v1/bookings/:id/status
 */
export const updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid booking ID format');
  }

  const { status, note } = req.body;
  const userId = req.user._id;

  const booking = await BookingService.updateStatus(id, status, userId, { note });

  return res.status(200).json(
    new ApiResponse(200, booking, 'Booking status updated successfully')
  );
});

/**
 * Update Booking Details
 * PATCH /api/v1/bookings/:id
 */
export const updateBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid booking ID format');
  }

  const updateData = req.body;
  const userId = req.user._id;

  const booking = await BookingService.updateBooking(id, updateData, userId);

  return res.status(200).json(
    new ApiResponse(200, booking, 'Booking updated successfully')
  );
});

/**
 * Assign Driver to Booking
 * POST /api/v1/bookings/:id/assign-driver
 */
export const assignDriver = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { driverId, vehicleId } = req.body;
  const userId = req.user._id;

  const booking = await BookingService.assignDriver(id, driverId, vehicleId, userId);

  return res.status(200).json(
    new ApiResponse(200, booking, 'Driver assigned successfully')
  );
});

/**
 * Get Dashboard Activities
 * GET /api/v1/bookings/dashboard/activities
 */
export const getActivities = asyncHandler(async (req, res) => {
  const { limit } = req.query;
  const activities = await BookingService.getDashboardActivities({ limit: limit ? parseInt(limit) : 20 });
  return res.status(200).json(new ApiResponse(200, activities, 'Activities fetched successfully'));
});

/**
 * Get Booking Trends
 * GET /api/v1/bookings/dashboard/trends
 */
export const getTrends = asyncHandler(async (req, res) => {
  const { days } = req.query;
  const trends = await BookingService.getBookingTrends({ days: days ? parseInt(days) : 7 });
  return res.status(200).json(new ApiResponse(200, trends, 'Trends fetched successfully'));
});

/**
 * Get Status Breakdown
 * GET /api/v1/bookings/dashboard/status
 */
export const getStatusBreakdown = asyncHandler(async (req, res) => {
  const breakdown = await BookingService.getStatusBreakdown();
  return res.status(200).json(new ApiResponse(200, breakdown, 'Status breakdown fetched successfully'));
});

/**
 * Cancel Booking
 * POST /api/v1/bookings/:id/cancel
 */
export const cancelBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user._id;

  const booking = await BookingService.cancelBooking(id, userId, reason);

  return res.status(200).json(
    new ApiResponse(200, booking, 'Booking cancelled successfully')
  );
});

/**
 * Add Delay to Booking
 * POST /api/v1/bookings/:id/delay
 */
export const addDelay = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const delayData = req.body;
  const userId = req.user._id;

  const booking = await BookingService.addDelay(id, delayData, userId);

  return res.status(200).json(
    new ApiResponse(200, booking, 'Delay added successfully')
  );
});

/**
 * Get Booking Statistics
 * GET /api/v1/bookings/stats
 */
export const getStatistics = asyncHandler(async (req, res) => {
  const { startDate, endDate, customerId } = req.query;

  const filters = { startDate, endDate, customerId };

  const stats = await BookingService.getStatistics(filters);

  return res.status(200).json(
    new ApiResponse(200, stats, 'Statistics fetched successfully')
  );
});

/**
 * Get Driver's Bookings
 * GET /api/v1/bookings/driver-bookings
 */
export const getDriverBookings = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { status, page, limit, lrPending } = req.query;

  // Find driver document
  const driver = await Driver.findOne({ user: userId, isDeleted: false });
  if (!driver) {
    throw new ApiError(404, 'Driver profile not found');
  }

  const filters = {
    driverId: driver._id,
    status: status ? status.split(',') : undefined,
    lrPending: lrPending !== undefined ? lrPending === 'true' : undefined,
  };

  const pagination = { page, limit };
  const options = { maskCustomer: true };

  const result = await BookingService.getBookings(filters, pagination, options);

  // Normalize result like other endpoints
  let docs = [];
  let p = {};
  if (Array.isArray(result)) docs = result;
  else if (Array.isArray(result.data)) docs = result.data, p = result.pagination || {};
  else if (Array.isArray(result.docs)) docs = result.docs, p = { page: result.page, limit: result.limit, total: result.totalDocs };

  const distanceMap = {};
  await Promise.all(docs.map(async (b) => {
    distanceMap[b._id] = await TrackingService.calculateDistanceTraveled(b._id);
  }));

  const bookings = docs.map(b => ({
    ...mapBooking(b),
    distanceTraveled: distanceMap[b._id] ?? 0
  }));

  const paginationRes = {
    currentPage: p.page || result.page || 1,
    totalPages: p.pages || result.pages || Math.ceil((p.total || result.total || 0) / (p.limit || result.limit || 20)),
    totalItems: p.total || result.total || result.totalDocs || 0,
    itemsPerPage: p.limit || result.limit || 20
  };

  return res.status(200).json(
    new ApiResponse(200, { bookings, pagination: paginationRes }, 'Bookings fetched successfully')
  );
});
