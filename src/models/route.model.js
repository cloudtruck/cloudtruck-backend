import mongoose from 'mongoose';
import { paginationPlugin } from '../utils/plugins/pagination.plugin.js';

// Reusable address schema for pickup and drop locations
const addressSchema = new mongoose.Schema({
  city: { type: String, required: true, trim: true, index: true },
  address: { type: String, trim: true },
  pincode: { type: String, trim: true, match: [/^\d{6}$/, 'Invalid pincode'] },
  landmark: String,
  contactPerson: {
    name: String,
    phone: String
  },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [lng, lat]
  }
}, { _id: false });

const routeSchema = new mongoose.Schema({
  // Owner of the route
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
    
  },
  
  // Route name (user-defined)
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  // Route description
  description: String,
  
  // Pickup and drop locations
  pickup: {
    type: addressSchema,
    required: true
  },
  
  drop: {
    type: addressSchema,
    required: true
  },
  
  // Distance and duration
  distance: {
    value: Number, // in km
    unit: { type: String, default: 'km' }
  },
  
  estimatedDuration: Number, // in minutes
  
  // Preferred truck type for this route
  preferredTruckType: String,
  preferredBodyType: String,
  
  // Average costs for this route
  averageCost: {
    amount: Number,
    currency: { type: String, default: 'INR' }
  },
  
  // Usage Statistics
  usageCount: {
    type: Number,
    default: 0
  },
  
  lastUsed: Date,
  
  // Bookings created from this route
  bookings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  }],
  
  // Route-specific notes or instructions
  notes: String,
  specialInstructions: String,
  
  // Route categorization
  category: {
    type: String,
    enum: ['regular', 'express', 'bulk', 'special'],
    default: 'regular'
  },
  
  tags: [String], // e.g., ['fragile', 'temperature-controlled', 'hazardous']
  
  // Status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Mark as favorite
  isFavorite: {
    type: Boolean,
    default: false,
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
  
  // Audit Tracking
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
routeSchema.index({ customer: 1, isDeleted: 1, isActive: 1 });
routeSchema.index({ customer: 1, isFavorite: 1 });
routeSchema.index({ 'pickup.city': 1, 'drop.city': 1 });
routeSchema.index({ name: 'text', description: 'text' }); // Text search
routeSchema.index({ lastUsed: -1 });
routeSchema.index({ usageCount: -1 });
routeSchema.index({ 'pickup.location': '2dsphere' });
routeSchema.index({ 'drop.location': '2dsphere' });

/* Virtual Fields */

// Route summary
routeSchema.virtual('summary').get(function() {
  return `${this.pickup.city} → ${this.drop.city}`;
});

// Distance in formatted string
routeSchema.virtual('distanceFormatted').get(function() {
  if (!this.distance || !this.distance.value) return 'N/A';
  return `${this.distance.value} ${this.distance.unit}`;
});

// Duration in formatted string
routeSchema.virtual('durationFormatted').get(function() {
  if (!this.estimatedDuration) return 'N/A';
  const hours = Math.floor(this.estimatedDuration / 60);
  const minutes = this.estimatedDuration % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
});

/* Static Methods */

// Find active routes
routeSchema.statics.findActive = function() {
  return this.find({ isDeleted: false, isActive: true });
};

// Find routes for customer
routeSchema.statics.findByCustomer = function(customerId, options = {}) {
  const query = {
    customer: customerId,
    isDeleted: false
  };
  
  if (options.onlyActive !== false) {
    query.isActive = true;
  }
  
  if (options.onlyFavorites) {
    query.isFavorite = true;
  }
  
  let queryBuilder = this.find(query);
  
  // Sort by last used or usage count
  if (options.sortBy === 'lastUsed') {
    queryBuilder = queryBuilder.sort({ lastUsed: -1 });
  } else if (options.sortBy === 'popular') {
    queryBuilder = queryBuilder.sort({ usageCount: -1 });
  } else {
    queryBuilder = queryBuilder.sort({ createdAt: -1 });
  }
  
  return queryBuilder;
};

// Find routes between cities
routeSchema.statics.findBetweenCities = function(pickupCity, dropCity) {
  return this.find({
    'pickup.city': { $regex: new RegExp(pickupCity, 'i') },
    'drop.city': { $regex: new RegExp(dropCity, 'i') },
    isDeleted: false,
    isActive: true
  }).sort({ usageCount: -1 });
};

// Search routes
routeSchema.statics.search = function(customerId, searchTerm) {
  return this.find({
    customer: customerId,
    isDeleted: false,
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } },
      { 'pickup.city': { $regex: searchTerm, $options: 'i' } },
      { 'drop.city': { $regex: searchTerm, $options: 'i' } },
      { tags: { $in: [new RegExp(searchTerm, 'i')] } }
    ]
  });
};

// Get popular routes for customer
routeSchema.statics.getMostUsed = function(customerId, limit = 10) {
  return this.find({
    customer: customerId,
    isDeleted: false,
    isActive: true,
    usageCount: { $gt: 0 }
  })
  .sort({ usageCount: -1 })
  .limit(limit);
};

/* Instance Methods */

// Soft delete
routeSchema.methods.softDelete = function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.isActive = false;
  return this.save();
};

// Mark route as used (when creating booking from it)
routeSchema.methods.markAsUsed = function(bookingId = null) {
  this.usageCount += 1;
  this.lastUsed = new Date();
  
  if (bookingId && !this.bookings.includes(bookingId)) {
    this.bookings.push(bookingId);
  }
  
  return this.save();
};

// Toggle favorite status
routeSchema.methods.toggleFavorite = function() {
  this.isFavorite = !this.isFavorite;
  return this.save();
};

// Update route statistics
routeSchema.methods.updateStatistics = function(distance, duration, cost) {
  // Update distance if provided
  if (distance) {
    this.distance = {
      value: distance,
      unit: 'km'
    };
  }
  
  // Update duration if provided
  if (duration) {
    this.estimatedDuration = duration;
  }
  
  // Update average cost (running average)
  if (cost && this.usageCount > 0) {
    const currentTotal = (this.averageCost?.amount || 0) * this.usageCount;
    const newTotal = currentTotal + cost;
    this.averageCost = {
      amount: newTotal / (this.usageCount + 1),
      currency: 'INR'
    };
  } else if (cost) {
    this.averageCost = {
      amount: cost,
      currency: 'INR'
    };
  }
  
  return this.save();
};

// Clone route with new name
routeSchema.methods.clone = async function(newName, userId) {
  const clonedRoute = new this.constructor({
    customer: this.customer,
    name: newName || `${this.name} (Copy)`,
    description: this.description,
    pickup: this.pickup,
    drop: this.drop,
    distance: this.distance,
    estimatedDuration: this.estimatedDuration,
    preferredTruckType: this.preferredTruckType,
    preferredBodyType: this.preferredBodyType,
    notes: this.notes,
    specialInstructions: this.specialInstructions,
    category: this.category,
    tags: [...this.tags],
    createdBy: userId,
    isActive: true
  });
  
  return clonedRoute.save();
};

/* Middleware */

// Update timestamps on save
routeSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedBy = this.updatedBy || this.createdBy;
  }
  next();
});

// Adds Route.paginate()
routeSchema.plugin(paginationPlugin);

export default mongoose.model('Route', routeSchema);
