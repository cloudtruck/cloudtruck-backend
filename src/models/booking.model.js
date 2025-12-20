// models/booking.model.js
import mongoose from 'mongoose';
import { paginationPlugin } from '../utils/plugins/pagination.plugin.js';

const { Schema } = mongoose;

/**
 * Booking model (cleaned + safe)
 *
 * Notes:
 * - Uses an atomic counter in the 'counters' collection to generate bookingId safely.
 * - Uses GeoJSON fields pickup.location and drop.location (Point).
 * - Uses Document refs for files (cargo/loading/pod images & invoices) — change to your needs.
 * - Excludes heavy fields from default projections via `.select(false)` only where needed (none by default).
 */

const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number], // [lng, lat]
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length === 2 && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90;
        },
        message: 'Invalid coordinates'
      }
    }
  },
  { _id: false }
);

const contactPersonSchema = new Schema(
  {
    name: String,
    phone: String
  },
  { _id: false }
);

const addressBlockSchema = new Schema(
  {
    city: { type: String, trim: true, index: true },
    address: { type: String, trim: true },
    pincode: { type: String, trim: true, match: [/^\d{6}$/, 'Invalid pincode'] },
    landmark: String,
    contactPerson: { type: contactPersonSchema, default: {} },
    location: { type: pointSchema, required: true }
  },
  { _id: false }
);

