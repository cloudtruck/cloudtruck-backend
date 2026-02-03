import mongoose from 'mongoose';
import { paginationPlugin } from '../utils/plugins/pagination.plugin.js';

const { Schema } = mongoose;

/**
 * Item Schema for E-way Bill
 * Represents goods being transported
 */
const itemSchema = new Schema(
  {
    hsnCode: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{4,8}$/, 'Invalid HSN code format']
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Quantity cannot be negative']
    },
    unit: {
      type: String,
      required: true,
      enum: ['KGS', 'MTR', 'LTR', 'PCS', 'BOX', 'TON', 'BAG', 'ROLL', 'BUNDLE', 'OTHER']
    },
    taxableValue: {
      type: Number,
      required: true,
      min: [0, 'Taxable value cannot be negative']
    },
    cgst: {
      type: Number,
      default: 0,
      min: [0, 'CGST cannot be negative']
    },
    sgst: {
      type: Number,
      default: 0,
      min: [0, 'SGST cannot be negative']
    },
    igst: {
      type: Number,
      default: 0,
      min: [0, 'IGST cannot be negative']
    }
  },
  { _id: false }
);

/**
 * Part B History Schema
 * Tracks all Part-B updates with audit trail
 */
const partBHistorySchema = new Schema(
  {
    vehicleNumber: {
      type: String,
      trim: true,
      uppercase: true
    },
    transporterId: {
      type: String,
      trim: true
    },
    transMode: {
      type: String,
      enum: ['ROAD', 'RAIL', 'AIR', 'SHIP']
    },
    transDocNo: String,
    transDate: Date,
    reason: {
      type: String,
      required: true,
      enum: [
        'VEHICLE_BREAKDOWN',
        'DRIVER_CHANGE',
        'ROUTE_CHANGE',
        'TRANSSHIPMENT',
        'FIRST_ASSIGNMENT',
        'OTHER'
      ]
    },
    notes: String,
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    oldValue: {
      vehicleNumber: String,
      transporterId: String
    },
    newValue: {
      vehicleNumber: String,
      transporterId: String
    }
  },
  { _id: true }
);

/**
 * Auto Sync Metadata Schema
 * Tracks automated Part-B sync from booking assignment
 */
const autoSyncPartBSchema = new Schema(
  {
    autoSynced: {
      type: Boolean,
      default: false
    },
    syncedAt: Date,
    syncedFromVehicle: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle'
    }
  },
  { _id: false }
);

/**
 * Expiry Tracking Schema
 * Manages E-way bill validity and expiry alerts
 */
const expiryTrackingSchema = new Schema(
  {
    validFrom: {
      type: Date,
      required: true
    },
    validUpto: {
      type: Date,
      required: true,
      index: true
    },
    expiryAlertSent: {
      type: Boolean,
      default: false,
      index: true
    },
    expiryNotifiedAt: Date
  },
  { _id: false }
);

/**
 * E-way Bill Schema
 * Complete E-way bill with Part-A and Part-B
 */
const ewayBillSchema = new Schema(
  {
    // Unique E-way Bill Number (can be from govt portal or internal)
    ewayBillNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },

    // Linked Booking
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true
    },

    // Status
    status: {
      type: String,
      required: true,
      enum: ['draft', 'active', 'expired', 'cancelled'],
      default: 'draft',
      index: true
    },

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },

    // ========== PART A: Consignment Details ==========
    
    // Supplier/Consignor GSTIN
    fromGstin: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format']
    },

    // Recipient/Consignee GSTIN
    toGstin: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format']
    },

    // Invoice/Document Details
    documentNumber: {
      type: String,
      required: true,
      trim: true
    },

    documentDate: {
      type: Date,
      required: true
    },

    documentType: {
      type: String,
      required: true,
      enum: ['INV', 'BIL', 'CHL', 'DCN', 'OTH'],
      default: 'INV'
    },

    // Item List
    itemList: {
      type: [itemSchema],
      required: true,
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'At least one item is required'
      }
    },

    // Part A Total Values
    partATotalValue: {
      type: Number,
      required: true,
      min: [0, 'Total value cannot be negative']
    },

    totalTax: {
      type: Number,
      required: true,
      min: [0, 'Total tax cannot be negative']
    },

    // ========== PART B: Transporter Details ==========
    
    vehicleNumber: {
      type: String,
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/, 'Invalid vehicle number format']
    },

    transporterId: {
      type: String,
      trim: true,
      uppercase: true
    },

    transMode: {
      type: String,
      enum: ['ROAD', 'RAIL', 'AIR', 'SHIP'],
      default: 'ROAD'
    },

    transDocNo: {
      type: String,
      trim: true
    },

    transDate: {
      type: Date
    },

    // ========== Auto Sync Metadata ==========
    autoSyncPartB: {
      type: autoSyncPartBSchema,
      default: () => ({
        autoSynced: false
      })
    },

    // ========== Expiry Tracking ==========
    expiryTracking: {
      type: expiryTrackingSchema,
      required: true
    },

    // ========== Part B History ==========
    partBHistory: {
      type: [partBHistorySchema],
      default: []
    },

    // ========== Audit Fields ==========
    
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      required: true
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Staff'
    },

    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'Staff'
    },

    cancelledAt: Date,

    cancellationReason: String,

    // Sync metadata from Govt Portal
    syncMetadata: {
      lastSyncAt: Date,
      lastSyncBy: {
        type: Schema.Types.ObjectId,
        ref: 'Staff'
      },
      syncStatus: {
        type: String,
        enum: ['pending', 'success', 'failed'],
        default: 'pending'
      }
    },

    // Metadata for additional information
    metadata: {
      type: Object,
      default: {}
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for common queries
ewayBillSchema.index({ bookingId: 1, isDeleted: 1 });
ewayBillSchema.index({ status: 1, isDeleted: 1 });
ewayBillSchema.index({ 'expiryTracking.validUpto': 1, 'expiryTracking.expiryAlertSent': 1 });
ewayBillSchema.index({ fromGstin: 1 });
ewayBillSchema.index({ toGstin: 1 });
ewayBillSchema.index({ createdAt: -1 });

// Virtual for checking if E-way bill is expiring soon (within 24 hours)
ewayBillSchema.virtual('isExpiringSoon').get(function () {
  if (!this.expiryTracking?.validUpto) return false;
  const now = new Date();
  const expiryDate = new Date(this.expiryTracking.validUpto);
  const hoursUntilExpiry = (expiryDate - now) / (1000 * 60 * 60);
  return hoursUntilExpiry > 0 && hoursUntilExpiry <= 24;
});

// Virtual for checking if expired
ewayBillSchema.virtual('isExpired').get(function () {
  if (!this.expiryTracking?.validUpto) return false;
  return new Date() > new Date(this.expiryTracking.validUpto);
});

// Apply pagination plugin
ewayBillSchema.plugin(paginationPlugin);

const EwayBill = mongoose.model('EwayBill', ewayBillSchema);

export default EwayBill;
