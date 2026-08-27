import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { checkRole } from '../middlewares/roleCheck.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import { requireDeleteApproval } from '../middlewares/requireDeleteApproval.js';
import {
  createSupplierSchema,
  updateSupplierSchema,
  getSuppliersQuerySchema,
  addDriverToFleetSchema,
  addVehicleToFleetSchema,
  createFleetVehicleSchema,
  rejectSupplierSchema,
  blacklistSupplierSchema,
} from '../validators/supplier.validator.js';
import {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  verifySupplier,
  rejectSupplier,
  blacklistSupplier,
  removeFromBlacklist,
  addDriverToFleet,
  removeDriverFromFleet,
  addVehicleToFleet,
  removeVehicleFromFleet,
  getFleetDrivers,
  getFleetVehicles,
  getSupplierBookings,
  getSupplierDashboard,
  getMyProfile,
  updateMyProfile,
  uploadSupplierDocument,
  addBankAccount,
  updateBankAccount,
  removeBankAccount,
  getAvailableDrivers,
  addMyFleetDriver,
  addMyFleetVehicle,
} from '../controllers/supplier.controller.js';

const router = Router();

const isStaff = checkRole('staff', 'internal', 'super-admin');
const isSupplier = checkRole('supplier');
const isSupplierOrStaff = checkRole('supplier', 'staff', 'internal', 'super-admin');

router.use(verifyJWT);

// ── Self-service routes (company owner) — MUST be before /:id ──────────────
router.get('/my-profile',         isSupplier,        getMyProfile);
router.patch('/my-profile',       isSupplier,        validate(updateSupplierSchema), updateMyProfile);
router.get('/my-bookings',        isSupplier,        getSupplierBookings);
router.get('/my-dashboard',       isSupplier,        getSupplierDashboard);
router.get('/my-fleet/drivers',   isSupplier,        getFleetDrivers);
router.post('/my-fleet/drivers',  isSupplier,        validate(addDriverToFleetSchema), addMyFleetDriver);
router.get('/my-fleet/vehicles',  isSupplier,        getFleetVehicles);
router.post('/my-fleet/vehicles', isSupplier,        validate(createFleetVehicleSchema), addMyFleetVehicle);

// ── Admin CRUD ──────────────────────────────────────────────────────────────
router.get('/',   isStaff, validate(getSuppliersQuerySchema), getAllSuppliers);
router.post('/',  isStaff, validate(createSupplierSchema),    createSupplier);

// ── Document upload (must be before /:id to avoid path collision) ───────────
router.post('/:id/documents/:docType', isStaff, upload.single('file'), uploadSupplierDocument);

// ── Parameterised routes ────────────────────────────────────────────────────
router.get('/:id',    isSupplierOrStaff, getSupplierById);
router.patch('/:id',  isStaff,           validate(updateSupplierSchema), updateSupplier);
router.delete('/:id', checkRole('super-admin', 'internal', 'staff'), requireDeleteApproval('supplier', 'Supplier'), deleteSupplier);

// Verification actions
router.post('/:id/verify',          isStaff, verifySupplier);
router.post('/:id/reject',          isStaff, validate(rejectSupplierSchema),     rejectSupplier);
router.post('/:id/blacklist',       isStaff, validate(blacklistSupplierSchema),  blacklistSupplier);
router.post('/:id/remove-blacklist',isStaff, removeFromBlacklist);

// Fleet management
router.get('/:id/fleet/drivers',                isSupplierOrStaff, getFleetDrivers);
router.post('/:id/fleet/drivers',               isStaff,           validate(addDriverToFleetSchema), addDriverToFleet);
router.delete('/:id/fleet/drivers/:driverId',   isStaff,           removeDriverFromFleet);
router.get('/:id/fleet/vehicles',               isSupplierOrStaff, getFleetVehicles);
router.post('/:id/fleet/vehicles',              isStaff,           validate(addVehicleToFleetSchema), addVehicleToFleet);
router.delete('/:id/fleet/vehicles/:vehicleId', isStaff,           removeVehicleFromFleet);
router.get('/:id/bookings',                   isSupplierOrStaff, getSupplierBookings);
router.get('/:id/dashboard',                  isSupplierOrStaff, getSupplierDashboard);
router.get('/:id/available-drivers',          isSupplierOrStaff, getAvailableDrivers);

// Bank account CRUD
router.post('/:id/bank-accounts',                        isStaff, addBankAccount);
router.patch('/:id/bank-accounts/:accountId',            isStaff, updateBankAccount);
router.delete('/:id/bank-accounts/:accountId',           isStaff, removeBankAccount);

export default router;
