import SupplierPaymentService from '../services/supplierPayment.service.js';
import Supplier from '../models/supplier.model.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const createPayment = asyncHandler(async (req, res) => {
  const payment = await SupplierPaymentService.createPayment(req.body, req.user._id);
  res.status(201).json(new ApiResponse(201, payment, 'Payment request created'));
});

export const approvePayment = asyncHandler(async (req, res) => {
  const payment = await SupplierPaymentService.approvePayment(req.params.id, req.user._id);
  res.json(new ApiResponse(200, payment, 'Payment approved'));
});

export const markPaid = asyncHandler(async (req, res) => {
  const payment = await SupplierPaymentService.markPaid(req.params.id, req.user._id, req.body);
  res.json(new ApiResponse(200, payment, 'Payment marked as paid'));
});

export const rejectPayment = asyncHandler(async (req, res) => {
  const payment = await SupplierPaymentService.rejectPayment(req.params.id, req.body.reason, req.user._id);
  res.json(new ApiResponse(200, payment, 'Payment rejected'));
});

export const getPayments = asyncHandler(async (req, res) => {
  const { supplierId, bookingId, status, dateFrom, dateTo, page, limit, sort } = req.query;

  // Supplier JWT: auto-scope to their own payments (ignore supplierId query param)
  let resolvedSupplierId = supplierId;
  if (req.user.role === 'supplier') {
    const supplierDoc = await Supplier.findOne({ user: req.user._id }).select('_id');
    resolvedSupplierId = supplierDoc?._id;
  }

  const result = await SupplierPaymentService.getPayments(
    { supplierId: resolvedSupplierId, bookingId, status, dateFrom, dateTo },
    { page, limit, sort }
  );
  res.json(new ApiResponse(200, {
    items: result.docs,
    pagination: { total: result.totalDocs, page: result.page, limit: result.limit, pages: result.totalPages },
  }));
});

export const getPaymentById = asyncHandler(async (req, res) => {
  const payment = await SupplierPaymentService.getPaymentById(req.params.id);
  res.json(new ApiResponse(200, payment));
});

export const getSupplierLedger = asyncHandler(async (req, res) => {
  const result = await SupplierPaymentService.getSupplierLedger(req.params.supplierId, req.query);
  res.json(new ApiResponse(200, result));
});