const bookingSchema = new Schema(
  {
    bookingId: { type: String, unique: true, index: true },

    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },

    // Locations
    pickup: { type: addressBlockSchema, required: true },
    drop: { type: addressBlockSchema, required: true },

    // Distance
    estimatedDistance: {
      value: Number, // km
      calculatedAt: Date
    },

    // Cargo
    materialType: {
      type: String,
      required: true,
      trim: true,
      index: true,
      enum: [
        'FMCG',
        'electronics',
        'furniture',
        'steel',
        'cement',
        'tiles',
        'chemicals',
        'textiles',
        'agriculture',
        'automobile-parts',
        'machinery',
        'paper',
        'pharma',
        'plastic',
        'food-grains',
        'vegetables-fruits',
        'general-cargo',
        'other'
      ]
    },

    weight: {
      value: { type: Number, required: true, min: 1 },
      unit: { type: String, enum: ['kg', 'tons', 'quintal'], default: 'kg' }
    },

    volume: {
      value: Number,
      unit: { type: String, enum: ['cubic-ft', 'cubic-meter'] }
    },

    quantity: {
      value: Number,
      unit: { type: String, enum: ['pieces', 'boxes', 'pallets', 'bags'] }
    },

    isHazardous: { type: Boolean, default: false },
    isFragile: { type: Boolean, default: false },

    requiresTemperatureControl: { type: Boolean, default: false },
    temperatureRange: {
      min: Number,
      max: Number,
      unit: { type: String, enum: ['celsius', 'fahrenheit'] }
    },

    // Truck Requirements
    truckTypeNeeded: { type: String, required: true, index: true },
    numberOfTrucks: { type: Number, default: 1, min: 1, max: 10 },
    bodyType: { type: String, required: true, enum: ['open', 'closed', 'container', 'tanker', 'flatbed'], index: true },
    specialRequirements: [String],

    // Scheduling
    loadDate: { type: Date, required: true, index: true },
    loadTime: { type: String, required: true },
    expectedDeliveryDate: Date,
    additionalInstructions: { type: String, maxlength: 1000 },

    // Assignment
    driver: { type: Schema.Types.ObjectId, ref: 'Driver', index: true, default: null },
    vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', index: true, default: null },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    assignedAt: { type: Date, index: true },

    // Status
    status: {
      type: String,
      enum: [
        'created',
        'under-review',
        'assigned',
        'driver-enroute-to-pickup',
        'reached-pickup',
        'loaded',
        'in-transit',
        'reached-destination',
        'delivered',
        'pod-received',
        'closed',
        'cancelled'
      ],
      default: 'created',
      required: true,
      index: true
    },

    statusHistory: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, required: true, default: Date.now },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        location: { type: pointSchema },
        notes: String,
        images: [{ type: Schema.Types.ObjectId, ref: 'Document' }]
      }
    ],

    // Pricing & Payment
    expectedAmount: { type: Number, min: 0 },
    advanceRequired: { type: Number, required: true, min: 0 },
    finalAmount: { type: Number, min: 0 },
    pricingBreakdown: {
      baseFreight: Number,
      loadingCharges: Number,
      unloadingCharges: Number,
      tollCharges: Number,
      detentionCharges: Number,
      extraCharges: Number,
      discount: Number,
      gst: Number,
      totalAmount: Number
    },

    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'partial', 'failed', 'refunded'], default: 'unpaid', required: true, index: true },
    payments: [{ type: Schema.Types.ObjectId, ref: 'Payment' }],

    // Documents - prefer Document refs (cloudinary/file metadata stored in Document docs)
    cargoDocuments: [{ type: Schema.Types.ObjectId, ref: 'Document' }],
    loadingDocuments: [{ type: Schema.Types.ObjectId, ref: 'Document' }],
    podDocuments: [{ type: Schema.Types.ObjectId, ref: 'Document' }],
    invoices: [{ type: Schema.Types.ObjectId, ref: 'Document' }],

    // POD
    podDetails: {
      receiverName: String,
      receiverPhone: String,
      receiverSignatureDocument: { type: Schema.Types.ObjectId, ref: 'Document' },
      deliveredAt: Date,
      remarks: String
    },

    // Notes & issues
    staffNotes: [
      {
        note: { type: String, required: true },
        addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        addedAt: { type: Date, default: Date.now },
        isInternal: { type: Boolean, default: true }
      }
    ],

    delays: [
      {
        reason: String,
        delayTime: Number, // in minutes
        reportedAt: Date,
        reportedBy: Schema.Types.ObjectId,
        resolved: { type: Boolean, default: false },
        resolvedAt: Date
      }
    ],

    issues: [
      {
        type: { type: String, enum: ['accident', 'breakdown', 'theft', 'damage', 'delay', 'other'] },
        description: String,
        severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
        reportedAt: Date,
        reportedBy: Schema.Types.ObjectId,
        status: { type: String, enum: ['open', 'in-progress', 'resolved'], default: 'open' },
        resolvedAt: Date,
        resolution: String
      }
    ],

    // Ratings
    customerRating: {
      rating: { type: Number, min: 1, max: 5 },
      feedback: String,
      ratedAt: Date
    },

    driverRating: {
      rating: { type: Number, min: 1, max: 5 },
      feedback: String,
      ratedAt: Date
    },

    cancellationDetails: {
      cancelledBy: Schema.Types.ObjectId,
      cancelledAt: Date,
      reason: String,
      cancellationCharges: Number
    },

    bookingSource: { type: String, enum: ['web', 'mobile-app', 'phone', 'staff', 'api'], default: 'web' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },

    // Soft delete
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Adds Booking.paginate()
bookingSchema.plugin(paginationPlugin);

/* Indexes */
// Geo indexes on pickup/drop location
bookingSchema.index({ 'pickup.location': '2dsphere' });
bookingSchema.index({ 'drop.location': '2dsphere' });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ loadDate: 1 });
bookingSchema.index({ customer: 1, status: 1 });
bookingSchema.index({ driver: 1, status: 1 });
bookingSchema.index({ status: 1, loadDate: 1 });
bookingSchema.index({ paymentStatus: 1 });

/* Virtuals */
// totalPaid should be calculated by aggregating payments. It's left as a placeholder here.
bookingSchema.virtual('totalPaid').get(function () {
  // controllers or services should compute this when needed
  return 0;
});
bookingSchema.virtual('balanceDue').get(function () {
  if (!this.finalAmount) return 0;
  return this.finalAmount - (this.totalPaid || 0);
});

/* Helpers */

