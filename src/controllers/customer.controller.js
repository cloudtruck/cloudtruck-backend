import CustomerService from '../services/customer.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';

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
    new ApiResponse(201, customer, 'Customer profile created successfully')
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
    new ApiResponse(200, customer, 'Customer fetched successfully')
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
    new ApiResponse(200, result, 'Customers fetched successfully')
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
    new ApiResponse(200, customer, 'Customer updated successfully')
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
    new ApiResponse(200, customer, 'Credit limit updated successfully')
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
    new ApiResponse(200, customer, 'Customer verified successfully')
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
    new ApiResponse(200, customer, 'Account manager assigned successfully')
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

  return res.status(200).json(
    new ApiResponse(200, result, 'Booking history fetched successfully')
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

  return res.status(200).json(
    new ApiResponse(200, result, 'Booking history fetched successfully')
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
    new ApiResponse(200, customer, 'Profile fetched successfully')
  );
});
