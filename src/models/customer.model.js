import mongoose from 'mongoose';
import { paginationPlugin } from '../utils/plugins/pagination.plugin.js';

const addressSchema = new mongoose.Schema({
  street: String,
  city: String,
  state: String,
  pincode: String,
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere' } // [lng, lat]
  }
}, { _id: false });

const customerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  companyName: { type: String, required: true, index: true },
  companyType: String, // e.g., 'proprietorship', 'private_limited'
  gst: { type: String, index: true },
  contactPerson: {
    name: String,
    phone: String,
    email: String
  },
  address: addressSchema,
  billingAddress: addressSchema,
  
  // Reference KYC documents stored in Document collection
  kycDocuments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
  isVerified: { type: Boolean, default: false },
  verifiedAt: Date,
  
  // Business Metrics
  businessMetrics: {
    totalBookings: { type: Number, default: 0 },
    completedBookings: { type: Number, default: 0 },
    cancelledBookings: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    averageBookingValue: { type: Number, default: 0 }
  },
  
  // Credit Management
  creditLimit: {
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    utilized: { type: Number, default: 0 }
  },
  
  // Payment Terms
  paymentTerms: {
    type: String,
    enum: ['prepaid', 'postpaid', 'credit'],
    default: 'prepaid'
  },
  
  // Rating from staff/drivers
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  
  // Account Manager
  accountManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  
  // Bank Details
  bankDetails: [{
    accountNumber: { type: String, required: true, trim: true },
    ifscCode: { type: String, required: true, trim: true, uppercase: true },
    accountHolderName: { type: String, required: true, trim: true },
    bankName: { type: String, required: true, trim: true },
    branchName: { type: String, trim: true },
    accountType: { type: String, enum: ['savings', 'current', 'od'], default: 'current' },
    upiId: { type: String, trim: true },
    isPrimary: { type: Boolean, default: false }
  }],

  // Soft Delete
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Audit Tracking
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  metadata: { type: Object }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Useful indexes
customerSchema.index({ companyName: 1 });
customerSchema.index({ gst: 1 }, { partialFilterExpression: { gst: { $exists: true, $ne: null } } });
customerSchema.index({ isDeleted: 1, createdAt: -1 });
customerSchema.index({ 'businessMetrics.totalSpent': -1 });

/* Virtual Fields */

// Available Credit
customerSchema.virtual('availableCredit').get(function() {
  return this.creditLimit.amount - this.creditLimit.utilized;
});

// Credit Utilization Percentage
customerSchema.virtual('creditUtilization').get(function() {
  if (this.creditLimit.amount === 0) return 0;
  return (this.creditLimit.utilized / this.creditLimit.amount) * 100;
});

/* Static Methods */

// Find active customers
customerSchema.statics.findActive = function() {
  return this.find({ isDeleted: false });
};

// Find verified customers
customerSchema.statics.findVerified = function() {
  return this.find({ isDeleted: false, isVerified: true });
};

// Search customers
customerSchema.statics.search = function(searchTerm) {
  return this.find({
    isDeleted: false,
    $or: [
      { companyName: { $regex: searchTerm, $options: 'i' } },
      { gst: { $regex: searchTerm, $options: 'i' } },
      { 'contactPerson.name': { $regex: searchTerm, $options: 'i' } },
      { 'contactPerson.phone': { $regex: searchTerm, $options: 'i' } }
    ]
  });
};

/* Instance Methods */

// Soft delete
customerSchema.methods.softDelete = function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  return this.save();
};

// Update business metrics
customerSchema.methods.updateMetrics = async function(bookingData) {
  this.businessMetrics.totalBookings += 1;
  
  if (bookingData.status === 'closed' || bookingData.status === 'delivered') {
    this.businessMetrics.completedBookings += 1;
  } else if (bookingData.status === 'cancelled') {
    this.businessMetrics.cancelledBookings += 1;
  }
  
  if (bookingData.finalAmount) {
    this.businessMetrics.totalSpent += bookingData.finalAmount;
    this.businessMetrics.averageBookingValue = 
      this.businessMetrics.totalSpent / this.businessMetrics.completedBookings;
  }
  
  return this.save();
};

// Update credit utilization
customerSchema.methods.updateCreditUtilization = function(amount, operation = 'increase') {
  if (operation === 'increase') {
    this.creditLimit.utilized += amount;
  } else if (operation === 'decrease') {
    this.creditLimit.utilized = Math.max(0, this.creditLimit.utilized - amount);
  }
  return this.save();
};

// Update rating
customerSchema.methods.updateRating = function(newRating) {
  const totalRating = (this.rating.average * this.rating.count) + newRating;
  this.rating.count += 1;
  this.rating.average = totalRating / this.rating.count;
  return this.save();
};

// Adds Customer.paginate()
customerSchema.plugin(paginationPlugin);

export default mongoose.model('Customer', customerSchema);
