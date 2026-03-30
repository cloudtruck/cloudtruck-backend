import express from 'express';
import * as masterDataController from '../controllers/masterData.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { upload } from '../middlewares/upload.middleware.js';
import { requireDeleteApproval } from '../middlewares/requireDeleteApproval.js';

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

// Get categories (staff can view)
router.get('/categories', masterDataController.getCategories);

// Public reference data — any authenticated user (including drivers) can read
// Used by driver app to populate truck-type and body-type dropdowns
router.get('/public/:category', masterDataController.getMasterDataByCategory);

// Staff can read master data
router.get(
  '/',
  requirePermission('master-data', 'read'),
  masterDataController.getMasterData
);

router.get(
  '/category/:category',
  requirePermission('master-data', 'read'),
  masterDataController.getMasterDataByCategory
);

// Super-admin only routes
router.post(
  '/',
  requirePermission('staff', 'manage'),
  upload.single('image'),
  masterDataController.createMasterData
);

router.patch(
  '/reorder',
  requirePermission('staff', 'manage'),
  masterDataController.reorderMasterData
);

router.patch(
  '/:id',
  requirePermission('staff', 'manage'),
  upload.single('image'),
  masterDataController.updateMasterData
);

router.delete(
  '/:id',
  requirePermission('staff', 'manage'),
  requireDeleteApproval('master-data', 'MasterData'),
  masterDataController.deleteMasterData
);

export default router;
