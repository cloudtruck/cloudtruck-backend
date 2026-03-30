import mongoose from 'mongoose';
import { paginationPlugin } from '../utils/plugins/pagination.plugin.js';

const { Schema } = mongoose;

const bankSnapshotSchema = new Schema(
  {
    accountNumber:     String,
    ifscCode:          String,
    accountHolderName: String,
    bankName:          String,
  },
  { _id: false }
);

const supplierPaymentSchema = new Schema(
  {
    supplier: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    booking: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },

    amount: { type: Number, required: true, min: 0 },

    paymentType: {
      type: String,
      enum: ['advance', 'balance', 'detention', 'adjustment'],
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ['neft', 'rtgs', 'cheque', 'cash', 'upi'],
      required: true,
    },

    // Two-step approval: pending → approved (manager) → paid (accounts + UTR)
    status: {
      type: String,
      enum: ['pending', 'approved', 'paid', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },

    referenceNumber: { type: String, default: null }, // UTR / cheque number
    transactionDate: { type: Date, default: null },
    paidAt:          { type: Date, default: null },
    remarks:         { type: String, default: null },

    // Immutable snapshot of supplier bank details at time of payment creation
    // Prevents historical records from changing if supplier updates bank info later
    bankDetailsSnapshot: { type: bankSnapshotSchema, default: null },

    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    requestedAt: { type: Date, default: Date.now },

    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },

    paidBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // accounts team member

    rejectionReason: { type: String, default: null },

    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* Indexes */
supplierPaymentSchema.index({ supplier: 1, status: 1 });
supplierPaymentSchema.index({ booking: 1, paymentType: 1 });
supplierPaymentSchema.index({ status: 1, createdAt: -1 });
supplierPaymentSchema.index(
  { referenceNumber: 1 },
  { sparse: true }
);

/* Plugin */
supplierPaymentSchema.plugin(paginationPlugin);

export default mongoose.model('SupplierPayment', supplierPaymentSchema);
