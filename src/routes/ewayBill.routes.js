import express from 'express';
import * as ewayBillController from '../controllers/ewayBill.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { validate } from '../middlewares/validation.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import {
  createEwayBillSchema,
  getEwayBillsQuerySchema,
  getEwayBillByIdSchema,
  updatePartBSchema,
  getPartBHistorySchema,
  cancelEwayBillSchema,
  syncEwayBillSchema
} from '../validators/ewayBill.validator.js';

const router = express.Router();

/**
 * All E-way bill routes require authentication and staff role
 */

// Create E-way bill (Staff/Internal/Super-admin only)
router.post(
  '/',
  verifyJWT,
  checkRole('staff', 'internal', 'super-admin'),
  requirePermission('eway-bill', 'create'),
  validate(createEwayBillSchema),
  ewayBillController.createEwayBill
);

// Get all E-way bills with filters (Staff/Internal/Super-admin only)
router.get(
  '/',
  verifyJWT,
  checkRole('staff', 'internal', 'super-admin'),
  requirePermission('eway-bill', 'read'),
  validate(getEwayBillsQuerySchema),
  ewayBillController.getAllEwayBills
);

// Parse an uploaded e-way bill PDF into Create Indent prefill fields
router.post(
  '/parse-pdf',
  verifyJWT,
  checkRole('staff', 'internal', 'super-admin'),
  requirePermission('eway-bill', 'read'),
  upload.single('file'),
  ewayBillController.parseEwayBillPdf
);

// Sync/Find E-way bill by number from portal
router.post(
  '/sync',
  verifyJWT,
  checkRole('staff', 'internal', 'super-admin'),
  requirePermission('eway-bill', 'read'),
  validate(syncEwayBillSchema),
  ewayBillController.syncEwayBill
);

// Get E-way bill by ID (Staff/Internal/Super-admin only)
router.get(
  '/:id',
  verifyJWT,
  checkRole('staff', 'internal', 'super-admin'),
  requirePermission('eway-bill', 'read'),
  validate(getEwayBillByIdSchema),
  ewayBillController.getEwayBillById
);

// Update Part-B (Requires special permission - account department only)
router.put(
  '/:id/part-b',
  verifyJWT,
  checkRole('staff', 'internal', 'super-admin'),
  requirePermission('eway-bill', 'update-part-b'),
  validate(updatePartBSchema),
  ewayBillController.updatePartB
);

// Get Part-B history (Staff/Internal/Super-admin only)
router.get(
  '/:id/history',
  verifyJWT,
  checkRole('staff', 'internal', 'super-admin'),
  requirePermission('eway-bill', 'read'),
  validate(getPartBHistorySchema),
  ewayBillController.getPartBHistory
);

// Cancel E-way bill (Staff/Internal/Super-admin only)
router.patch(
  '/:id/cancel',
  verifyJWT,
  checkRole('staff', 'internal', 'super-admin'),
  requirePermission('eway-bill', 'cancel'),
  validate(cancelEwayBillSchema),
  ewayBillController.cancelEwayBill
);

export default router;
