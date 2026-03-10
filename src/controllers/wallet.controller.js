import { WalletService } from '../services/wallet.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

// ── Driver endpoints ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/drivers/my-wallet
 * Returns the calling driver's balance + transaction history.
 */
export const getMyWallet = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const wallet = await WalletService.getMyWallet(req.user._id, page, limit);
  res.json(new ApiResponse(200, wallet, 'Wallet fetched successfully'));
});

/**
 * POST /api/v1/drivers/my-wallet/withdraw
 * Driver requests a bank withdrawal.
 * Body: { amount, note? }
 */
export const requestPayout = asyncHandler(async (req, res) => {
  const { amount, note } = req.body;
  const tx = await WalletService.requestPayout(req.user._id, amount, note);
  res.json(new ApiResponse(201, tx, 'Withdrawal request submitted'));
});

// ── Admin endpoints ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/wallet/drivers/:driverId
 * Admin: view a specific driver's wallet.
 */
export const getDriverWallet = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const wallet = await WalletService.getDriverWallet(req.params.driverId, page, limit);
  res.json(new ApiResponse(200, wallet, 'Driver wallet fetched'));
});

/**
 * POST /api/v1/wallet/drivers/:driverId/credit
 * Admin: credit a driver's wallet (advance, balance payment, or manual adjustment).
 * Body: { amount, type, booking?, bookingRef?, note? }
 */
export const creditDriverWallet = asyncHandler(async (req, res) => {
  const tx = await WalletService.credit(req.params.driverId, {
    ...req.body,
    createdBy: req.user._id,
  });
  res.json(new ApiResponse(201, tx, 'Wallet credited successfully'));
});

/**
 * GET /api/v1/wallet/payouts/pending
 * Admin: list all pending payout requests.
 */
export const getPendingPayouts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const result = await WalletService.getPendingPayouts(page, limit);
  res.json(new ApiResponse(200, result, 'Pending payouts fetched'));
});

/**
 * PATCH /api/v1/wallet/payouts/:transactionId/approve
 * Admin: approve a payout — mark as sent to bank.
 * Body: { utrNumber? }
 */
export const approvePayout = asyncHandler(async (req, res) => {
  const tx = await WalletService.approvePayout(
    req.params.transactionId,
    req.body.utrNumber,
    req.user._id
  );
  res.json(new ApiResponse(200, tx, 'Payout approved'));
});

/**
 * PATCH /api/v1/wallet/payouts/:transactionId/reject
 * Admin: reject a payout and refund the reserved balance.
 * Body: { reason }
 */
export const rejectPayout = asyncHandler(async (req, res) => {
  const tx = await WalletService.rejectPayout(
    req.params.transactionId,
    req.body.reason,
    req.user._id
  );
  res.json(new ApiResponse(200, tx, 'Payout rejected and balance refunded'));
});

/**
 * GET /api/v1/wallet/payouts/all
 * Admin: list all payouts (pending + completed), optionally filtered by status.
 */
export const getAllPayouts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const { status } = req.query;
  const result = await WalletService.getAllPayouts(page, limit, status);
  res.json(new ApiResponse(200, result, 'Payouts fetched'));
});
