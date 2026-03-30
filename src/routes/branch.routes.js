import express from 'express';
import * as branchController from '../controllers/branch.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { requireDeleteApproval } from '../middlewares/requireDeleteApproval.js';

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

// Super-admin only routes
router.get(
  '/',
  requirePermission('staff', 'manage'),
  branchController.getBranches
);

router.get(
  '/:id',
  requirePermission('staff', 'manage'),
  branchController.getBranch
);

router.post(
  '/',
  requirePermission('staff', 'manage'),
  branchController.createBranch
);

router.patch(
  '/:id',
  requirePermission('staff', 'manage'),
  branchController.updateBranch
);

router.delete(
  '/:id',
  requirePermission('staff', 'manage'),
  requireDeleteApproval('branch', 'Branch'),
  branchController.deleteBranch
);

// Employee assignment
router.patch(
  '/:id/employees/:staffId',
  requirePermission('staff', 'manage'),
  branchController.assignEmployee
);

router.delete(
  '/:id/employees/:staffId',
  requirePermission('staff', 'manage'),
  branchController.removeEmployee
);

// Metrics
router.get(
  '/:id/metrics',
  requirePermission('staff', 'manage'),
  branchController.getBranchMetrics
);

export default router;
