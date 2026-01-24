import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema({
  branchCode: { 
    type: String, 
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    index: true
  },
  branchName: { 
    type: String, 
    required: true,
    trim: true,
    index: true
  },
  assignedCities: [{ 
    type: String,
    trim: true
  }],
  region: { 
    type: String,
    trim: true,
    index: true
  },
  branchManager: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Staff'
  },
  
  // Contact & Address
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' }
  },
  contactDetails: {
    phone: String,
    email: String
  },
  
  // Resources
  employees: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Staff' 
  }],
  vehicles: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Vehicle' 
  }],
  
  // Performance Metrics
  metrics: {
    bookingsCount: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },
    avgDeliveryTime: { type: Number, default: 0 }
  },
  
  isActive: { 
    type: Boolean, 
    default: true,
    index: true
  },
  
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

// Indexes
branchSchema.index({ region: 1, isActive: 1, isDeleted: 1 });
branchSchema.index({ assignedCities: 1 });

/* Virtual Fields */
branchSchema.virtual('employeeCount').get(function() {
  return this.employees?.length || 0;
});

branchSchema.virtual('vehicleCount').get(function() {
  return this.vehicles?.length || 0;
});

/* Static Methods */
branchSchema.statics.findActive = function() {
  return this.find({ isDeleted: false, isActive: true });
};

branchSchema.statics.findByRegion = function(region) {
  return this.find({ isDeleted: false, isActive: true, region });
};

branchSchema.statics.findByCity = function(city) {
  return this.findOne({ 
    isDeleted: false, 
    isActive: true, 
    assignedCities: city 
  });
};

// Check for city conflicts
branchSchema.statics.checkCityConflict = async function(cities, excludeBranchId = null) {
  const query = {
    isDeleted: false,
    assignedCities: { $in: cities }
  };
  if (excludeBranchId) {
    query._id = { $ne: excludeBranchId };
  }
  
  const conflicts = await this.find(query).select('branchName assignedCities');
  if (conflicts.length > 0) {
    const conflictDetails = conflicts.map(branch => ({
      branch: branch.branchName,
      cities: branch.assignedCities.filter(city => cities.includes(city))
    }));
    return conflictDetails;
  }
  return null;
};

/* Instance Methods */
branchSchema.methods.softDelete = function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.isActive = false;
  return this.save();
};

branchSchema.methods.addEmployee = function(staffId) {
  if (!this.employees.includes(staffId)) {
    this.employees.push(staffId);
  }
  return this.save();
};

branchSchema.methods.removeEmployee = function(staffId) {
  this.employees = this.employees.filter(id => !id.equals(staffId));
  return this.save();
};

branchSchema.methods.addVehicle = function(vehicleId) {
  if (!this.vehicles.includes(vehicleId)) {
    this.vehicles.push(vehicleId);
  }
  return this.save();
};

branchSchema.methods.removeVehicle = function(vehicleId) {
  this.vehicles = this.vehicles.filter(id => !id.equals(vehicleId));
  return this.save();
};

branchSchema.methods.updateMetrics = function(updates) {
  Object.assign(this.metrics, updates);
  return this.save();
};

export default mongoose.model('Branch', branchSchema);
