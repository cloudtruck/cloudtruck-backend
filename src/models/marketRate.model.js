import mongoose from 'mongoose';
import { paginationPlugin } from '../utils/plugins/pagination.plugin.js';

const priceTrendSchema = new mongoose.Schema({
  month: { type: String, required: true }, // e.g. "Jan", "Feb"
  year: { type: Number, required: true },
  price: { type: Number, required: true }
}, { _id: false });

const marketRateSchema = new mongoose.Schema({
  fromCity: {
    type: String,
    required: true,
    trim: true,
    index: true
  },

  toCity: {
    type: String,
    required: true,
    trim: true,
    index: true
  },

  // Master data key from 'truck-type' category (e.g. '32ft-mxl', 'eicher-17ft')
  truckType: {
    type: String,
    required: true,
    trim: true,
    index: true
  },

  price: {
    type: Number,
    required: true
  },

  distance: {
    type: Number // in km
  },

  estimatedTime: {
    type: String // e.g. "24-28 hrs"
  },

  bookingCount: {
    type: Number,
    default: 0
  },

  priceTrends: [priceTrendSchema],

  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  // Soft Delete
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/* Indexes */
marketRateSchema.index({ fromCity: 1, toCity: 1, truckType: 1 });

/* Virtuals */
marketRateSchema.virtual('routeSummary').get(function () {
  return `${this.fromCity} → ${this.toCity}`;
});

/* Static Methods */
marketRateSchema.statics.findActive = function () {
  return this.find({ isDeleted: false, isActive: true });
};

/* Instance Methods */
marketRateSchema.methods.softDelete = function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.isActive = false;
  return this.save();
};

/* Pagination Plugin */
marketRateSchema.plugin(paginationPlugin);

export default mongoose.model('MarketRate', marketRateSchema);
