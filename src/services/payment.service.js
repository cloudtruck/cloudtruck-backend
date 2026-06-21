import crypto from 'crypto';
import axios from 'axios';
import Payment from '../models/payment.model.js';
import Booking from '../models/booking.model.js';
import Customer from '../models/customer.model.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import NotificationService from './notification.service.js';

const PHONEPE_CONFIG = {
  merchantId: process.env.PHONEPE_MERCHANT_ID,
  saltKey: process.env.PHONEPE_SALT_KEY,
  saltIndex: process.env.PHONEPE_SALT_INDEX,
  apiUrl: process.env.PHONEPE_API_URL || 'https://api.phonepe.com/apis/hermes'
};

class PaymentService {
  /**
   * Generate PhonePe checksum
   * @param {String} payload - Base64 encoded payload
   * @returns {String}
   */
  static generateChecksum(payload) {
    const string = payload + '/pg/v1/pay' + PHONEPE_CONFIG.saltKey;
    const sha256 = crypto.createHash('sha256').update(string).digest('hex');
    return `${sha256}###${PHONEPE_CONFIG.saltIndex}`;
  }

  /**
   * Verify PhonePe checksum
   * @param {String} checksum - Checksum to verify
   * @param {String} payload - Base64 encoded payload
   * @returns {Boolean}
   */
  static verifyChecksum(checksum, payload) {
    const expectedChecksum = this.generateChecksum(payload);
    return checksum === expectedChecksum;
  }

  /**
   * Create payment order
   * @param {String} bookingId - Booking ID
   * @param {Number} amount - Payment amount
   * @param {String} customerId - Customer ID
   * @returns {Promise<Payment>}
   */
  static async createPaymentOrder(bookingId, amount, customerId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');

    // `customerId` here is the authenticated User id (see auth middleware).
    // Resolve the Customer profile from the user.
    const customer = await Customer.findOne({ user: customerId, isDeleted: false });
    if (!customer) throw new ApiError(404, 'Customer not found');

    // Generate transaction ID
    const merchantTransactionId = `TXN${Date.now()}${Math.random().toString(36).substring(7)}`;

    // Create payment record
    const payment = await Payment.create({
      booking: bookingId,
      customer: customer._id,
      merchantTransactionId,
      amount,
      paymentMethod: 'online',
      gateway: 'phonepe',
      status: 'pending'
    });

    logger.info('Payment order created:', { paymentId: payment._id, bookingId, amount });
    return payment;
  }

  /**
   * Initiate PhonePe payment
   * @param {String} paymentId - Payment ID
   * @param {String} returnUrl - Frontend return URL
   * @returns {Promise<Object>}
   */
  static async initiatePhonePePayment(paymentId, returnUrl) {
    const payment = await Payment.findById(paymentId).populate('customer', 'user');
    if (!payment) throw new ApiError(404, 'Payment not found');

    if (payment.status !== 'pending') {
      throw new ApiError(400, 'Payment already processed');
    }

    const customer = await Customer.findById(payment.customer).populate('user', 'phone');
    const phone = customer.user.phone.replace('+91', ''); // Remove country code

    // Prepare payload
    const payload = {
      merchantId: PHONEPE_CONFIG.merchantId,
      merchantTransactionId: payment.merchantTransactionId,
      merchantUserId: customer._id.toString(),
      amount: payment.amount * 100, // Convert to paise
      redirectUrl: returnUrl,
      callbackUrl: `${process.env.BACKEND_URL}/api/v1/payments/phonepe/callback`,
      mobileNumber: phone,
      paymentInstrument: {
        type: 'PAY_PAGE'
      }
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const checksum = this.generateChecksum(base64Payload);

    try {
      const response = await axios.post(
        `${PHONEPE_CONFIG.apiUrl}/pg/v1/pay`,
        {
          request: base64Payload
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': checksum
          }
        }
      );

      // Update payment with gateway response
      payment.gatewayOrderId = response.data.data.merchantTransactionId;
      payment.gatewayResponse = response.data;
      await payment.save();

      logger.info('PhonePe payment initiated:', { paymentId, merchantTransactionId: payment.merchantTransactionId });

      return {
        paymentUrl: response.data.data.instrumentResponse.redirectInfo.url,
        merchantTransactionId: payment.merchantTransactionId
      };
    } catch (error) {
      logger.error('PhonePe initiation failed:', error);
      payment.status = 'failed';
      payment.failureReason = error.response?.data?.message || error.message;
      await payment.save();
      throw new ApiError(500, 'Failed to initiate payment');
    }
  }

