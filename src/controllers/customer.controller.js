import CustomerService from '../services/customer.service.js';
import { mapBooking } from './booking.controller.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';

// Helper: normalize customer document to frontend shape
const mapCustomer = (cust) => {
  const c = cust.toObject ? cust.toObject() : cust;
  return {
    _id: c._id,
    userId: c.user?._id || c.user,
    companyName: c.companyName,
    gstNumber: c.gst,
    contactPerson: c.contactPerson,
    phone: c.user?.phone || c.contactPerson?.phone,
    email: c.user?.email || c.contactPerson?.email,
    address: c.address,
    kycStatus: c.isVerified ? 'verified' : 'pending',
    status: c.isDeleted ? 'inactive' : 'active',
    totalBookings: c.businessMetrics?.totalBookings || 0,
    lastBookingDate: c.updatedAt, // Using updatedAt as a fallback for lastBookingDate
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  };
};

/**
 * Create Customer Profile
 * POST /api/v1/customers
 */
export const createCustomer = asyncHandler(async (req, res) => {
  const customerData = req.body;
  const actorUserId = req.user._id;

  const targetUserId = req.user.role === 'customer'
    ? req.user._id
    : (customerData.userId || null);

  const customer = await CustomerService.createCustomer(customerData, {
    actorUserId,
    targetUserId
  });

  return res.status(201).json(
    new ApiResponse(201, mapCustomer(customer), 'Customer profile created successfully')
  );
});

/**
 * Get Customer by ID
 * GET /api/v1/customers/:id
 */
export const getCustomerById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const customer = await CustomerService.getCustomerById(id);

  return res.status(200).json(
    new ApiResponse(200, mapCustomer(customer), 'Customer fetched successfully')
  );
});

/**
 * Get All Customers
 * GET /api/v1/customers
 */
export const getAllCustomers = asyncHandler(async (req, res) => {
  const {
    isVerified,
    city,
    state,
    paymentTerms,
    minCreditLimit,
    accountManager,
    search,
    page,
    limit,
    sort
  } = req.query;

  const filters = {
    isVerified: isVerified === 'true' ? true : isVerified === 'false' ? false : undefined,
    city,
    state,
    paymentTerms,
    minCreditLimit: minCreditLimit ? parseFloat(minCreditLimit) : undefined,
    accountManager,
    search
  };

  const pagination = { page, limit, sort };

  const result = await CustomerService.getCustomers(filters, pagination);

  return res.status(200).json(
    new ApiResponse(200, {
      customers: result.data.map(mapCustomer),
      pagination: {
        currentPage: result.pagination.page,
        totalPages: result.pagination.pages,
        totalItems: result.pagination.total,
        itemsPerPage: result.pagination.limit
      }
    }, 'Customers fetched successfully')
  );
});

/**
 * Update Customer Profile
 * PATCH /api/v1/customers/:id
 */
export const updateCustomer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const userId = req.user._id;

  const customer = await CustomerService.updateCustomer(id, updateData, userId);

  return res.status(200).json(
    new ApiResponse(200, mapCustomer(customer), 'Customer updated successfully')
  );
});

/**
 * Update Credit Limit
 * PATCH /api/v1/customers/:id/credit-limit
 */
export const updateCreditLimit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { creditLimit } = req.body;
  const updatedBy = req.user._id;

  const customer = await CustomerService.updateCreditLimit(id, creditLimit, updatedBy);

  return res.status(200).json(
    new ApiResponse(200, mapCustomer(customer), 'Credit limit updated successfully')
  );
});

/**
 * Verify Customer
 * POST /api/v1/customers/:id/verify
 */
export const verifyCustomer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const verifiedBy = req.user._id;

  const customer = await CustomerService.verifyCustomer(id, verifiedBy);

  return res.status(200).json(
    new ApiResponse(200, mapCustomer(customer), 'Customer verified successfully')
  );
});

/**
 * Assign Account Manager
 * POST /api/v1/customers/:id/assign-manager
 */
