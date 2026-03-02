import PaymentService from '../services/payment.service.js';
import PDFService from '../services/pdf.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import AuditLog from '../models/auditLog.model.js';
import logger from '../utils/logger.js';

const getRequestAuditMetadata = (req) => ({
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
  requestId: req.get('x-request-id')
});

const pickPaymentAuditFields = (payment) => {
  if (!payment) return null;

  const plain = typeof payment.toObject === 'function' ? payment.toObject() : payment;

  return {
    _id: plain._id,
    booking: plain.booking,
    customer: plain.customer,
    amount: plain.amount,
    status: plain.status,
    gateway: plain.gateway,
    paymentMethod: plain.paymentMethod,
    merchantTransactionId: plain.merchantTransactionId,
    transactionId: plain.transactionId,
    paidAt: plain.paidAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    refunds: Array.isArray(plain.refunds)
      ? plain.refunds.slice(-1).map((r) => ({
        amount: r.amount,
        status: r.status,
        merchantTransactionId: r.merchantTransactionId,
        initiatedAt: r.initiatedAt,
        processedAt: r.processedAt
      }))
      : undefined
  };
};

const mapPayment = (p) => {
  if (!p) return null;
  const plain = p.toObject ? p.toObject() : p;

  // Map backend status to frontend paymentStatus
  const statusMap = {
    'pending': 'unpaid',
    'success': 'paid',
    'failed': 'failed',
    'refunded': 'failed'
  };

  const booking = plain.booking;

  return {
    _id: plain._id,
    booking: booking ? {
      _id: booking._id,
      bookingId: booking.bookingId,
      customer: booking.customer ? {
        _id: booking.customer._id || booking.customer,
        companyName: booking.customer.companyName,
        contactPerson: booking.customer.contactPerson ? {
          name: booking.customer.contactPerson.name,
          phone: booking.customer.contactPerson.phone,
          email: booking.customer.contactPerson.email
        } : null
      } : null,
      pickup: booking.pickup,
      drop: booking.drop,
      materialType: booking.materialType,
      truckTypeNeeded: booking.truckTypeNeeded
    } : null,
    customer: plain.customer,
    amount: plain.amount,
    advanceAmount: booking?.advanceRequired,
    balanceAmount: booking ? (booking.expectedAmount - (booking.advanceRequired || 0)) : 0,
    paymentMethod: plain.paymentMethod,
    paymentStatus: statusMap[plain.status] || 'unpaid',
    transactionId: plain.transactionId,
    transactionReference: plain.referenceNumber,
    paidAt: plain.paidAt,
    markedReceivedBy: plain.recordedBy,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    notes: plain.remarks
  };
};

const logPaymentAudit = (req, { action, entityId, before, after, description, severity = 'medium', tags = [] }) => {
  AuditLog.logAction({
    user: req.user?._id,
    action,
    entityType: 'payment',
    entityId,
    changes: {
      before,
      after
    },
    module: 'payments',
    description,
    severity,
    tags,
    ...getRequestAuditMetadata(req)
  });
};

/**
 * Create payment order
 */
export const createPaymentOrder = asyncHandler(async (req, res) => {
  const bookingId = req.body.bookingId || req.body.booking;
  const { amount, returnUrl } = req.body;

  const payment = await PaymentService.createPaymentOrder(bookingId, amount, req.user._id);

  logPaymentAudit(req, {
    action: 'CREATE_PAYMENT',
    entityId: payment._id,
    before: null,
    after: pickPaymentAuditFields(payment),
    description: 'Payment order created',
    severity: 'low'
  });

  // Optional: if client provided returnUrl, initiate payment immediately and return url.
  // This keeps controller thin while supporting a single-call checkout flow.
  if (returnUrl) {
    const initResult = await PaymentService.initiatePhonePePayment(payment._id, returnUrl);

    logPaymentAudit(req, {
      action: 'UPDATE_PAYMENT',
      entityId: payment._id,
      before: null,
      after: {
        paymentId: payment._id,
        merchantTransactionId: initResult?.merchantTransactionId,
        gateway: 'phonepe'
      },
      description: 'PhonePe payment initiated'
    });

    return res.status(201).json(new ApiResponse(201, { payment, ...initResult }, 'Payment order created'));
  }

  return res.status(201).json(new ApiResponse(201, payment, 'Payment order created'));
});

/**
 * Initiate PhonePe payment
 */