  /**
   * Compute correct booking paymentStatus by aggregating all successful payments.
   * Must be called AFTER the triggering payment is already persisted with status='success'.
   * @param {ObjectId} bookingId
   * @param {Object} booking - Booking document (for freight amount)
   * @returns {Promise<'paid'|'partial'|'unpaid'>}
   */
  static async computePaymentStatus(bookingId, booking) {
    const freight = booking.finalAmount || booking.expectedAmount || 0;
    if (freight === 0) return 'unpaid';
    const agg = await Payment.aggregate([
      { $match: { booking: bookingId, status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalPaid = agg[0]?.total || 0;
    if (totalPaid >= freight) return 'paid';
    if (totalPaid > 0) return 'partial';
    return 'unpaid';
  }

  /**
   * Handle PhonePe callback
   * @param {Object} data - Callback data
   * @returns {Promise<Payment>}
   */
  static async handlePhonePeCallback(data) {
    const { response, checksum } = data;

    // Verify checksum
    if (!this.verifyChecksum(checksum, response)) {
      throw new ApiError(400, 'Invalid checksum');
    }

    const decodedResponse = JSON.parse(Buffer.from(response, 'base64').toString());
    const { merchantTransactionId, transactionId, code } = decodedResponse;

    const payment = await Payment.findOne({ merchantTransactionId });
    if (!payment) throw new ApiError(404, 'Payment not found');

    payment.gatewayResponse = decodedResponse;

    if (code === 'PAYMENT_SUCCESS') {
      payment.status = 'success';
      payment.transactionId = transactionId;
      payment.paidAt = new Date();

      // Save payment first so the aggregate below finds it with status='success'
      await payment.save();

      // Update booking
      const booking = await Booking.findById(payment.booking);
      if (booking) {
        booking.payments.push(payment._id);
        // Compute correct status: 'partial' if balance remains, 'paid' if fully settled
        booking.paymentStatus = await PaymentService.computePaymentStatus(booking._id, booking);
        await booking.save();

        // Notify staff
        await NotificationService.notifyPaymentSuccess(booking, payment);
      }

      // Update customer outstanding
      const customer = await Customer.findById(payment.customer);
      if (customer) {
        customer.outstandingAmount -= payment.amount;
        await customer.save();
      }

      logger.info('Payment successful:', { paymentId: payment._id, transactionId });
    } else {
      payment.status = 'failed';
      payment.failureReason = decodedResponse.message;
      await payment.save();
      logger.warn('Payment failed:', { paymentId: payment._id, reason: decodedResponse.message });
    }

    return payment;
  }

  /**
   * Verify payment status
   * @param {String} merchantTransactionId - Merchant transaction ID
   * @returns {Promise<Payment>}
   */
  static async verifyPaymentStatus(merchantTransactionId) {
    const payment = await Payment.findOne({ merchantTransactionId });
    if (!payment) throw new ApiError(404, 'Payment not found');

    const string = `/pg/v1/status/${PHONEPE_CONFIG.merchantId}/${merchantTransactionId}${PHONEPE_CONFIG.saltKey}`;
    const checksum = crypto.createHash('sha256').update(string).digest('hex') + `###${PHONEPE_CONFIG.saltIndex}`;

    try {
      const response = await axios.get(
        `${PHONEPE_CONFIG.apiUrl}/pg/v1/status/${PHONEPE_CONFIG.merchantId}/${merchantTransactionId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': checksum,
            'X-MERCHANT-ID': PHONEPE_CONFIG.merchantId
          }
        }
      );

      const { code, data } = response.data;
      if (code === 'PAYMENT_SUCCESS') {
        payment.status = 'success';
        payment.transactionId = data.transactionId;
        payment.paidAt = new Date();
      } else {
        payment.status = 'failed';
        payment.failureReason = response.data.message;
      }

      await payment.save();
      return payment;
    } catch (error) {
      logger.error('Payment verification failed:', error);
      throw new ApiError(500, 'Failed to verify payment status');
    }
  }

  /**
   * Record manual payment (NEFT/RTGS/Cheque)
   * @param {Object} data - Payment data
   * @param {String} recordedBy - User recording payment
   * @returns {Promise<Payment>}
   */
  static async recordManualPayment(data, recordedBy) {
    const bookingId = data.bookingId || data.booking;
    const {
      customerId,
      amount,
      paymentMethod,
      referenceNumber,
      bankName,
      chequeNumber,
      chequeDate,
      transactionDate,
      remarks,
      notes
    } = data;

    const effectiveTransactionDate = transactionDate || chequeDate || new Date().toISOString();
    const effectiveRemarks = remarks || notes || [bankName, chequeNumber].filter(Boolean).join(' ').trim();

    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');

    const payment = await Payment.create({
      booking: bookingId,
      customer: customerId,
      amount,
      paymentMethod,
      gateway: 'manual',
      referenceNumber,
      transactionDate: new Date(effectiveTransactionDate),
      remarks: effectiveRemarks,
      status: 'success',
      paidAt: new Date(),
      recordedBy
    });

    // Update booking — compute correct status in case this is a partial payment
    booking.payments.push(payment._id);
    booking.paymentStatus = await PaymentService.computePaymentStatus(booking._id, booking);
    await booking.save();

    // Update customer outstanding
    const customer = await Customer.findById(customerId);
    if (customer) {
      customer.outstandingAmount -= amount;
      await customer.save();
    }

    logger.info('Manual payment recorded:', { paymentId: payment._id, method: paymentMethod });
    return payment;
  }

  /**
   * Initiate refund
   * @param {String} paymentId - Payment ID
   * @param {Number} refundAmount - Amount to refund
   * @param {String} reason - Refund reason
   * @param {String} initiatedBy - User initiating refund
   * @returns {Promise<Payment>}
   */
  static async initiateRefund(paymentId, refundAmount, reason, initiatedBy) {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new ApiError(404, 'Payment not found');

    if (payment.status !== 'success') {
      throw new ApiError(400, 'Only successful payments can be refunded');
    }

    const effectiveRefundAmount = refundAmount ?? payment.amount;

    if (effectiveRefundAmount > payment.amount) {
      throw new ApiError(400, 'Refund amount cannot exceed payment amount');
    }

    // For PhonePe payments
    if (payment.gateway === 'phonepe') {
      const merchantTransactionId = `REFUND${Date.now()}${Math.random().toString(36).substring(7)}`;
      
      const payload = {
        merchantId: PHONEPE_CONFIG.merchantId,
        merchantTransactionId,
        originalTransactionId: payment.transactionId,
        amount: effectiveRefundAmount * 100,
        callbackUrl: `${process.env.BACKEND_URL}/api/v1/payments/phonepe/refund-callback`
      };

      const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const checksum = this.generateChecksum(base64Payload);

      try {
        const response = await axios.post(
          `${PHONEPE_CONFIG.apiUrl}/pg/v1/refund`,
          { request: base64Payload },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-VERIFY': checksum
            }
          }
        );

        payment.refunds.push({
          amount: effectiveRefundAmount,
          reason,
          status: 'pending',
          initiatedBy,
          initiatedAt: new Date(),
          merchantTransactionId
        });

        await payment.save();
        logger.info('Refund initiated:', { paymentId, refundAmount, merchantTransactionId });
      } catch (error) {
        logger.error('Refund initiation failed:', error);
        throw new ApiError(500, 'Failed to initiate refund');
      }
    } else {
      // Manual refund
      payment.refunds.push({
        amount: effectiveRefundAmount,
        reason,
        status: 'success',
        initiatedBy,
        initiatedAt: new Date(),
        processedAt: new Date()
      });
      await payment.save();
    }

    return payment;
  }

  /**
   * Get payments with filters
   * @param {Object} filters - Filter options
   * @param {Number} page
   * @param {Number} limit
   * @returns {Promise<Object>}
   */
  static async getPayments(filters = {}, page = 1, limit = 20) {
    const query = {};

    if (filters.status) query.status = filters.status;
    if (filters.paymentMethod) query.paymentMethod = filters.paymentMethod;
    if (filters.gateway) query.gateway = filters.gateway;
    if (filters.customerId) query.customer = filters.customerId;
    if (filters.bookingId) query.booking = filters.bookingId;

    if (filters.fromDate || filters.toDate) {
      query.createdAt = {};
      if (filters.fromDate) query.createdAt.$gte = new Date(filters.fromDate);
      if (filters.toDate) query.createdAt.$lte = new Date(filters.toDate);
    }

    const skip = (page - 1) * limit;
    const payments = await Payment.find(query)
      .populate('customer', 'companyName')
      .populate({
        path: 'booking',
        select: 'bookingId pickup drop customer',
        populate: {
          path: 'customer',
          select: 'companyName contactPerson'
        }
      })
      .populate('recordedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Payment.countDocuments(query);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get booking-level payment summary for customer app.
   * Works for all states: no payment, partial, fully paid.
   * @param {String} bookingId - Booking _id or readable bookingId
   * @param {String} userId - Authenticated customer user _id
   * @returns {Promise<Object>}
   */
  static async getBookingPaymentSummary(bookingId, userId, checkCustomer = true) {
    let bookingQuery = {
      $or: [
        ...(bookingId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: bookingId }] : []),
        { bookingId }
      ],
      isDeleted: false
    };

    if (checkCustomer) {
      const customer = await Customer.findOne({ user: userId, isDeleted: false });
      if (!customer) throw new ApiError(404, 'Customer not found');
      bookingQuery.customer = customer._id;
    }

    const booking = await Booking.findOne(bookingQuery).select('bookingId finalAmount expectedAmount advanceRequired paymentStatus payments');

    if (!booking) throw new ApiError(404, 'Booking not found');

    const freight = booking.finalAmount || booking.expectedAmount || 0;

    // Fetch all successful payments — returns empty array when none exist
    const payments = await Payment.find({ booking: booking._id, status: 'success' })
      .select('amount paymentMethod gateway referenceNumber transactionId paidAt remarks createdAt')
      .sort({ paidAt: 1, createdAt: 1 })
      .lean();

    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const balance = Math.max(0, freight - totalPaid);

    return {
      bookingId: booking.bookingId,
      payable: freight,
      freight,
      totalPaid,
      balance,
      paymentStatus: booking.paymentStatus,
      payments: payments.map(p => ({
        _id: p._id,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        gateway: p.gateway,
        referenceNumber: p.referenceNumber,
        transactionId: p.transactionId,
        paidAt: p.paidAt,
        remarks: p.remarks,
        createdAt: p.createdAt
      }))
    };
  }

  /**
   * Get payment by ID
   * @param {String} paymentId - Payment ID
   * @returns {Promise<Payment>}
   */
  static async getPaymentById(paymentId) {
    const payment = await Payment.findById(paymentId)
      .populate('customer', 'companyName gst contactPerson billingAddress address pan')
      .populate({
        path: 'booking',
        select: 'bookingId pickup drop materialType truckTypeNeeded expectedAmount advanceRequired customer',
        populate: {
          path: 'customer',
          select: 'companyName contactPerson'
        }
      })
      .populate('recordedBy', 'name email')
      .lean();

    if (!payment) throw new ApiError(404, 'Payment not found');
    return payment;
  }
}

export default PaymentService;
