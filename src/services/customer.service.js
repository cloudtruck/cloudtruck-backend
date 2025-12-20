import Customer from '../models/customer.model.js';
import User from '../models/user.model.js';
import Booking from '../models/booking.model.js';
import Route from '../models/route.model.js';
import AuditLog from '../models/auditLog.model.js';
import NotificationService from './notification.service.js';
import ApiError from '../utils/ApiError.js';

/**
 * Customer Service
 * Handles customer profile and business operations
 */
class CustomerService {
  /**
   * Create customer profile
   * @param {Object} data - Customer data
   * @param {Object} context
   * @param {string} context.actorUserId - Authenticated user creating this customer
   * @param {string|null} context.targetUserId - Target customer user (required for staff/admin unless phone is provided)
   * @returns {Promise<Object>} Created customer
   */
  static async createCustomer(data, { actorUserId, targetUserId }) {
    const {
      userId,
      phone,
      email,
      companyName,
      gstNumber,
      address,
      city,
      state,
      pincode,
      contactPerson,
      designation,
      alternatePhone,
      creditLimit,
      paymentTerms
    } = data;

    let resolvedTargetUserId = targetUserId || userId || null;

    // Staff/admin flow can create by phone/email if userId not provided.
    if (!resolvedTargetUserId && phone) {
      let existingUser = await User.findOne({ phone, isDeleted: false });
      if (existingUser && existingUser.role !== 'customer') {
        throw new ApiError(400, 'Phone number already belongs to a non-customer user');
      }

      if (!existingUser) {
        existingUser = await User.create({
          phone,
          email,
          role: 'customer',
          status: 'pending-verification',
          createdBy: actorUserId
        });
      }

      resolvedTargetUserId = existingUser._id;
    }

    if (!resolvedTargetUserId) {
      throw new ApiError(400, 'userId or phone is required to create a customer');
    }

    // If staff/admin is creating for an existing user, ensure it is a customer user.
    const targetUser = await User.findById(resolvedTargetUserId);
    if (!targetUser || targetUser.isDeleted) {
      throw new ApiError(404, 'User not found');
    }
    if (targetUser.role !== 'customer') {
      throw new ApiError(400, 'User role not eligible for customer profile');
    }

    // Check if customer profile already exists
    const existingCustomer = await Customer.findOne({ user: resolvedTargetUserId });
    if (existingCustomer) {
      throw new ApiError(400, 'Customer profile already exists');
    }

    // Verify GST number is unique if provided
    if (gstNumber) {
      const duplicateGST = await Customer.findOne({ gst: gstNumber, isDeleted: false });
      if (duplicateGST) {
        throw new ApiError(400, 'GST number already registered');
      }
    }

    const normalizedContactPerson = typeof contactPerson === 'string'
      ? { name: contactPerson }
      : contactPerson;

    const normalizedPaymentTerms = paymentTerms === 'advance'
      ? 'prepaid'
      : paymentTerms === 'cod'
        ? 'postpaid'
        : paymentTerms === 'credit'
          ? 'credit'
          : undefined;

    // Create customer
    const customer = await Customer.create({
      user: resolvedTargetUserId,
      companyName,
      gst: gstNumber,
      address: {
        street: address,
        city,
        state,
        pincode
      },
      contactPerson: normalizedContactPerson,
      designation,
      alternatePhone,
      creditLimit: {
        amount: creditLimit || 0,
        currency: 'INR',
        utilized: 0
      },
      paymentTerms: normalizedPaymentTerms || 'prepaid',
      isVerified: false,
      createdBy: actorUserId
    });

    // Audit log
    await AuditLog.create({
      user: actorUserId,
      action: 'CREATE_CUSTOMER_PROFILE',
      entityType: 'customer',
      entityId: customer._id,
      changes: {
        before: null,
        after: customer.toObject()
      }
    });

    return customer;
  }

  /**
   * Get customer by ID
   * @param {string} customerId - Customer ID or User ID
   * @returns {Promise<Object>} Customer details
   */
  static async getCustomerById(customerId) {
    const customer = await Customer.findOne({
      $or: [{ _id: customerId }, { user: customerId }],
      isDeleted: false
    })
      .populate('user', 'phone email status')
      .populate('accountManager', 'name department phone')
      .populate('kycDocuments', 'type status fileUrl');

    if (!customer) {
      throw new ApiError(404, 'Customer not found');
    }

    return customer;
  }

