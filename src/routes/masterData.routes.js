import express from 'express';
import * as masterDataController from '../controllers/masterData.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

// Get categories (staff can view)
router.get('/categories', masterDataController.getCategories);

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
  masterDataController.updateMasterData
);

router.delete(
  '/:id',
  requirePermission('staff', 'manage'),
  masterDataController.deleteMasterData
);

export default router;
