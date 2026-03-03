import express from 'express';
import rateLimit from 'express-rate-limit';
import * as trackingController from '../controllers/tracking.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  recordLocationSchema,
  bookingIdParamSchema,
  getTrackingHistorySchema,
  getTrackingRouteSchema
} from '../validators/tracking.validator.js';

// Rate limiter for the HTTP location endpoint:
// mirrors the WebSocket throttle (1 update per 10s), keyed per driver.
const locationRateLimit = rateLimit({
  windowMs: 10 * 1000,   // 10-second window
  max: 1,                // 1 request per window per driver
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 429, message: 'Location update rate limit exceeded. Max 1 update per 10 seconds.' }
});

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

// Get all live trips (staff only)
router.get('/live-trips', checkRole('staff', 'internal', 'super-admin'), trackingController.getLiveTrips);

// Record location (driver only) — rate limited to 1 update per 10s per driver
router.post('/:bookingId/location', checkRole('driver'), locationRateLimit, validate(recordLocationSchema), trackingController.recordLocation);

// Get tracking data (customer, driver, staff)
router.get('/:bookingId/history', validate(getTrackingHistorySchema), trackingController.getTrackingHistory);

router.get('/:bookingId/last-location', validate(bookingIdParamSchema), trackingController.getLastKnownLocation);

router.get('/:bookingId/url', checkRole('customer', 'staff', 'internal', 'super-admin'), validate(bookingIdParamSchema), trackingController.getTrackingUrl);

router.get('/:bookingId/distance', validate(bookingIdParamSchema), trackingController.getDistanceTraveled);

router.get('/:bookingId/statistics', checkRole('staff', 'internal', 'super-admin'), validate(bookingIdParamSchema), trackingController.getTrackingStatistics);

router.get('/:bookingId/route', validate(getTrackingRouteSchema), trackingController.getTrackingRoute);

// Get planned route for booking
router.get('/:bookingId/planned-route', validate(bookingIdParamSchema), trackingController.getPlannedRoute);

// Unified tracking summary for customer tracking screen
router.get('/:bookingId/summary', validate(bookingIdParamSchema), trackingController.getTrackingSummary);

export default router;
