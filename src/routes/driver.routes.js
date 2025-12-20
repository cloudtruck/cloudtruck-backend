import express from 'express';
import * as driverController from '../controllers/driver.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  createDriverSchema,
  getDriversQuerySchema,
  driverIdParamSchema,
  updateDriverSchema,
  updateLocationSchema,
  updateAvailabilitySchema,
  addRatingSchema,
  blacklistDriverSchema,
  getPerformanceQuerySchema,
  getNearbyDriversQuerySchema
} from '../validators/driver.validator.js';

const router = express.Router();

// Public/Staff routes
router.get('/nearby', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(getNearbyDriversQuerySchema), driverController.getNearbyDrivers);

// Driver self-service routes
router.post('/', verifyJWT, checkRole('driver'), validate(createDriverSchema), driverController.createDriver);
router.get('/my-profile', verifyJWT, checkRole('driver'), driverController.getMyProfile);
router.get('/my-performance', verifyJWT, checkRole('driver'), validate(getPerformanceQuerySchema), driverController.getMyPerformance);
router.post('/my-location', verifyJWT, checkRole('driver'), validate(updateLocationSchema), driverController.updateMyLocation);
router.patch('/my-availability', verifyJWT, checkRole('driver'), validate(updateAvailabilitySchema), driverController.updateMyAvailability);

// Staff/Admin routes - list and view
router.get('/', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(getDriversQuerySchema), driverController.getAllDrivers);
router.get('/:id', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(driverIdParamSchema), driverController.getDriverById);
router.get('/:id/performance', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(getPerformanceQuerySchema), driverController.getPerformanceReport);

// Staff/Admin routes - update
router.patch('/:id', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(updateDriverSchema), driverController.updateDriver);
router.post('/:id/location', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(updateLocationSchema), driverController.updateLocation);
router.patch('/:id/availability', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(updateAvailabilitySchema), driverController.updateAvailability);

// Staff/Admin routes - verification and management
router.post('/:id/verify', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(driverIdParamSchema), driverController.verifyDriver);
router.post('/:id/blacklist', verifyJWT, checkRole('internal', 'super-admin'), validate(blacklistDriverSchema), driverController.blacklistDriver);
router.post('/:id/remove-blacklist', verifyJWT, checkRole('internal', 'super-admin'), validate(driverIdParamSchema), driverController.removeFromBlacklist);

// Customer or Staff - add rating
router.post('/:id/rating', verifyJWT, checkRole('customer', 'staff', 'internal', 'super-admin'), validate(addRatingSchema), driverController.addRating);

// Admin only - delete
router.delete('/:id', verifyJWT, checkRole('super-admin'), validate(driverIdParamSchema), driverController.deleteDriver);

export default router;