// Atomic booking id generator using a counters collection to avoid race conditions
async function generateBookingId() {
  // using native collection to avoid dependency on Counter model
  const coll = mongoose.connection.collection('counters');
  const result = await coll.findOneAndUpdate(
    { _id: 'booking' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' } // returnDocument works with modern drivers
  );
  const seq = result.value ? result.value.seq : 1;
  const date = new Date();
  const year = String(date.getFullYear()).substr(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const seqStr = String(seq).padStart(6, '0');
  return `BK${year}${month}${seqStr}`;
}

/* Pre-save hooks */

// Ensure bookingId created atomically
bookingSchema.pre('save', async function (next) {
  try {
    if (!this.bookingId) {
      this.bookingId = await generateBookingId();
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Maintain statusHistory (add initial status entry on create and push on status changes)
bookingSchema.pre('save', function (next) {
  try {
    if (this.isNew) {
      // ensure statusHistory has initial entry
      this.statusHistory = this.statusHistory || [];
      const initial = {
        status: this.status,
        timestamp: new Date(),
        updatedBy: this.assignedBy || null
      };
      // do not duplicate if already same
      if (!this.statusHistory.length || this.statusHistory[this.statusHistory.length - 1].status !== this.status) {
        this.statusHistory.push(initial);
      }
    } else if (this.isModified('status')) {
      this.statusHistory = this.statusHistory || [];
      const last = this.statusHistory[this.statusHistory.length - 1];
      if (!last || last.status !== this.status) {
        this.statusHistory.push({
          status: this.status,
          timestamp: new Date(),
          updatedBy: this._updatingUser || this.assignedBy || null // optional: set updating user in code before save
        });
      }
    }
    next();
  } catch (err) {
    next(err);
  }
});

/* Statics */

// Find bookings by status
bookingSchema.statics.findByStatus = function (status, options = {}) {
  const query = { status, isDeleted: false };
  return this.find(query)
    .populate('customer', 'companyName phone')
    .populate('driver', 'name phone')
    .populate('vehicle', 'vehicleNumber truckType')
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
    .lean();
};

// Dashboard stats (cleaned aggregate)
bookingSchema.statics.getDashboardStats = async function (dateFrom, dateTo) {
  const matchQuery = { isDeleted: false };
  if (dateFrom || dateTo) {
    matchQuery.createdAt = {};
    if (dateFrom) matchQuery.createdAt.$gte = new Date(dateFrom);
    if (dateTo) matchQuery.createdAt.$lte = new Date(dateTo);
  }

  const bookingStats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: { $ifNull: ['$finalAmount', 0] } }
      }
    }
  ]);

  const paymentStats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$paymentStatus',
        count: { $sum: 1 },
        totalAmount: { $sum: { $ifNull: ['$finalAmount', 0] } }
      }
    }
  ]);

  return { bookingStats, paymentStats };
};

/* Instance methods */

// Haversine distance - compute and store estimatedDistance
bookingSchema.methods.calculateDistance = function () {
  if (!this.pickup || !this.drop) return 0;
  const R = 6371; // Earth radius in km
  const lat1 = this.pickup.location.coordinates[1];
  const lon1 = this.pickup.location.coordinates[0];
  const lat2 = this.drop.location.coordinates[1];
  const lon2 = this.drop.location.coordinates[0];

  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  this.estimatedDistance = { value: Math.round(distance * 10) / 10, calculatedAt: new Date() };
  return this.estimatedDistance.value;
};

bookingSchema.methods.addNote = function (note, userId, isInternal = true) {
  this.staffNotes = this.staffNotes || [];
  this.staffNotes.push({ note, addedBy: userId, isInternal });
  return this.save();
};

bookingSchema.methods.updateStatus = function (newStatus, userId, notes, location) {
  this.status = newStatus;
  const statusUpdate = {
    status: newStatus,
    timestamp: new Date(),
    updatedBy: userId
  };
  if (notes) statusUpdate.notes = notes;
  if (location) statusUpdate.location = location;
  this.statusHistory = this.statusHistory || [];
  this.statusHistory.push(statusUpdate);
  return this.save();
};

// Soft delete
bookingSchema.methods.softDelete = function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.status = 'cancelled';
  return this.save();
};

/* Static Methods */
bookingSchema.statics.findActive = function() {
  return this.find({ isDeleted: false });
};

export default mongoose.model('Booking', bookingSchema);
