import express from 'express';
import * as accountController from '../controllers/account.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { requireDeleteApproval } from '../middlewares/requireDeleteApproval.js';

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

// Get primary account (staff can view)
router.get(
  '/primary',
  requirePermission('account', 'read'),
  accountController.getPrimaryAccount
);

// Super-admin only routes
router.get(
  '/',
  requirePermission('staff', 'manage'),
  accountController.getAccounts
);

router.get(
  '/:id',
  requirePermission('staff', 'manage'),
  accountController.getAccount
);

router.post(
  '/',
  requirePermission('staff', 'manage'),
  accountController.createAccount
);

router.patch(
  '/:id',
  requirePermission('staff', 'manage'),
  accountController.updateAccount
);

router.patch(
  '/:id/primary',
  requirePermission('staff', 'manage'),
  accountController.setPrimaryAccount
);

router.delete(
  '/:id',
  requirePermission('staff', 'manage'),
  requireDeleteApproval('account', 'Account'),
  accountController.deleteAccount
);

export default router;