export const assignAccountManager = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { staffId } = req.body;
  const assignedBy = req.user._id;

  const customer = await CustomerService.assignAccountManager(id, staffId, assignedBy);

  return res.status(200).json(
    new ApiResponse(200, mapCustomer(customer), 'Account manager assigned successfully')
  );
});

/**
 * Get Customer Dashboard Stats
 * GET /api/v1/customers/:id/dashboard
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const stats = await CustomerService.getDashboardStats(id);

  return res.status(200).json(
    new ApiResponse(200, stats, 'Dashboard stats fetched successfully')
  );
});

/**
 * Get My Dashboard (Customer)
 * GET /api/v1/customers/my-dashboard
 */
export const getMyDashboard = asyncHandler(async (req, res) => {
  const customer = await CustomerService.getCustomerById(req.user._id);

  const stats = await CustomerService.getDashboardStats(customer._id);

  return res.status(200).json(
    new ApiResponse(200, stats, 'Dashboard stats fetched successfully')
  );
});

/**
 * Get Customer Booking History
 * GET /api/v1/customers/:id/bookings
 */
export const getBookingHistory = asyncHandler(async (req, res) => {
  const customer = await CustomerService.getCustomerById(req.user._id);
  const { status, startDate, endDate, page, limit, sort } = req.query;

  const filters = {
    status: status ? status.split(',') : undefined,
    startDate,
    endDate
  };

  const pagination = { page, limit, sort };

  const result = await CustomerService.getBookingHistory(customer._id, filters, pagination);

  const docs = result.data || [];
  const p = result.pagination || {};
  const bookings = docs.map(mapBooking);

  const paginationRes = {
    currentPage: p.page || 1,
    totalPages: p.pages || 1,
    totalItems: p.total || (p.totalDocs || 0),
    itemsPerPage: p.limit || 20
  };

  return res.status(200).json(
    new ApiResponse(200, { bookings, pagination: paginationRes }, 'Booking history fetched successfully')
  );
});

/**
 * Get My Booking History (Customer)
 * GET /api/v1/customers/my-bookings
 */
export const getMyBookingHistory = asyncHandler(async (req, res) => {
  const customer = await CustomerService.getCustomerById(req.user._id);
  const { status, startDate, endDate, page, limit, sort } = req.query;

  const filters = {
    status: status ? status.split(',') : undefined,
    startDate,
    endDate
  };

  const pagination = { page, limit, sort };

  const result = await CustomerService.getBookingHistory(customer._id, filters, pagination);

  const docs = result.data || [];
  const p = result.pagination || {};
  const bookings = docs.map(mapBooking);

  const paginationRes = {
    currentPage: p.page || 1,
    totalPages: p.pages || 1,
    totalItems: p.total || (p.totalDocs || 0),
    itemsPerPage: p.limit || 20
  };

  return res.status(200).json(
    new ApiResponse(200, { bookings, pagination: paginationRes }, 'Booking history fetched successfully')
  );
});

/**
 * Delete Customer
 * DELETE /api/v1/customers/:id
 */
export const deleteCustomer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deletedBy = req.user._id;

  const customer = await CustomerService.deleteCustomer(id, deletedBy);

  return res.status(200).json(
    new ApiResponse(200, customer, 'Customer deleted successfully')
  );
});

/**
 * Get My Profile (Customer)
 * GET /api/v1/customers/my-profile
 */
export const getMyProfile = asyncHandler(async (req, res) => {
  const customerId = req.user._id;

  const customer = await CustomerService.getCustomerById(customerId);

  return res.status(200).json(
    new ApiResponse(200, mapCustomer(customer), 'Profile fetched successfully')
  );
});

/**
 * Update My GST Number (Customer)
 * PATCH /api/v1/customers/my-gst
 */
export const updateMyGst = asyncHandler(async (req, res) => {
  const customerId = req.user._id;
  const { gstNumber } = req.body;

  const customer = await CustomerService.updateCustomer(customerId, { gstNumber }, req.user._id);

  return res.status(200).json(
    new ApiResponse(200, mapCustomer(customer), 'GST number updated successfully')
  );
});
