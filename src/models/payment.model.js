import mongoose from 'mongoose';

const { Schema } = mongoose;

const refundSchema = new Schema({
  amount: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },
  merchantTransactionId: String,
  initiatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  initiatedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: Date
});

const paymentSchema = new Schema(
  {
    booking: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    paymentMethod: {
      type: String,
      enum: ['online', 'neft', 'rtgs', 'cheque', 'cash', 'upi'],
      required: true
    },
    gateway: {
      type: String,
      enum: ['phonepe', 'razorpay', 'paytm', 'manual'],
      default: 'manual'
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'refunded'],
      default: 'pending',
      index: true
    },
    merchantTransactionId: {
      type: String,
      unique: true,
      sparse: true
    },
    transactionId: {
      type: String,
      index: true
    },
    gatewayOrderId: String,
    referenceNumber: String,
    transactionDate: Date,
    paidAt: Date,
    gatewayResponse: Schema.Types.Mixed,
    failureReason: String,
    remarks: String,
    refunds: [refundSchema],
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Indexes
paymentSchema.index({ booking: 1, status: 1 });
paymentSchema.index({ customer: 1, createdAt: -1 });

// Exclude deleted payments by default
paymentSchema.pre(/^find/, function () {
  this.where({ isDeleted: false });
});

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
