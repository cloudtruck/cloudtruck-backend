import BookingService from '../services/booking.service.js';
import Customer from '../models/customer.model.js';
import Driver from '../models/driver.model.js';
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
  const customerId = req.user._id;
  const files = req.files; // multer parsed files (cargoImages)

  const booking = await BookingService.createBooking(bookingData, customerId, files);

  return res.status(201).json(
    new ApiResponse(201, booking, 'Booking created successfully')
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
      address: bk.pickup?.address,
      latLng: bk.pickup?.location || bk.pickup?.latLng
    },
    drop: {
      city: bk.drop?.city,
      address: bk.drop?.address,
      latLng: bk.drop?.location || bk.drop?.latLng
    },
    materialType: bk.materialType,
    weight: bk.weight,
    truckTypeNeeded: bk.truckTypeNeeded,
    bodyType: bk.bodyType,
    loadDateTime: bk.loadDateTime || bk.loadDate || bk.loadDateTime,
    status: bk.status,
    paymentStatus: bk.paymentStatus,
    expectedAmount: bk.expectedAmount,
    advanceRequired: bk.advanceRequired,
    additionalInstructions: bk.additionalInstructions,
    isHazardous: bk.isHazardous,
    isFragile: bk.isFragile,
    requiresTemperatureControl: bk.requiresTemperatureControl,
    driver: bk.driver ? { _id: bk.driver._id || bk.driver, name: bk.driver.name, phone: bk.driver.phone } : undefined,
    vehicle: bk.vehicle ? { _id: bk.vehicle._id || bk.vehicle, vehicleNumber: bk.vehicle.vehicleNumber, truckType: bk.vehicle.truckType } : undefined,
    assignedAt: bk.assignedAt,
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
    truckType,
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

  const bookings = docs.map(mapBooking);

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

  return res.status(200).json(
    new ApiResponse(200, booking, 'Booking fetched successfully')
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
  const assignedBy = req.user._id;

  const booking = await BookingService.assignDriver(id, driverId, vehicleId, assignedBy);

  return res.status(200).json(
    new ApiResponse(200, booking, 'Driver assigned successfully')
  );
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
 * Get My Bookings (Customer)
 * GET /api/v1/bookings/my-bookings
 */
export const getMyBookings = asyncHandler(async (req, res) => {
  // Map authenticated user to their Customer document
  const customerDoc = await Customer.findOne({ user: req.user._id, isDeleted: false });
  if (!customerDoc) {
    throw new ApiError(404, 'Customer profile not found');
  }

  const customerId = customerDoc._id;
  const { status, startDate, endDate, page, limit } = req.query;

  const filters = {
    customerId,
    status: status ? status.split(',') : undefined,
    startDate,
    endDate
  };

  const pagination = { page, limit };

  const result = await BookingService.getBookings(filters, pagination);

  // Support multiple paginate shapes
  let docs = [];
  let p = {};
  if (Array.isArray(result)) docs = result;
  else if (Array.isArray(result.data)) docs = result.data, p = result.pagination || {};
  else if (Array.isArray(result.docs)) docs = result.docs, p = { page: result.page, limit: result.limit, total: result.totalDocs };
  else if (Array.isArray(result.results)) docs = result.results, p = { page: result.page, limit: result.limit, total: result.totalDocs };

  const bookings = docs.map(mapBooking);

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
 * Get Driver's Bookings
 * GET /api/v1/bookings/driver-bookings
 */
export const getDriverBookings = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { status, page, limit } = req.query;

  // Find driver document
  const driver = await Driver.findOne({ user: userId, isDeleted: false });
  if (!driver) {
    throw new ApiError(404, 'Driver profile not found');
  }

  const filters = {
    driverId: driver._id,
    status: status ? status.split(',') : undefined
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

  const bookings = docs.map(mapBooking);

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
