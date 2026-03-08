import express from 'express';
import * as vehicleController from '../controllers/vehicle.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  createVehicleSchema,
  getVehiclesQuerySchema,
  vehicleIdParamSchema,
  driverIdParamSchema,
  updateVehicleSchema,
  verifyVehicleSchema,
  updateLocationSchema,
  updateAvailabilitySchema,
  addMaintenanceSchema,
  getAvailableVehiclesQuerySchema,
  updateMyTruckSchema,
  rejectVehicleSchema
} from '../validators/vehicle.validator.js';

const router = express.Router();

// Get vehicles belonging to a driver
router.get('/driver/:driverId', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(driverIdParamSchema), vehicleController.getVehiclesByDriver);

// Driver self-service: Get personal fleet
router.get('/my-trucks', verifyJWT, checkRole('driver'), vehicleController.getMyTrucks);

// Driver self-service: Get single truck detail (with PAN + TDS)
router.get('/my-trucks/:vehicleId', verifyJWT, checkRole('driver'), vehicleController.getMyTruckDetail);

// Driver self-service: Update single truck
router.patch('/my-trucks/:vehicleId', verifyJWT, checkRole('driver'), validate(updateMyTruckSchema), vehicleController.updateMyTruck);

// Staff/Admin routes - list and search
router.get('/available', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(getAvailableVehiclesQuerySchema), vehicleController.getAvailableVehicles);
router.get('/stats/all', verifyJWT, checkRole('staff', 'internal', 'super-admin'), vehicleController.getAllVehicleStats);
router.get('/', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(getVehiclesQuerySchema), vehicleController.getAllVehicles);

// Staff/Admin routes - CRUD
router.post('/', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(createVehicleSchema), vehicleController.createVehicle);
router.get('/:id', verifyJWT, checkRole('driver', 'staff', 'internal', 'super-admin'), validate(vehicleIdParamSchema), vehicleController.getVehicleById);
router.get('/:id/stats', verifyJWT, checkRole('driver', 'staff', 'internal', 'super-admin'), validate(vehicleIdParamSchema), vehicleController.getVehicleStats);
router.patch('/:id', verifyJWT, checkRole('driver', 'staff', 'internal', 'super-admin'), validate(updateVehicleSchema), vehicleController.updateVehicle);

// Staff/Admin routes - verification
router.post('/:id/verify', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(verifyVehicleSchema), vehicleController.verifyVehicle);
router.post('/:id/reject', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(rejectVehicleSchema), vehicleController.rejectVehicle);

// Staff/Admin routes - operations
router.post('/:id/location', verifyJWT, checkRole('staff', 'driver', 'internal', 'super-admin'), validate(updateLocationSchema), vehicleController.updateLocation);
router.patch('/:id/availability', verifyJWT, checkRole('driver', 'staff', 'internal', 'super-admin'), validate(updateAvailabilitySchema), vehicleController.updateAvailability);
router.post('/:id/maintenance', verifyJWT, checkRole('driver', 'staff', 'internal', 'super-admin'), validate(addMaintenanceSchema), vehicleController.addMaintenance);

// Admin only - delete
router.delete('/:id', verifyJWT, checkRole('super-admin'), validate(vehicleIdParamSchema), vehicleController.deleteVehicle);

export default router;
