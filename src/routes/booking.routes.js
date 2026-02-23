import express from 'express';
import * as bookingController from '../controllers/booking.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import {
  createBookingSchema,
  getBookingsQuerySchema,
  updateStatusSchema,
  updateBookingSchema,
  assignDriverSchema,
  cancelBookingSchema,
  addDelaySchema,
  getStatsQuerySchema
} from '../validators/booking.validator.js';

const router = express.Router();

// Truck types for booking form (any authenticated user)
router.get('/truck-types', verifyJWT, bookingController.getTruckTypes);

// Common creation route (Customer/Staff/Admin)
router.post('/', verifyJWT, checkRole('customer', 'staff', 'internal', 'super-admin'), upload.array('cargoImages', 10), validate(createBookingSchema), bookingController.createBooking);

// Driver routes
router.get('/driver-bookings', verifyJWT, checkRole('driver'), bookingController.getDriverBookings);

// Staff/Admin routes
router.get('/stats', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(getStatsQuerySchema), bookingController.getStatistics);

// Dashboard endpoints
router.get('/dashboard/activities', verifyJWT, checkRole('staff', 'internal', 'super-admin'), bookingController.getActivities);
router.get('/dashboard/trends', verifyJWT, checkRole('staff', 'internal', 'super-admin'), bookingController.getTrends);
router.get('/dashboard/status', verifyJWT, checkRole('staff', 'internal', 'super-admin'), bookingController.getStatusBreakdown);

// Common protected routes
router.get('/', verifyJWT, validate(getBookingsQuerySchema), bookingController.getAllBookings);
router.get('/:id', verifyJWT, bookingController.getBookingById);

// Staff only - booking updates
router.patch(
  '/:id',
  verifyJWT,
  checkRole('staff', 'internal', 'super-admin'),
  validate(updateBookingSchema),
  bookingController.updateBooking
);

// Staff only - status updates
router.patch(
  '/:id/status',
  verifyJWT,
  checkRole('staff', 'driver', 'internal', 'super-admin'),
  validate(updateStatusSchema),
  bookingController.updateStatus
);

// Staff only - driver assignment
router.post(
  '/:id/assign-driver',
  verifyJWT,
  checkRole('staff', 'internal', 'super-admin'),
  validate(assignDriverSchema),
  bookingController.assignDriver
);

// Customer or Staff - cancel booking
router.post(
  '/:id/cancel',
  verifyJWT,
  checkRole('customer', 'staff', 'internal', 'super-admin'),
  validate(cancelBookingSchema),
  bookingController.cancelBooking
);

// Driver or Staff - add delay
router.post(
  '/:id/delay',
  verifyJWT,
  checkRole('driver', 'staff', 'internal', 'super-admin'),
  validate(addDelaySchema),
  bookingController.addDelay
);

export default router;
