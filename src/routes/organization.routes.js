import express from 'express';
import * as organizationController from '../controllers/organization.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

// Get settings (staff can view)
router.get(
  '/settings',
  requirePermission('organization', 'read'),
  organizationController.getSettings
);

// Get next booking number (staff can use)
router.get(
  '/settings/next-booking-number',
  requirePermission('booking', 'create'),
  organizationController.getNextBookingNumber
);

// Super-admin only routes
router.patch(
  '/settings',
  requirePermission('staff', 'manage'),
  organizationController.updateSettings
);

router.patch(
  '/settings/company',
  requirePermission('staff', 'manage'),
  organizationController.updateCompanyInfo
);

router.patch(
  '/settings/booking-config',
  requirePermission('staff', 'manage'),
  organizationController.updateBookingConfig
);

router.patch(
  '/settings/operational',
  requirePermission('staff', 'manage'),
  organizationController.updateOperationalSettings
);

router.patch(
  '/settings/notifications',
  requirePermission('staff', 'manage'),
  organizationController.updateNotificationSettings
);

router.patch(
  '/settings/tax',
  requirePermission('staff', 'manage'),
  organizationController.updateTaxSettings
);

export default router;
