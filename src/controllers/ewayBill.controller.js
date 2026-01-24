import EwayBillService from '../services/ewayBill.service.js';
import Staff from '../models/staff.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';

/**
 * Create E-way Bill
 * POST /api/v1/eway-bills
 */
export const createEwayBill = asyncHandler(async (req, res) => {
  const billData = req.body;
  const userId = req.user._id;

  // Get staff profile
  const staff = await Staff.findOne({ user: userId });
  if (!staff) {
    throw new ApiError(403, 'Only staff members can create E-way bills');
  }

  const ewayBill = await EwayBillService.createEwayBill(billData, staff._id);

  return res.status(201).json(
    new ApiResponse(201, ewayBill, 'E-way bill created successfully')
  );
});

/**
 * Get All E-way Bills
 * GET /api/v1/eway-bills
 */
export const getAllEwayBills = asyncHandler(async (req, res) => {
  const filters = {
    status: req.query.status,
    bookingId: req.query.bookingId,
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
    expiringWithinDays: req.query.expiringWithinDays,
    search: req.query.search
  };

  const pagination = {
    page: req.query.page || 1,
    limit: req.query.limit || 20,
    sort: req.query.sort || '-createdAt'
  };

  const result = await EwayBillService.listEwayBills(filters, pagination);

  return res.status(200).json(
    new ApiResponse(200, result, 'E-way bills retrieved successfully')
  );
});

/**
 * Get E-way Bill by ID
 * GET /api/v1/eway-bills/:id
 */
export const getEwayBillById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const ewayBill = await EwayBillService.getEwayBill(id);

  return res.status(200).json(
    new ApiResponse(200, ewayBill, 'E-way bill retrieved successfully')
  );
});

/**
 * Update Part-B
 * PUT /api/v1/eway-bills/:id/part-b
 */
export const updatePartB = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { vehicleNumber, transporterId, transMode, transDocNo, transDate, reason, notes } = req.body;
  const userId = req.user._id;

  // Get staff profile
  const staff = await Staff.findOne({ user: userId });
  if (!staff) {
    throw new ApiError(403, 'Only staff members can update Part-B');
  }

  const newPartB = {
    vehicleNumber,
    transporterId,
    transMode,
    transDocNo,
    transDate
  };

  const ewayBill = await EwayBillService.updatePartB(
    id,
    newPartB,
    reason,
    staff._id,
    notes
  );

  return res.status(200).json(
    new ApiResponse(200, ewayBill, 'Part-B updated successfully')
  );
});

/**
 * Get Part-B History
 * GET /api/v1/eway-bills/:id/history
 */
export const getPartBHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const history = await EwayBillService.getPartBHistory(id);

  return res.status(200).json(
    new ApiResponse(200, history, 'Part-B history retrieved successfully')
  );
});

/**
 * Cancel E-way Bill
 * PATCH /api/v1/eway-bills/:id/cancel
 */
export const cancelEwayBill = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user._id;

  // Get staff profile
  const staff = await Staff.findOne({ user: userId });
  if (!staff) {
    throw new ApiError(403, 'Only staff members can cancel E-way bills');
  }

  const ewayBill = await EwayBillService.cancelEwayBill(id, reason, staff._id);

  return res.status(200).json(
    new ApiResponse(200, ewayBill, 'E-way bill cancelled successfully')
  );
});
