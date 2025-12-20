import BookingService from '../services/booking.service.js';
import Customer from '../models/customer.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';

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
export const getAllBookings = asyncHandler(async (req, res) => {
  const {
    customerId,
    driverId,
    status,
    startDate,
    endDate,
    truckType,
    city,
    page,
    limit,
    sort
  } = req.query;

  const filters = {
    customerId,
    driverId,
    status: status ? status.split(',') : undefined,
    startDate,
    endDate,
    truckType,
    city
  };

  const pagination = { page, limit, sort };

  const result = await BookingService.getBookings(filters, pagination);

  return res.status(200).json(
    new ApiResponse(200, result, 'Bookings fetched successfully')
  );
});

/**
 * Get Booking by ID
 * GET /api/v1/bookings/:id
 */
export const getBookingById = asyncHandler(async (req, res) => {
  const { id } = req.params;
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
  const { status, note } = req.body;
  const userId = req.user._id;

  const booking = await BookingService.updateStatus(id, status, userId, { note });

  return res.status(200).json(
    new ApiResponse(200, booking, 'Booking status updated successfully')
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

  return res.status(200).json(
    new ApiResponse(200, result, 'Bookings fetched successfully')
  );
});

/**
 * Get Driver's Bookings
 * GET /api/v1/bookings/driver-bookings
 */
export const getDriverBookings = asyncHandler(async (req, res) => {
  const driverId = req.user._id;
  const { status, page, limit } = req.query;

  const filters = {
    driverId,
    status: status ? status.split(',') : undefined
  };

  const pagination = { page, limit };

  const result = await BookingService.getBookings(filters, pagination);

  return res.status(200).json(
    new ApiResponse(200, result, 'Bookings fetched successfully')
  );
});
