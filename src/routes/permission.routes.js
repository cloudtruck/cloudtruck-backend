import express from 'express';
import * as permissionController from '../controllers/permission.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

// Reading permissions: any authenticated staff/admin (needed for role template UI)
router.get('/grouped', checkRole('staff', 'internal', 'super-admin'), permissionController.getGroupedPermissions);
router.get('/', checkRole('staff', 'internal', 'super-admin'), permissionController.getAllPermissions);
router.get('/:id', checkRole('staff', 'internal', 'super-admin'), permissionController.getPermissionById);

// Managing permissions: internal/super-admin only (or staff with staff.manage)
router.post('/', checkRole('internal', 'super-admin'), requirePermission('staff', 'manage'), permissionController.createPermission);
router.put('/:id', checkRole('internal', 'super-admin'), requirePermission('staff', 'manage'), permissionController.updatePermission);
router.delete('/:id', checkRole('internal', 'super-admin'), requirePermission('staff', 'manage'), permissionController.deletePermission);

export default router;