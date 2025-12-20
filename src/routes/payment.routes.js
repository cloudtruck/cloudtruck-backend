import express from 'express';
import * as paymentController from '../controllers/payment.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  createPaymentSchema,
  initiatePaymentSchema,
  verifyPaymentParamsSchema,
  manualPaymentSchema,
  refundPaymentSchema,
  getPaymentsQuerySchema,
  paymentIdParamSchema
} from '../validators/payment.validator.js';

const router = express.Router();

// PhonePe callback (no auth required)
router.post('/phonepe/callback', paymentController.phonePeCallback);

// All other routes require authentication
router.use(verifyJWT);

// Customer routes
router.post('/', checkRole('customer'), validate(createPaymentSchema), paymentController.createPaymentOrder);
router.post('/initiate', checkRole('customer'), validate(initiatePaymentSchema), paymentController.initiatePhonePePayment);
router.get('/my-payments', checkRole('customer'), paymentController.getMyPayments);

// Verify payment status
router.get('/verify/:merchantTransactionId', validate(verifyPaymentParamsSchema), paymentController.verifyPayment);

// Staff/Admin routes
router.post(
  '/manual',
  checkRole('staff', 'internal', 'super-admin'),
  validate(manualPaymentSchema),
  paymentController.recordManualPayment
);

router.post(
  '/:paymentId/refund',
  checkRole('internal', 'super-admin'),
  validate(refundPaymentSchema),
  paymentController.initiateRefund
);

router.get(
  '/',
  checkRole('staff', 'internal', 'super-admin'),
  validate(getPaymentsQuerySchema),
  paymentController.getAllPayments
);

router.get('/:id', checkRole('customer', 'staff', 'internal', 'super-admin'), validate(paymentIdParamSchema), paymentController.getPaymentById);

export default router;
