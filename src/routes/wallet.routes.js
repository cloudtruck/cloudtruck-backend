import express from 'express';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  creditWalletSchema,
  approvePayoutSchema,
  rejectPayoutSchema,
  walletQuerySchema,
} from '../validators/wallet.validator.js';
import {
  getDriverWallet,
  creditDriverWallet,
  getPendingPayouts,
  approvePayout,
  rejectPayout,
} from '../controllers/wallet.controller.js';

const router = express.Router();

const admin = checkRole('staff', 'internal', 'super-admin');

// ── Admin: pending payout queue ───────────────────────────────────────────────
// Must come before /:driverId to avoid path collision
router.get('/payouts/pending', verifyJWT, admin, validate(walletQuerySchema, 'query'), getPendingPayouts);

// ── Admin: approve / reject a payout ─────────────────────────────────────────
router.patch('/payouts/:transactionId/approve', verifyJWT, admin, validate(approvePayoutSchema), approvePayout);
router.patch('/payouts/:transactionId/reject',  verifyJWT, admin, validate(rejectPayoutSchema),  rejectPayout);

// ── Admin: view / credit a driver wallet ─────────────────────────────────────
router.get( '/drivers/:driverId',        verifyJWT, admin, validate(walletQuerySchema, 'query'), getDriverWallet);
router.post('/drivers/:driverId/credit', verifyJWT, admin, validate(creditWalletSchema),         creditDriverWallet);

export default router;
