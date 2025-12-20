import express from 'express';
import * as staffController from '../controllers/staff.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  createStaffSchema,
  getStaffQuerySchema,
  staffIdParamSchema,
  updateStaffSchema,
  assignPermissionsSchema,
  hasPermissionParamSchema,
  getPerformanceQuerySchema,
  setActiveStatusSchema
} from '../validators/staff.validator.js';

const router = express.Router();

// Staff self-service routes
router.get('/my-profile', verifyJWT, checkRole('staff', 'internal', 'super-admin'), staffController.getMyProfile);
router.get('/my-workload', verifyJWT, checkRole('staff', 'internal', 'super-admin'), staffController.getMyWorkload);
router.get('/my-performance', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(getPerformanceQuerySchema), staffController.getMyPerformance);
router.get('/my-team', verifyJWT, checkRole('staff', 'internal', 'super-admin'), staffController.getMyTeam);

// Staff/Admin routes - list and view
router.get('/', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(getStaffQuerySchema), staffController.getAllStaff);
router.get('/:id', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(staffIdParamSchema), staffController.getStaffById);
router.get('/:id/workload', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(staffIdParamSchema), staffController.getWorkload);
router.get('/:id/performance', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(getPerformanceQuerySchema), staffController.getPerformanceMetrics);
router.get('/:id/team', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(staffIdParamSchema), staffController.getTeam);
router.get('/:id/has-permission/:permissionKey', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(hasPermissionParamSchema), staffController.hasPermission);

// Admin only - create and manage
router.post('/', verifyJWT, checkRole('internal', 'super-admin'), validate(createStaffSchema), staffController.createStaff);
router.patch('/:id', verifyJWT, checkRole('internal', 'super-admin'), validate(updateStaffSchema), staffController.updateStaff);
router.post('/:id/permissions', verifyJWT, checkRole('internal', 'super-admin'), validate(assignPermissionsSchema), staffController.assignPermissions);
router.patch('/:id/active-status', verifyJWT, checkRole('internal', 'super-admin'), validate(setActiveStatusSchema), staffController.setActiveStatus);

// Super admin only - delete
router.delete('/:id', verifyJWT, checkRole('super-admin'), validate(staffIdParamSchema), staffController.deleteStaff);

export default router;
