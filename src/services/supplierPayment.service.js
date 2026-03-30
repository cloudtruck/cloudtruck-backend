import SupplierPayment from '../models/supplierPayment.model.js';
import Supplier from '../models/supplier.model.js';
import Booking from '../models/booking.model.js';
import ApiError from '../utils/ApiError.js';

class SupplierPaymentService {
  /**
   * Create a new payment request.
   * Validates supplier + booking exist and booking.supplierEntity matches the supplier.
   * Snapshots bank details at creation time.
   */
  static async createPayment(data, requestedBy) {
    const { supplierId, bookingId, amount, paymentType, paymentMethod, remarks } = data;

    const [supplier, booking] = await Promise.all([
      Supplier.findOne({ _id: supplierId, isDeleted: false }).select('+bankDetails.accountNumber'),
      Booking.findOne({ _id: bookingId, isDeleted: false }),
    ]);

    if (!supplier) throw new ApiError(404, 'Supplier not found');
    if (!booking)  throw new ApiError(404, 'Booking not found');

    // Validate booking belongs to this supplier
    if (!booking.supplierEntity || !booking.supplierEntity.equals(supplierId)) {
      throw new ApiError(400, 'Booking is not assigned to this supplier');
    }

    // Snapshot bank details so future changes don't alter this record
    const bankDetailsSnapshot = supplier.bankDetails
      ? {
          accountNumber:     supplier.bankDetails.accountNumber || null,
          ifscCode:          supplier.bankDetails.ifscCode || null,
          accountHolderName: supplier.bankDetails.accountHolderName || null,
          bankName:          supplier.bankDetails.bankName || null,
        }
      : null;

    const payment = await SupplierPayment.create({
      supplier: supplierId,
      booking:  bookingId,
      amount,
      paymentType,
      paymentMethod,
      remarks,
      bankDetailsSnapshot,
      requestedBy,
      requestedAt: new Date(),
    });

    return payment;
  }

  /**
   * Step 1: Manager approves a pending payment.
   * pending → approved
   */
  static async approvePayment(paymentId, approvedBy) {
    const payment = await SupplierPayment.findById(paymentId);
    if (!payment) throw new ApiError(404, 'Payment not found');
    if (payment.status !== 'pending') {
      throw new ApiError(400, `Cannot approve payment in '${payment.status}' status`);
    }

    payment.status = 'approved';
    payment.approvedBy = approvedBy;
    payment.approvedAt = new Date();
    await payment.save();

    return payment;
  }

  /**
   * Step 2: Accounts team marks payment as paid after bank transfer.
   * approved → paid  (adds UTR / reference number)
   */
  static async markPaid(paymentId, paidBy, { referenceNumber, transactionDate } = {}) {
    const payment = await SupplierPayment.findById(paymentId);
    if (!payment) throw new ApiError(404, 'Payment not found');
    if (payment.status !== 'approved') {
      throw new ApiError(400, `Cannot mark as paid — payment is in '${payment.status}' status. Must be approved first.`);
    }

    payment.status = 'paid';
    payment.paidBy = paidBy;
    payment.paidAt = new Date();
    if (referenceNumber)  payment.referenceNumber = referenceNumber;
    if (transactionDate)  payment.transactionDate = new Date(transactionDate);
    await payment.save();

    return payment;
  }

  /**
   * Reject a pending or approved payment.
   */
  static async rejectPayment(paymentId, reason, userId) {
    const payment = await SupplierPayment.findById(paymentId);
    if (!payment) throw new ApiError(404, 'Payment not found');
    if (!['pending', 'approved'].includes(payment.status)) {
      throw new ApiError(400, `Cannot reject payment in '${payment.status}' status`);
    }

    payment.status = 'failed';
    payment.rejectionReason = reason;
    await payment.save();

    return payment;
  }

  /**
   * Get paginated list of supplier payments.
   */
  static async getPayments(filters = {}, pagination = {}) {
    const { supplierId, bookingId, status, dateFrom, dateTo } = filters;
    const { page = 1, limit = 20, sort = '-createdAt' } = pagination;

    const query = { isDeleted: false };
    if (supplierId) query.supplier = supplierId;
    if (bookingId)  query.booking  = bookingId;
    if (status)     query.status   = status;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo)   query.createdAt.$lte = new Date(dateTo);
    }

    return SupplierPayment.paginate(query, {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: [
        { path: 'supplier', select: 'displayName companyName supplierType' },
        { path: 'booking',  select: 'bookingId status' },
        { path: 'requestedBy', select: 'name' },
        { path: 'approvedBy',  select: 'name' },
        { path: 'paidBy',      select: 'name' },
      ],
    });
  }

  /**
   * Get a single payment by ID.
   */
  static async getPaymentById(paymentId) {
    const payment = await SupplierPayment.findById(paymentId)
      .populate('supplier', 'displayName companyName supplierType phone')
      .populate('booking',  'bookingId status pickup drop')
      .populate('requestedBy', 'name')
      .populate('approvedBy',  'name')
      .populate('paidBy',      'name');

    if (!payment) throw new ApiError(404, 'Payment not found');
    return payment;
  }

  /**
   * Get all payments for a supplier with running total.
   */
  static async getSupplierLedger(supplierId, pagination = {}) {
    const { page = 1, limit = 20 } = pagination;

    const result = await SupplierPayment.paginate(
      { supplier: supplierId, isDeleted: false },
      {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: '-createdAt',
        populate: [{ path: 'booking', select: 'bookingId status' }],
      }
    );

    // Running totals across all pages (aggregate separately)
    const totals = await SupplierPayment.aggregate([
      { $match: { supplier: result.items?.[0]?.supplier || supplierId } },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const summary = totals.reduce((acc, t) => {
      acc[t._id] = { total: t.total, count: t.count };
      return acc;
    }, {});

    return { ...result, summary };
  }
}

export default SupplierPaymentService;
