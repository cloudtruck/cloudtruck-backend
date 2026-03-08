import mongoose from 'mongoose';
import { paginationPlugin } from '../utils/plugins/pagination.plugin.js';

const { Schema, Types } = mongoose;

// ─── DriverWallet ─────────────────────────────────────────────────────────────
// One document per driver. The source of truth for current balance.

const driverWalletSchema = new Schema(
  {
    driver: { type: Types.ObjectId, ref: 'Driver', required: true, unique: true, index: true },
    balance: { type: Number, default: 0 },          // current net balance
    totalCredits: { type: Number, default: 0 },     // lifetime credits
    totalDebits: { type: Number, default: 0 },      // lifetime debits (completed payouts)
    lastTransactionAt: { type: Date },
  },
  { timestamps: true }
);

// ─── WalletTransaction ────────────────────────────────────────────────────────

const walletTransactionSchema = new Schema(
  {
    driver: { type: Types.ObjectId, ref: 'Driver', required: true, index: true },

    type: {
      type: String,
      enum: ['advance', 'balance', 'payout', 'adjustment'],
      required: true,
      index: true,
    },

    direction: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
    },

    amount: { type: Number, required: true, min: 0 },

    // Balance AFTER this transaction (for statement display)
    runningBalance: { type: Number, required: true },

    // Human-readable display fields (also returned directly to frontend)
    title: { type: String, required: true },       // e.g. "Advance", "Balance", "Paid To Bank"
    subtitle: { type: String, default: '' },       // e.g. "#4777181 Jalna - Pune"

    // Booking reference (for advance / balance credits)
    booking: { type: Types.ObjectId, ref: 'Booking', index: true },

    // Payout lifecycle
    status: {
      type: String,
      enum: ['completed', 'pending', 'approved', 'rejected'],
      default: 'completed',
      index: true,
    },

    // Payout-specific
    bankDetails: {
      accountNumber: String,
      ifscCode: String,
      accountHolderName: String,
      bankName: String,
      utrNumber: String,   // filled on approval
    },
    payoutNote: String,    // rejection reason

    note: String,          // admin note for adjustments

    // Audit
    createdBy: { type: Types.ObjectId, ref: 'User' },
    processedBy: { type: Types.ObjectId, ref: 'User' },
    processedAt: { type: Date },
  },
  { timestamps: true }
);

walletTransactionSchema.plugin(paginationPlugin);

export const DriverWallet = mongoose.model('DriverWallet', driverWalletSchema);
export const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);
