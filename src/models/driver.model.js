import mongoose from 'mongoose';
import { paginationPlugin } from '../utils/plugins/pagination.plugin.js';

const driverSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  licenseNumber: { type: String, required: true },
  licenseImage: String,
  licenseExpiry: Date,

  // Bank Details
  bankDetails: {
    accountNumber: String,
    ifscCode: String,
    accountHolderName: String,
    bankName: String
  },

  // Emergency Contact
  emergencyContact: {
    name: String,
    phone: String,
    relation: String
  },

  preferredTruckTypes: [String],
  availability: { type: String, enum: ['available', 'on-trip', 'offline'], default: 'available', index: true },

  // Current Assignment
  currentBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    index: true
  },

  nextBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    index: true
  },

  lastKnownLocation: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number] } // [lng, lat]
  },
  lastLocationAt: Date,
  realtimeSource: { type: String, enum: ['socket', 'gps', 'manual'], default: 'socket' },
  isOnline: { type: Boolean, default: false, index: true },
  lastSeenAt: Date,

  vehicles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' }],

  // Performance Metrics
  performance: {
    onTimeDeliveryRate: { type: Number, default: 0, min: 0, max: 100 },
    completedTrips: { type: Number, default: 0 },
    cancelledTrips: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalEarnings: { type: Number, default: 0 }
  },

  // GSTIN
  gstin: { type: String },

  // Documents (account info)
  documents: {
    chequeImage: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    tdsDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    aadhaarDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    panDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' }
  },

  // Account Info Status
  accountInfoStatus: { type: String, enum: ['pending', 'submitted', 'verified', 'rejected'], default: 'pending' },
  accountInfoSubmittedAt: Date,

  city: { type: String },
  referralCode: { type: String },
  kycStatus: { type: String, enum: ['pending', 'submitted', 'verified', 'rejected'], default: 'pending' },
  kycSubmittedAt: Date,

  // KYC - Aadhaar
  aadhaar: {
    number: { type: String, select: false },
    verified: { type: Boolean, default: false },
    document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' }
  },

  // KYC - PAN
  pan: {
    number: { type: String, select: false },
    verified: { type: Boolean, default: false },
    document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' }
  },

  // Verification
  isVerified: { type: Boolean, default: false },
  verifiedAt: Date,

  // Blacklist Tracking
  isBlacklisted: { type: Boolean, default: false, index: true },
  blacklistReason: String,
  blacklistedAt: Date,
  blacklistedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Rejection Tracking (for verification rejections)
  rejectionReason: String,
  rejectedAt: Date,
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Soft Delete
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Audit Tracking
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Adds Driver.paginate()
driverSchema.plugin(paginationPlugin);

// Indexes
driverSchema.index({ licenseNumber: 1 }, { unique: true, partialFilterExpression: { licenseNumber: { $exists: true } } });
driverSchema.index({ availability: 1, isDeleted: 1 });
driverSchema.index({ isBlacklisted: 1, isDeleted: 1 });
driverSchema.index({ 'performance.averageRating': -1 });
// Only index drivers' locations when coordinates are present to avoid indexing empty Point objects
driverSchema.index({ 'lastKnownLocation': '2dsphere' }, { partialFilterExpression: { 'lastKnownLocation.coordinates': { $exists: true } } });
// Explicit index on user for fast lookups and to enforce one-to-one relation (unique when user exists)
driverSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { user: { $exists: true } } });

/* Virtual Fields */

// Check if driver is active and available
driverSchema.virtual('isAvailable').get(function () {
  return !this.isDeleted && !this.isBlacklisted && this.availability === 'available' && !this.currentBooking;
});

// Calculate completion rate
driverSchema.virtual('completionRate').get(function () {
  const total = this.performance.completedTrips + this.performance.cancelledTrips;
  if (total === 0) return 0;
  return (this.performance.completedTrips / total) * 100;
});

/* Static Methods */

