//If using MongoDB time-series collections, use that to reduce storage overhead and to optimize range queries.
// models/tracking.model.js
import mongoose from 'mongoose';

const trackingSchema = new mongoose.Schema({
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere' } // [lng, lat]
  },
  speed: Number, // km/h
  heading: Number, // degrees
  accuracy: Number, // meters
  altitude: Number, // meters
  battery: Number, // percentage (0-100)
  isMoving: Boolean,
  activity: {
    type: String,
    enum: ['still', 'walking', 'running', 'driving'],
    default: 'driving'
  },
  provider: {
    type: String,
    enum: ['gps', 'network', 'fused'],
    default: 'gps'
  },
  source: {
    type: String,
    enum: ['app', 'device', 'manual'],
    default: 'app'
  },
  ts: { 
    type: Date, 
    default: Date.now, 
    index: { expires: '90d' } // TTL index: automatic cleanup after 90 days
  },
  meta: {}
}, { 
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

trackingSchema.index({ driver: 1, ts: 1 }); // Forward index for history
trackingSchema.index({ driver: 1, ts: -1, isMoving: 1 }); // For driver activity queries
trackingSchema.index({ booking: 1, ts: -1 }); // For latest location and reverse history
trackingSchema.index({ location: '2dsphere' });

/* Static Methods */

// Get last location of driver
trackingSchema.statics.getLastLocation = function(driverId) {
  return this.findOne({ driver: driverId }).sort({ ts: -1 }).lean();
};

// Get route for booking
trackingSchema.statics.getBookingRoute = function(bookingId, limit = 1000) {
  return this.find({ booking: bookingId })
    .sort({ ts: 1 })
    .limit(limit)
    .lean();
};

export default mongoose.model('Tracking', trackingSchema);
