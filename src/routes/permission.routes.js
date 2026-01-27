import express from 'express';
import * as permissionController from '../controllers/permission.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

// Get all permissions and grouped permissions
router.get('/grouped', permissionController.getGroupedPermissions);
router.get('/', permissionController.getAllPermissions);

// Get permission by ID
router.get('/:id', permissionController.getPermissionById);

// Create new permission (requires admin - add permission check later)
router.post('/', permissionController.createPermission);

// Update permission (requires admin)
router.put('/:id', permissionController.updatePermission);

// Delete permission (requires admin)
router.delete('/:id', permissionController.deletePermission);

export default router;
