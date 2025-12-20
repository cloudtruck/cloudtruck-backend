import express from 'express';
import * as documentController from '../controllers/document.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import {
  uploadDocumentSchema,
  getDocumentsByEntitySchema,
  documentIdParamSchema,
  bookingIdParamSchema,
  getSignedUrlSchema
} from '../validators/document.validator.js';

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

// Upload document
router.post(
  '/',
  checkRole('customer', 'driver', 'staff', 'internal', 'super-admin'),
  upload.single('file'),
  validate(uploadDocumentSchema),
  documentController.uploadDocument
);

// Get documents by entity
router.get(
  '/:entityType/:entityId',
  checkRole('customer', 'driver', 'staff', 'internal', 'super-admin'),
  validate(getDocumentsByEntitySchema),
  documentController.getDocumentsByEntity
);

// Get document by ID
router.get('/:id', validate(documentIdParamSchema), documentController.getDocumentById);

// Delete document
router.delete(
  '/:id',
  checkRole('staff', 'internal', 'super-admin'),
  validate(documentIdParamSchema),
  documentController.deleteDocument
);

// Upload POD for booking
router.post(
  '/booking/:bookingId/pod',
  checkRole('driver', 'staff', 'internal', 'super-admin'),
  upload.single('file'),
  validate(bookingIdParamSchema),
  documentController.uploadPOD
);

// Upload loading images for booking
router.post(
  '/booking/:bookingId/loading-images',
  checkRole('driver', 'staff', 'internal', 'super-admin'),
  upload.array('files', 10),
  validate(bookingIdParamSchema),
  documentController.uploadLoadingImages
);

// Get all documents for booking
router.get('/booking/:bookingId', validate(bookingIdParamSchema), documentController.getBookingDocuments);

// Get signed download URL
router.get('/signed-url/:cloudinaryId', validate(getSignedUrlSchema), documentController.getSignedUrl);

export default router;