export const initiatePhonePePayment = asyncHandler(async (req, res) => {
  const { paymentId } = req.body;
  const returnUrl = req.body.returnUrl || `${process.env.FRONTEND_URL}/payment/callback`;

  const result = await PaymentService.initiatePhonePePayment(paymentId, returnUrl);

  logPaymentAudit(req, {
    action: 'UPDATE_PAYMENT',
    entityId: paymentId,
    before: null,
    after: {
      paymentId,
      merchantTransactionId: result?.merchantTransactionId,
      gateway: 'phonepe'
    },
    description: 'PhonePe payment initiated'
  });

  return res.status(200).json(new ApiResponse(200, result, 'Payment initiated successfully'));
});

/**
 * PhonePe callback handler
 */
export const phonePeCallback = asyncHandler(async (req, res) => {
  const { response, checksum } = req.body;

  const payment = await PaymentService.handlePhonePeCallback({ response, checksum });

  if (payment.status === 'success') {
    return res.redirect(`${process.env.FRONTEND_URL}/payment/success?paymentId=${payment._id}`);
  } else {
    return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?paymentId=${payment._id}`);
  }
});

/**
 * Verify payment status
 */
export const verifyPayment = asyncHandler(async (req, res) => {
  const { merchantTransactionId } = req.params;

  const payment = await PaymentService.verifyPaymentStatus(merchantTransactionId);

  logPaymentAudit(req, {
    action: 'UPDATE_PAYMENT',
    entityId: payment._id,
    before: null,
    after: pickPaymentAuditFields(payment),
    description: 'Payment status verified'
  });

  return res.status(200).json(new ApiResponse(200, payment, 'Payment status verified'));
});

/**
 * Record manual payment
 */
export const recordManualPayment = asyncHandler(async (req, res) => {
  const data = req.body;

  const payment = await PaymentService.recordManualPayment(data, req.user._id);

  logPaymentAudit(req, {
    action: 'MARK_PAYMENT_RECEIVED',
    entityId: payment._id,
    before: null,
    after: pickPaymentAuditFields(payment),
    description: 'Manual payment recorded',
    severity: 'high'
  });

  return res.status(201).json(new ApiResponse(201, payment, 'Manual payment recorded'));
});

/**
 * Initiate refund
 */
export const initiateRefund = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const refundAmount = req.body.refundAmount ?? req.body.amount;
  const { reason } = req.body;

  const payment = await PaymentService.initiateRefund(paymentId, refundAmount, reason, req.user._id);

  logPaymentAudit(req, {
    action: 'REFUND_PAYMENT',
    entityId: payment._id,
    before: null,
    after: {
      paymentId: payment._id,
      refundAmount: refundAmount ?? null,
      reason: reason ?? null,
      gateway: payment.gateway,
      status: payment.status
    },
    description: 'Refund initiated',
    severity: 'high'
  });

  return res.status(200).json(new ApiResponse(200, payment, 'Refund initiated'));
});

/**
 * Get all payments
 */
export const getAllPayments = asyncHandler(async (req, res) => {
  const filters = {
    status: req.query.status,
    paymentMethod: req.query.paymentMethod,
    gateway: req.query.gateway,
    customerId: req.query.customerId,
    bookingId: req.query.bookingId,
    // Prefer startDate/endDate; keep fromDate/toDate as backward-compatible aliases.
    fromDate: req.query.startDate || req.query.fromDate,
    toDate: req.query.endDate || req.query.toDate
  };

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const result = await PaymentService.getPayments(filters, page, limit);
  const payments = result.payments.map(mapPayment);

  return res.status(200).json(new ApiResponse(200, { payments, pagination: result.pagination }, 'Payments retrieved successfully'));
});

/**
 * Get payment by ID
 */
export const getPaymentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const payment = await PaymentService.getPaymentById(id);

  return res.status(200).json(new ApiResponse(200, mapPayment(payment), 'Payment retrieved successfully'));
});

/**
 * Download Payment Invoice
 */
export const downloadInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  logger.info('Download invoice requested for ID:', { id });

  const payment = await PaymentService.getPaymentById(id);
  logger.info('Payment found for invoice:', { paymentId: payment._id });
  
  const pdfBuffer = await PDFService.generateInvoice(payment);
  logger.info('PDF generated, size:', { size: pdfBuffer.length });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=invoice-${id}.pdf`
  );

  return res.send(pdfBuffer);
});

/**
 * Get my payments (customer)
 */
export const getMyPayments = asyncHandler(async (req, res) => {
  const filters = {
    customerId: req.user._id,
    status: req.query.status,
    fromDate: req.query.startDate || req.query.fromDate,
    toDate: req.query.endDate || req.query.toDate
  };

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const result = await PaymentService.getPayments(filters, page, limit);
  const payments = result.payments.map(mapPayment);

  return res.status(200).json(new ApiResponse(200, { payments, pagination: result.pagination }, 'Payments retrieved successfully'));
});
