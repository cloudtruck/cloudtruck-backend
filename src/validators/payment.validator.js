import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Create Payment Validator
 * POST /api/v1/payments
 */
export const createPaymentSchema = z.object({
  body: z.object({
    // Prefer bookingId; keep `booking` as a backward-compatible alias.
    bookingId: z.string().regex(objectIdRegex, 'Invalid booking ID').optional(),
    booking: z.string().regex(objectIdRegex, 'Invalid booking ID').optional(),
    amount: z.number().positive('Amount must be positive'),
    // This endpoint creates an online payment order (PhonePe only for now)
    gateway: z.enum(['phonepe']).optional(),
    returnUrl: z.string().url('Invalid return URL').optional(),
    notes: z.string().optional()
  }).refine((body) => Boolean(body.bookingId || body.booking), {
    message: 'bookingId is required',
    path: ['bookingId']
  })
});

/**
 * Initiate Payment Validator
 * POST /api/v1/payments/initiate
 */
export const initiatePaymentSchema = z.object({
  body: z.object({
    paymentId: z.string().regex(objectIdRegex, 'Invalid payment ID'),
    returnUrl: z.string().url('Invalid return URL').optional()
  })
});

/**
 * Verify Payment Validator
 * POST /api/v1/payments/verify
 */
export const verifyPaymentParamsSchema = z.object({
  params: z.object({
    merchantTransactionId: z.string().min(1, 'Merchant transaction ID is required')
  })
});

/**
 * PhonePe Callback Validator
 * POST /api/v1/payments/phonepe/callback
 */
export const phonePeCallbackSchema = z.object({
  body: z.object({
    merchantTransactionId: z.string(),
    transactionId: z.string(),
    amount: z.number(),
    state: z.string(),
    responseCode: z.string()
  })
});

/**
 * Manual Payment Validator
 * POST /api/v1/payments/manual
 */
export const manualPaymentSchema = z.object({
  body: z.object({
    // Prefer bookingId; keep `booking` as a backward-compatible alias.
    bookingId: z.string().regex(objectIdRegex, 'Invalid booking ID').optional(),
    booking: z.string().regex(objectIdRegex, 'Invalid booking ID').optional(),
    customerId: z.string().regex(objectIdRegex, 'Invalid customer ID'),
    amount: z.number().positive('Amount must be positive'),
    paymentMethod: z.enum(['neft', 'rtgs', 'cheque', 'cash']),
    referenceNumber: z.string().optional(),
    bankName: z.string().optional(),
    chequeNumber: z.string().optional(),
    chequeDate: z.string().datetime().optional(),
    transactionDate: z.string().datetime().optional(),
    remarks: z.string().optional(),
    notes: z.string().optional()
  }).refine((body) => Boolean(body.bookingId || body.booking), {
    message: 'bookingId is required',
    path: ['bookingId']
  })
});

/**
 * Refund Payment Validator
 * POST /api/v1/payments/:id/refund
 */
export const refundPaymentSchema = z.object({
  params: z.object({
    paymentId: z.string().regex(objectIdRegex, 'Invalid payment ID')
  }),
  body: z.object({
    // Prefer refundAmount; keep `amount` as a backward-compatible alias.
    refundAmount: z.number().positive('Refund amount must be positive').optional(),
    amount: z.number().positive('Refund amount must be positive').optional(),
    reason: z.string().min(10, 'Refund reason must be at least 10 characters')
  })
});

/**
 * Get Payments Query Validator
 * GET /api/v1/payments
 */
export const getPaymentsQuerySchema = z.object({
  query: z.object({
    bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    customerId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    status: z.string().optional(),
    paymentMethod: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    // Backward-compatible aliases
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sort: z.string().optional()
  })
});

/**
 * Payment ID Param Validator
 */
export const paymentIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid payment ID')
  })
});

/**
 * Reconcile Payment Validator
 * POST /api/v1/payments/:id/reconcile
 */
export const reconcilePaymentSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid payment ID')
  }),
  body: z.object({
    reconciledAmount: z.number().positive('Reconciled amount must be positive'),
    reconciledBy: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
    notes: z.string().optional()
  })
});
