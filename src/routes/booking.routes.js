import express from 'express';
import * as bookingController from '../controllers/booking.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import {
  createBookingSchema,
  getBookingsQuerySchema,
  bookingIdParamSchema,
  updateStatusSchema,
  assignDriverSchema,
  cancelBookingSchema,
  addDelaySchema,
  getStatsQuerySchema
} from '../validators/booking.validator.js';

const router = express.Router();

// Customer routes
router.post('/', verifyJWT, checkRole('customer'), upload.array('cargoImages', 10), validate(createBookingSchema), bookingController.createBooking);
router.get('/my-bookings', verifyJWT, checkRole('customer'), bookingController.getMyBookings);

// Driver routes
router.get('/driver-bookings', verifyJWT, checkRole('driver'), bookingController.getDriverBookings);

// Staff/Admin routes
router.get('/stats', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(getStatsQuerySchema), bookingController.getStatistics);

// Common protected routes
router.get('/', verifyJWT, validate(getBookingsQuerySchema), bookingController.getAllBookings);
router.get('/:id', verifyJWT, validate(bookingIdParamSchema), bookingController.getBookingById);

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
