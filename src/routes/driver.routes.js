import express from 'express';
import * as driverController from '../controllers/driver.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  createDriverSchema,
  submitDriverKycSchema,
  submitAccountInfoSchema,
  getDriversQuerySchema,
  driverIdParamSchema,
  // userIdParamSchema used for /by-user/:userId
  userIdParamSchema,
  updateDriverSchema,
  updateLocationSchema,
  updateAvailabilitySchema,
  addRatingSchema,
  blacklistDriverSchema,
  rejectDriverSchema,
  getPerformanceQuerySchema,
  getNearbyDriversQuerySchema,
  getTripHistoryQuerySchema,
  getMyTripHistoryQuerySchema,
  addMyTruckSchema
} from '../validators/driver.validator.js';
import { upload } from '../middlewares/upload.middleware.js';

const router = express.Router();

// Public/Staff routes
router.get('/nearby', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(getNearbyDriversQuerySchema), driverController.getNearbyDrivers);

// Driver self-service + admin-created routes
// Allow drivers to create their own profile, and allow staff/internal/super-admin to create drivers on behalf of others
router.post('/', verifyJWT, checkRole('driver', 'staff', 'internal', 'super-admin'), validate(createDriverSchema), driverController.createDriver);
router.get('/my-profile', verifyJWT, checkRole('driver'), driverController.getMyProfile);
router.post('/my-kyc', verifyJWT, checkRole('driver'), validate(submitDriverKycSchema), driverController.submitKyc);
router.post('/my-truck', verifyJWT, checkRole('driver'), validate(addMyTruckSchema), driverController.addMyTruck);
router.post('/my-account-info', verifyJWT, checkRole('driver'),
  upload.fields([
    { name: 'chequeImage', maxCount: 1 },
    { name: 'tdsDocument', maxCount: 1 },
    { name: 'aadhaarDocument', maxCount: 1 },
    { name: 'panDocument', maxCount: 1 }
  ]),
  validate(submitAccountInfoSchema),
  driverController.submitAccountInfo
);
router.get('/my-performance', verifyJWT, checkRole('driver'), validate(getPerformanceQuerySchema), driverController.getMyPerformance);
router.get('/my-trip-history', verifyJWT, checkRole('driver'), validate(getMyTripHistoryQuerySchema), driverController.getMyTripHistory);
router.post('/my-location', verifyJWT, checkRole('driver'), validate(updateLocationSchema), driverController.updateMyLocation);
router.patch('/my-availability', verifyJWT, checkRole('driver'), validate(updateAvailabilitySchema), driverController.updateMyAvailability);

// Staff/Admin routes - list and view
router.get('/', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(getDriversQuerySchema), driverController.getAllDrivers);
router.get('/available', verifyJWT, checkRole('staff', 'internal', 'super-admin'), driverController.getAvailableDrivers);
// Explicit user-based lookup
router.get('/by-user/:userId', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(userIdParamSchema), driverController.getDriverByUser);
// Primary lookup by driver document id (document-first, then fallback to user)
router.get('/:id', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(driverIdParamSchema), driverController.getDriverById);
router.get('/:id/performance', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(getPerformanceQuerySchema), driverController.getPerformanceReport);
router.get('/:id/trip-history', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(getTripHistoryQuerySchema), driverController.getTripHistory);

// Staff/Admin routes - update
router.patch('/:id', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(updateDriverSchema), driverController.updateDriver);
router.post('/:id/location', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(updateLocationSchema), driverController.updateLocation);
router.patch('/:id/availability', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(updateAvailabilitySchema), driverController.updateAvailability);

// Staff/Admin routes - verification and management
router.post('/:id/verify', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(driverIdParamSchema), driverController.verifyDriver);
router.post('/:id/reject', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(rejectDriverSchema), driverController.rejectDriver);
router.post('/:id/blacklist', verifyJWT, checkRole('internal', 'super-admin'), validate(blacklistDriverSchema), driverController.blacklistDriver);
router.post('/:id/remove-blacklist', verifyJWT, checkRole('internal', 'super-admin'), validate(driverIdParamSchema), driverController.removeFromBlacklist);

// Customer or Staff - add rating
router.post('/:id/rating', verifyJWT, checkRole('customer', 'staff', 'internal', 'super-admin'), validate(addRatingSchema), driverController.addRating);

// Admin only - delete
router.delete('/:id', verifyJWT, checkRole('super-admin'), validate(driverIdParamSchema), driverController.deleteDriver);

export default router;
