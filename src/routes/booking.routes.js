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
  getStatsQuerySchema,
  getAvailableLoadsQuerySchema,
  getUnloadingTrucksQuerySchema
} from '../validators/booking.validator.js';

const router = express.Router();

// Truck types for booking form (any authenticated user)
router.get('/truck-types', verifyJWT, bookingController.getTruckTypes);

// Common creation route (Customer/Staff/Admin)
router.post('/', verifyJWT, checkRole('customer', 'staff', 'internal', 'super-admin'), upload.array('cargoImages', 10), validate(createBookingSchema), bookingController.createBooking);

// Driver routes
router.get('/driver-bookings', verifyJWT, checkRole('driver'), bookingController.getDriverBookings);

// Admin: list all payment requests — must be before /:id
router.get('/payment-requests', verifyJWT, checkRole('staff', 'internal', 'super-admin'), bookingController.getAllPaymentRequests);

// Staff/Admin routes
router.get('/stats', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(getStatsQuerySchema), bookingController.getStatistics);

// Dashboard endpoints
router.get('/dashboard/activities', verifyJWT, checkRole('staff', 'internal', 'super-admin'), bookingController.getActivities);
router.get('/dashboard/trends', verifyJWT, checkRole('staff', 'internal', 'super-admin'), bookingController.getTrends);
router.get('/dashboard/status', verifyJWT, checkRole('staff', 'internal', 'super-admin'), bookingController.getStatusBreakdown);
router.get('/dashboard/branch-kpi', verifyJWT, checkRole('staff', 'internal', 'super-admin'), bookingController.getBranchKpi);
router.get('/dashboard/driver-stats', verifyJWT, checkRole('staff', 'internal', 'super-admin'), bookingController.getDriverStats);
router.get('/dashboard/ring-counts', verifyJWT, checkRole('staff', 'internal', 'super-admin'), bookingController.getRingCounts);

// Common protected routes
router.get('/', verifyJWT, validate(getBookingsQuerySchema), bookingController.getAllBookings);

// Available loads for drivers (Fix 6) — must be BEFORE /:id to avoid path collision
router.get('/available-loads', verifyJWT, checkRole('driver', 'staff', 'internal', 'super-admin'), validate(getAvailableLoadsQuerySchema), bookingController.getAvailableLoads);

// Unloading trucks — trucks at destination whose drop city matches indent pickup city
router.get('/unloading-trucks', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(getUnloadingTrucksQuerySchema), bookingController.getUnloadingTrucks);

router.get('/:id', verifyJWT, bookingController.getBookingById);

// Driver invoice — after /:id so it matches /:id/driver-invoice correctly
router.get('/:id/driver-invoice', verifyJWT, checkRole('driver', 'staff', 'internal', 'super-admin'), bookingController.getDriverInvoice);

// LR (Loading Memo) PDF — generate (cached), download stream
router.get('/:id/generate-lr', verifyJWT, checkRole('staff', 'internal', 'super-admin'), bookingController.generateLR);
router.get('/:id/download-lr', verifyJWT, checkRole('staff', 'internal', 'super-admin'), bookingController.downloadLR);

// Invoice PDF — download as stream for staff/admin
router.get('/:id/download-invoice', verifyJWT, checkRole('staff', 'internal', 'super-admin'), bookingController.downloadBookingInvoicePdf);
router.get('/:id/generate-invoice', verifyJWT, checkRole('staff', 'internal', 'super-admin'), bookingController.generateCustomerInvoice);


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

// Driver - express interest in available load (Fix 7)
router.post(
  '/:id/express-interest',
  verifyJWT,
  checkRole('driver', 'staff', 'internal', 'super-admin'),
  bookingController.expressInterest
);

// Driver - request payment for a completed trip
router.post('/:id/request-payment', verifyJWT, checkRole('driver'), bookingController.requestPayment);

// Admin - approve/reject a payment request
router.patch('/:id/payment-requests/:requestId/pay',    verifyJWT, checkRole('staff', 'internal', 'super-admin'), bookingController.processPaymentRequest);
router.patch('/:id/payment-requests/:requestId/reject', verifyJWT, checkRole('staff', 'internal', 'super-admin'), bookingController.processPaymentRequest);

// Staff/Admin - trip comments/notes
router.post('/:id/notes', verifyJWT, checkRole('staff', 'internal', 'super-admin'), bookingController.addBookingNote);

// Staff/Admin - booking audit log history
router.get('/:id/audit-logs', verifyJWT, checkRole('staff', 'internal', 'super-admin'), bookingController.getBookingAuditLogs);

export default router;
