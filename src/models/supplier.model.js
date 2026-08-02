import mongoose from 'mongoose';
import { paginationPlugin } from '../utils/plugins/pagination.plugin.js';

const { Schema } = mongoose;

const bankDetailsSchema = new Schema(
  {
    accountNumber: { type: String, select: false },
    ifscCode: String,
    accountHolderName: String,
    bankName: String,
  },
  { _id: false }
);

const documentsSchema = new Schema(
  {
    gstCertificate:      { type: Schema.Types.ObjectId, ref: 'Document', default: null },
    companyRegistration: { type: Schema.Types.ObjectId, ref: 'Document', default: null },
    cancelledCheque:     { type: Schema.Types.ObjectId, ref: 'Document', default: null },
    panDocument:         { type: Schema.Types.ObjectId, ref: 'Document', default: null },
    aadharDocument:      { type: Schema.Types.ObjectId, ref: 'Document', default: null },
  },
  { _id: false }
);

const supplierSchema = new Schema(
  {
    supplierType: {
      type: String,
      enum: ['company', 'individual'],
      required: true,
      index: true,
    },

    // Identity anchors — one of these will be set depending on supplierType
    // company:    user is set (role:'supplier' User record)
    // individual: driver is set (role:'driver' Driver record — person stays on mobile app)
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    driver: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
      index: true, // sparse-like via partial queries
    },

    displayName:               { type: String, required: true, trim: true },
    companyName:               { type: String, trim: true, default: null },
    gstin:                     { type: String, trim: true, uppercase: true, default: null },
    companyRegistrationNumber: { type: String, trim: true, default: null },
    panNumber:                 { type: String, trim: true, uppercase: true, default: null },
    aadharNumber:              { type: String, trim: true, default: null },

    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: null },
    city:  { type: String, trim: true, default: null },

    verificationStatus: {
      type: String,
      enum: ['pending', 'documents-submitted', 'verified', 'rejected'],
      default: 'pending',
      index: true,
    },
    verifiedBy:      { type: Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt:      { type: Date, default: null },
    rejectionReason: { type: String, default: null },

    documents: { type: documentsSchema, default: () => ({}) },

    bankDetails: { type: bankDetailsSchema, default: null },

    // Multi-account support
    bankAccounts: [
      {
        accountNumber:     { type: String, select: false },
        ifscCode:          String,
        accountHolderName: String,
        bankName:          String,
        branchName:        String,
        isPrimary:         { type: Boolean, default: false },
      },
    ],

    // Maintained by addDriverToFleet / removeDriverFromFleet
    // totalVehicles is intentionally excluded — derived live from Vehicle collection to avoid drift
    fleetStats: {
      totalDrivers:  { type: Number, default: 0, min: 0 },
      activeDrivers: { type: Number, default: 0, min: 0 },
    },

    performance: {
      totalBookings:     { type: Number, default: 0 },
      completedBookings: { type: Number, default: 0 },
      totalRevenue:      { type: Number, default: 0 },
    },

    isBlacklisted:    { type: Boolean, default: false, index: true },
    blacklistReason:  { type: String, default: null },
    blacklistedAt:    { type: Date, default: null },
    blacklistedBy:    { type: Schema.Types.ObjectId, ref: 'User', default: null },

    isDeleted:  { type: Boolean, default: false, index: true },
    deletedAt:  { type: Date, default: null },
    deletedBy:  { type: Schema.Types.ObjectId, ref: 'User', default: null },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* Indexes */
supplierSchema.index({ verificationStatus: 1, isDeleted: 1 });
supplierSchema.index({ isBlacklisted: 1, isDeleted: 1 });
supplierSchema.index({ city: 1 });
supplierSchema.index({ createdAt: -1 });
// GSTIN uniqueness — sparse so null values don't conflict
supplierSchema.index(
  { gstin: 1 },
  { unique: true, partialFilterExpression: { gstin: { $ne: null }, isDeleted: false } }
);
// PAN uniqueness — sparse so null values don't conflict
supplierSchema.index(
  { panNumber: 1 },
  { unique: true, partialFilterExpression: { panNumber: { $ne: null }, isDeleted: false } }
);

/* Pre-validate hook — enforce identity anchor required fields */
supplierSchema.pre('validate', function (next) {
  if (this.supplierType === 'company') {
    if (!this.user) {
      return next(new Error('user is required for company suppliers'));
    }
  }
  if (this.supplierType === 'individual') {
    if (!this.driver) {
      return next(new Error('driver is required for individual suppliers'));
    }
  }
  next();
});

/* Static Methods */

supplierSchema.statics.findActive = function () {
  return this.find({ isDeleted: false, isBlacklisted: false });
};

supplierSchema.statics.findByUser = function (userId) {
  return this.findOne({ user: userId, isDeleted: false });
};

supplierSchema.statics.findByDriver = function (driverId) {
  return this.findOne({ driver: driverId, isDeleted: false });
};

supplierSchema.statics.search = function (term) {
  const regex = new RegExp(term, 'i');
  return this.find({
    isDeleted: false,
    $or: [
      { displayName: regex },
      { companyName: regex },
      { phone: regex },
      { city: regex },
      { gstin: regex },
      { panNumber: regex },
    ],
  });
};

/* Instance Methods */

supplierSchema.methods.softDelete = function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  return this.save();
};

supplierSchema.methods.blacklist = function (reason, userId) {
  this.isBlacklisted = true;
  this.blacklistReason = reason;
  this.blacklistedAt = new Date();
  this.blacklistedBy = userId;
  return this.save();
};

supplierSchema.methods.removeFromBlacklist = function () {
  this.isBlacklisted = false;
  this.blacklistReason = null;
  this.blacklistedAt = null;
  this.blacklistedBy = null;
  return this.save();
};

// Pre-save hook to extract PAN from GSTIN if not explicitly provided
supplierSchema.pre('save', function (next) {
  if (this.gstin && (!this.panNumber || (this.isModified('gstin') && !this.isModified('panNumber')))) {
    const cleanGst = this.gstin.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (cleanGst.length === 15) {
      this.panNumber = cleanGst.substring(2, 12);
    }
  }
  next();
});

/* Plugin */
supplierSchema.plugin(paginationPlugin);

export default mongoose.model('Supplier', supplierSchema);
