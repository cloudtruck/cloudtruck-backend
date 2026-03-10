import express from 'express';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import {
  getDriverWallet,
  creditDriverWallet,
  getPendingPayouts,
  getAllPayouts,
  approvePayout,
  rejectPayout,
} from '../controllers/wallet.controller.js';

const router = express.Router();

const admin = checkRole('staff', 'internal', 'super-admin');

// ── Admin: pending payout queue ───────────────────────────────────────────────
// Must come before /:driverId to avoid path collision
router.get('/payouts/pending', verifyJWT, admin, getPendingPayouts);
router.get('/payouts/all',     verifyJWT, admin, getAllPayouts);

// ── Admin: approve / reject a payout ─────────────────────────────────────────
router.patch('/payouts/:transactionId/approve', verifyJWT, admin, approvePayout);
router.patch('/payouts/:transactionId/reject',  verifyJWT, admin, rejectPayout);

// ── Admin: view / credit a driver wallet ─────────────────────────────────────
router.get( '/drivers/:driverId',        verifyJWT, admin, getDriverWallet);
router.post('/drivers/:driverId/credit', verifyJWT, admin, creditDriverWallet);

export default router;