  /**
   * Get customers with filters
   * @param {Object} filters - Query filters
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Customers list
   */
  static async getCustomers(filters = {}, pagination = {}) {
    const {
      isVerified,
      city,
      state,
      paymentTerms,
      minCreditLimit,
      accountManager,
      search
    } = filters;

    const query = { isDeleted: false };

    if (typeof isVerified === 'boolean') query.isVerified = isVerified;
    if (city) query['address.city'] = new RegExp(city, 'i');
    if (state) query['address.state'] = new RegExp(state, 'i');
    if (paymentTerms) query.paymentTerms = paymentTerms;
    if (minCreditLimit) query.creditLimit = { $gte: minCreditLimit };
    if (accountManager) query.accountManager = accountManager;

    // Search by company name or GST
    if (search) {
      query.$or = [
        { companyName: new RegExp(search, 'i') },
        { gstNumber: new RegExp(search, 'i') }
      ];
    }

    const result = await Customer.paginate(query, {
      page: pagination.page || 1,
      limit: pagination.limit || 20,
      sort: pagination.sort || { createdAt: -1 },
      populate: [
        { path: 'user', select: 'phone email' },
        { path: 'accountManager', select: 'name department' }
      ]
    });

    return result;
  }

  /**
   * Update customer profile
   * @param {string} customerId - Customer ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - User performing update
   * @returns {Promise<Object>} Updated customer
   */
  static async updateCustomer(customerId, updateData, userId) {
    const customer = await Customer.findOne({ _id: customerId, isDeleted: false });

    if (!customer) {
      throw new ApiError(404, 'Customer not found');
    }

    const oldData = customer.toObject();

    // Update allowed fields
    const allowedFields = [
      'companyName',
      'gstNumber',
      'address',
      'contactPerson',
      'designation',
      'alternatePhone'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        customer[field] = updateData[field];
      }
    });

    customer.updatedBy = userId;
    await customer.save();

    // Audit log
    await AuditLog.create({
      user: userId,
      action: 'UPDATE_CUSTOMER_PROFILE',
      entityType: 'customer',
      entityId: customer._id,
      changes: {
        before: oldData,
        after: customer.toObject()
      }
    });

    return customer;
  }

  /**
   * Update customer credit limit
   * @param {string} customerId - Customer ID
   * @param {number} creditLimit - New credit limit
   * @param {string} updatedBy - Staff ID
   * @returns {Promise<Object>} Updated customer
   */
  static async updateCreditLimit(customerId, creditLimit, updatedBy) {
    const customer = await Customer.findById(customerId);

    if (!customer) {
      throw new ApiError(404, 'Customer not found');
    }

    const oldLimit = customer.creditLimit;

    customer.creditLimit = creditLimit;
    customer.updatedBy = updatedBy;
    await customer.save();

    // Notify customer
    await NotificationService.sendNotification({
      recipient: customer.user,
      type: 'credit_limit_updated',
      title: 'Credit Limit Updated',
      message: `Your credit limit has been updated to ₹${creditLimit}`,
      entityType: 'customer',
      entityId: customer._id,
      channels: ['in-app']
    });

    // Audit log
    await AuditLog.create({
      user: updatedBy,
      action: 'UPDATE_CREDIT_LIMIT',
      entityType: 'customer',
      entityId: customer._id,
      changes: {
        before: { creditLimit: oldLimit },
        after: { creditLimit }
      }
    });

    return customer;
  }

  /**
   * Update customer outstanding amount
   * @param {string} customerId - Customer ID
   * @param {number} amount - Amount to add/subtract
   * @param {string} operation - 'add' or 'subtract'
   * @returns {Promise<Object>} Updated customer
   */
  static async updateOutstanding(customerId, amount, operation = 'add') {
    const customer = await Customer.findById(customerId);

    if (!customer) {
      throw new ApiError(404, 'Customer not found');
    }

    if (operation === 'add') {
      customer.outstandingAmount += amount;
    } else if (operation === 'subtract') {
      customer.outstandingAmount = Math.max(0, customer.outstandingAmount - amount);
    }

    await customer.save();

    return customer;
  }

  /**
   * Update customer business metrics
   * @param {string} customerId - Customer ID
   * @param {Object} metrics - Metrics to update
   * @returns {Promise<Object>} Updated customer
   */
  static async updateMetrics(customerId, metrics) {
    const customer = await Customer.findById(customerId);

    if (!customer) {
      throw new ApiError(404, 'Customer not found');
    }

    if (metrics.totalBookings !== undefined) {
      customer.businessMetrics.totalBookings = metrics.totalBookings;
    }
    if (metrics.completedBookings !== undefined) {
      customer.businessMetrics.completedBookings = metrics.completedBookings;
    }
    if (metrics.cancelledBookings !== undefined) {
      customer.businessMetrics.cancelledBookings = metrics.cancelledBookings;
    }
    if (metrics.totalSpent !== undefined) {
      customer.businessMetrics.totalSpent = metrics.totalSpent;
    }

    await customer.save();

    return customer;
  }

  /**
   * Add rating to customer
   * @param {string} customerId - Customer ID
   * @param {number} rating - Rating (1-5)
   * @returns {Promise<Object>} Updated customer
   */
  static async addRating(customerId, rating) {
    if (rating < 1 || rating > 5) {
      throw new ApiError(400, 'Rating must be between 1 and 5');
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      throw new ApiError(404, 'Customer not found');
    }

    await customer.updateRating(rating);

    return customer;
  }

  /**
   * Verify customer
   * @param {string} customerId - Customer ID
   * @param {string} verifiedBy - Staff ID
   * @returns {Promise<Object>} Updated customer
   */
  static async verifyCustomer(customerId, verifiedBy) {
    const customer = await Customer.findById(customerId);

    if (!customer) {
      throw new ApiError(404, 'Customer not found');
    }

    customer.isVerified = true;
    customer.verifiedAt = new Date();
    customer.updatedBy = verifiedBy;
    await customer.save();

    // Update user status
    await User.findByIdAndUpdate(customer.user, { status: 'active' });

    // Notify customer
    await NotificationService.sendNotification({
      recipient: customer.user,
      type: 'customer_verified',
      title: 'Profile Verified',
      message: 'Your profile has been verified. You can now create bookings.',
      entityType: 'customer',
      entityId: customer._id,
      channels: ['push', 'sms', 'in-app']
    });

    return customer;
  }

  /**
   * Assign account manager
   * @param {string} customerId - Customer ID
   * @param {string} staffId - Staff ID
   * @param {string} assignedBy - User ID
   * @returns {Promise<Object>} Updated customer
   */
  static async assignAccountManager(customerId, staffId, assignedBy) {
    const customer = await Customer.findById(customerId);

    if (!customer) {
      throw new ApiError(404, 'Customer not found');
    }

    customer.accountManager = staffId;
    customer.updatedBy = assignedBy;
    await customer.save();

    return customer;
  }

  /**
   * Get customer dashboard stats
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Dashboard stats
   */
  static async getDashboardStats(customerId) {
    const customer = await Customer.findById(customerId);

    if (!customer) {
      throw new ApiError(404, 'Customer not found');
    }

    // Get booking stats
    const bookingStats = await Booking.aggregate([
      { $match: { customer: customer.user, isDeleted: false } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCounts = {};
    bookingStats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });

    // Get recent bookings
    const recentBookings = await Booking.find({
      customer: customer.user,
      isDeleted: false
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('bookingId status pickup drop loadDateTime');

    // Get saved routes
    const savedRoutes = await Route.find({
      customer: customerId,
      isDeleted: false
    })
      .sort({ usageCount: -1 })
      .limit(5);

    return {
      customer: {
        companyName: customer.companyName,
        rating: customer.businessMetrics.rating,
        creditLimit: customer.creditLimit,
        availableCredit: customer.availableCredit,
        outstandingAmount: customer.outstandingAmount
      },
      bookings: {
        total: customer.businessMetrics.totalBookings,
        completed: customer.businessMetrics.completedBookings,
        cancelled: customer.businessMetrics.cancelledBookings,
        byStatus: statusCounts
      },
      spending: {
        total: customer.businessMetrics.totalSpent,
        average: customer.businessMetrics.totalBookings > 0
          ? customer.businessMetrics.totalSpent / customer.businessMetrics.totalBookings
          : 0
      },
      recentBookings,
      savedRoutes
    };
  }

  /**
   * Get customer booking history
   * @param {string} customerId - Customer ID
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Booking history
   */
  static async getBookingHistory(customerId, filters = {}, pagination = {}) {
    const customer = await Customer.findById(customerId);

    if (!customer) {
      throw new ApiError(404, 'Customer not found');
    }

    const query = {
      customer: customer._id,
      isDeleted: false
    };

    if (filters.status) {
      query.status = Array.isArray(filters.status) ? { $in: filters.status } : filters.status;
    }
    if (filters.startDate || filters.endDate) {
      query.loadDateTime = {};
      if (filters.startDate) query.loadDateTime.$gte = new Date(filters.startDate);
      if (filters.endDate) query.loadDateTime.$lte = new Date(filters.endDate);
    }

    const result = await Booking.paginate(query, {
      page: pagination.page || 1,
      limit: pagination.limit || 20,
      sort: pagination.sort || { createdAt: -1 },
      populate: [
        { path: 'driver', select: 'name phone' },
        { path: 'vehicle', select: 'vehicleNumber truckType' }
      ]
    });

    return result;
  }

  /**
   * Soft delete customer
   * @param {string} customerId - Customer ID
   * @param {string} deletedBy - User ID
   * @returns {Promise<Object>} Deleted customer
   */
  static async deleteCustomer(customerId, deletedBy) {
    const customer = await Customer.findById(customerId);

    if (!customer) {
      throw new ApiError(404, 'Customer not found');
    }

    // Check for active bookings
    const activeBookings = await Booking.countDocuments({
      customer: customer.user,
      status: { $nin: ['delivered', 'pod-received', 'closed', 'cancelled'] },
      isDeleted: false
    });

    if (activeBookings > 0) {
      throw new ApiError(400, 'Cannot delete customer with active bookings');
    }

    await customer.softDelete(deletedBy);

    // Audit log
    await AuditLog.create({
      user: deletedBy,
      action: 'DELETE_CUSTOMER',
      entityType: 'customer',
      entityId: customer._id,
      changes: {
        before: customer.toObject(),
        after: { isDeleted: true }
      }
    });

    return customer;
  }
}

export default CustomerService;