// Find active drivers
driverSchema.statics.findActive = function () {
  return this.find({ isDeleted: false, isBlacklisted: false });
};

// Find available drivers
driverSchema.statics.findAvailable = function () {
  return this.find({
    isDeleted: false,
    isBlacklisted: false,
    isVerified: true,
    availability: 'available',
    $and: [
      { $or: [{ nextBooking: null }, { nextBooking: { $exists: false } }] },
      { $or: [{ licenseExpiry: { $gt: new Date() } }, { licenseExpiry: null }, { licenseExpiry: { $exists: false } }] }
    ]
  });
};

// Find drivers near location
driverSchema.statics.findNearby = function (longitude, latitude, maxDistanceInKm = 50) {
  return this.find({
    isDeleted: false,
    isBlacklisted: false,
    availability: 'available',
    lastKnownLocation: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistanceInKm * 1000 // Convert to meters
      }
    }
  });
};

// Search drivers
driverSchema.statics.search = function (searchTerm) {
  return this.find({
    isDeleted: false,
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { licenseNumber: { $regex: searchTerm, $options: 'i' } },
      { 'emergencyContact.phone': { $regex: searchTerm, $options: 'i' } }
    ]
  });
};

/* Instance Methods */

// Soft delete
driverSchema.methods.softDelete = function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  return this.save();
};

// Blacklist driver
driverSchema.methods.blacklist = function (reason, userId) {
  this.isBlacklisted = true;
  this.blacklistReason = reason;
  this.blacklistedAt = new Date();
  this.blacklistedBy = userId;
  this.availability = 'offline';
  return this.save();
};

// Remove from blacklist
driverSchema.methods.removeFromBlacklist = function () {
  this.isBlacklisted = false;
  this.blacklistReason = null;
  this.blacklistedAt = null;
  this.blacklistedBy = null;
  return this.save();
};

// Update availability
driverSchema.methods.updateAvailability = function (status) {
  if (['available', 'on-trip', 'offline'].includes(status)) {
    this.availability = status;
    return this.save();
  }
  throw new Error('Invalid availability status');
};

// Assign booking
driverSchema.methods.assignBooking = function (bookingId) {
  if (this.licenseExpiry && new Date(this.licenseExpiry) < new Date()) {
    throw new Error('Cannot assign booking: driver license has expired');
  }
  this.currentBooking = bookingId;
  this.availability = 'on-trip';
  return this.save();
};

// Complete booking
driverSchema.methods.completeBooking = async function (onTime = true) {
  this.currentBooking = null;
  this.availability = 'available';
  this.performance.completedTrips += 1;

  // Update on-time delivery rate
  if (onTime) {
    const total = this.performance.completedTrips;
    const previousOnTime = (this.performance.onTimeDeliveryRate / 100) * (total - 1);
    this.performance.onTimeDeliveryRate = ((previousOnTime + 1) / total) * 100;
  } else {
    const total = this.performance.completedTrips;
    const previousOnTime = (this.performance.onTimeDeliveryRate / 100) * (total - 1);
    this.performance.onTimeDeliveryRate = (previousOnTime / total) * 100;
  }

  return this.save();
};

// Cancel booking
driverSchema.methods.cancelBooking = function () {
  this.currentBooking = null;
  this.availability = 'available';
  this.performance.cancelledTrips += 1;
  return this.save();
};

// Update rating
driverSchema.methods.updateRating = function (newRating) {
  const totalTrips = this.performance.completedTrips;
  if (totalTrips === 0) {
    this.performance.averageRating = newRating;
  } else {
    const totalRating = (this.performance.averageRating * (totalTrips - 1)) + newRating;
    this.performance.averageRating = totalRating / totalTrips;
  }
  return this.save();
};

// Update location
driverSchema.methods.updateLocation = function (longitude, latitude) {
  this.lastKnownLocation = {
    type: 'Point',
    coordinates: [longitude, latitude]
  };
  this.lastLocationAt = new Date();
  return this.save();
};

export default mongoose.model('Driver', driverSchema);