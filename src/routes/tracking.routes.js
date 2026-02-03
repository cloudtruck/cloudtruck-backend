import express from 'express';
import * as trackingController from '../controllers/tracking.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  recordLocationSchema,
  bookingIdParamSchema,
  getTrackingHistorySchema,
  getTrackingRouteSchema
} from '../validators/tracking.validator.js';

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

// Get all live trips (staff only)
router.get('/live-trips', checkRole('staff', 'internal', 'super-admin'), trackingController.getLiveTrips);

// Record location (driver only)
router.post('/:bookingId/location', checkRole('driver'), validate(recordLocationSchema), trackingController.recordLocation);

// Get tracking data (customer, driver, staff)
router.get('/:bookingId/history', validate(getTrackingHistorySchema), trackingController.getTrackingHistory);

router.get('/:bookingId/last-location', validate(bookingIdParamSchema), trackingController.getLastKnownLocation);

router.get('/:bookingId/url', checkRole('customer', 'staff', 'internal', 'super-admin'), validate(bookingIdParamSchema), trackingController.getTrackingUrl);

router.get('/:bookingId/distance', validate(bookingIdParamSchema), trackingController.getDistanceTraveled);

router.get('/:bookingId/statistics', checkRole('staff', 'internal', 'super-admin'), validate(bookingIdParamSchema), trackingController.getTrackingStatistics);

router.get('/:bookingId/route', validate(getTrackingRouteSchema), trackingController.getTrackingRoute);

// Get planned route for booking
router.get('/:bookingId/planned-route', validate(bookingIdParamSchema), trackingController.getPlannedRoute);

export default router;
