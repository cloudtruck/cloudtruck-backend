import mongoose from 'mongoose';
import { paginationPlugin } from '../utils/plugins/pagination.plugin.js';

const vehicleSchema = new mongoose.Schema(
  {
    vehicleNumber: {
      type: String,
      required: [true, 'Vehicle number is required'],
      uppercase: true,
      trim: true,
      index: true,
      validate: {
        validator: function(v) {
          // Indian vehicle number format: XX00XX0000 or XX-00-XX-0000
          return /^[A-Z]{2}[0-9]{2}[A-Z]{0,3}[0-9]{4}$/.test(v.replace(/-/g, ''));
        },
        message: 'Invalid vehicle number format'
      }
    },

    truckType: {
      type: String,
      required: [true, 'Truck type is required'],
      index: true
    },

    length: {
      value: {
        type: Number,
        required: [true, 'Vehicle length is required'],
        min: [6, 'Minimum length is 6'],
        max: [60, 'Maximum length is 60']
      },
      unit: {
        type: String,
        enum: ['ft', 'meter'],
        default: 'ft'
      }
    },

    capacity: {
      value: {
        type: Number,
        required: [true, 'Vehicle capacity is required'],
        min: [0.5, 'Minimum capacity is 0.5'],
        max: [40, 'Maximum capacity is 40']
      },
      unit: {
        type: String,
        enum: ['tons', 'kg'],
        default: 'tons'
      }
    },

    height: {
      value: {
        type: Number
      },
      unit: {
        type: String,
        enum: ['ft', 'meter'],
        default: 'ft'
      }
    },

    bodyType: {
      type: String,
      required: [true, 'Body type is required'],
      index: true
    },

    driverPhoneNumber: {
      type: String,
      trim: true
    },

    // City where the truck is currently registered / last known city
    // Stored separately from lastKnownLocation which requires GeoJSON coordinates
    registrationCity: {
      type: String,
      trim: true
    },

    // Documents
    documents: {
      rcDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
      insuranceDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
      fitnessDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
      permitDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
      pucCertificate: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' }
    },

    // Expiry Tracking
    expiryDates: {
      fitness: {
        type: Date,
        index: true
      },
      permit: {
        type: Date,
        index: true
      },
      insurance: {
        type: Date,
        required: [true, 'Insurance expiry date is required'],
        index: true
      },
      puc: Date,
      roadTax: Date
    },

    // Ownership — polymorphic: can be Driver or Supplier (company)
    ownerRef: {
      kind: { type: String, enum: ['Driver', 'Supplier'], default: 'Driver', index: true },
      item: { type: mongoose.Schema.Types.ObjectId, refPath: 'ownerRef.kind', index: true },
    },

    // Kept for backward compatibility with driver mobile app
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: false,
      index: true
    },

    ownershipType: {
      type: String,
      enum: ['own', 'leased', 'attached'],
      default: 'own'
    },

    // Legal owner (Supplier company or individual supplier)
    // owner (Driver) = current operator; supplierOwner (Supplier) = legal/business owner
    supplierOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null, index: true },

    // Manufacturer Details
    manufacturer: {
      brand: {
        type: String,
        trim: true
      },
      model: {
        type: String,
        trim: true
      },
      yearOfManufacture: {
        type: Number,
        min: 1990,
        max: new Date().getFullYear() + 1
      }
    },

    // Engine Details
    engineDetails: {
      engineNumber: { type: String, select: false },
      chassisNumber: { type: String, select: false },
      fuelType: {
        type: String,
        enum: ['diesel', 'petrol', 'cng', 'electric', 'hybrid']
      }
    },

    // GPS/Tracking
    gpsDevice: {
      isInstalled: {
        type: Boolean,
        default: false
      },
      deviceId: String,
      provider: String,
      installedDate: Date
    },

    fastag: {
      isInstalled: {
        type: Boolean,
        default: false
      },
      tagId: String,
      provider: String,
      walletBalance: {
        type: Number,
        default: 0
      }
    },

    // Status Management
    status: {
      type: String,
      enum: ['active', 'inactive', 'under-maintenance', 'retired'],
      default: 'active',
      index: true
    },

    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'expired'],
      default: 'pending',
      index: true
    },

    verificationDetails: {
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      verifiedAt: Date,
      rejectionReason: String,
      remarks: String
    },

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

    availability: {
      type: String,
      enum: ['available', 'on-trip', 'maintenance', 'offline'],
      default: 'available',
      index: true
    },

    // Location (last known)
    lastKnownLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        validate: {
          validator: function(arr) {
            return Array.isArray(arr) && arr.length === 2 &&
                  arr[0] >= -180 && arr[0] <= 180 &&
                  arr[1] >= -90 && arr[1] <= 90;
          },
          message: 'Invalid coordinates'
        },
      },
      city: String,
      state: String,
      updatedAt: Date
    },

    // Performance Stats
    stats: {
      totalTrips: {
        type: Number,
        default: 0,
        min: 0
      },
      completedTrips: {
        type: Number,
        default: 0,
        min: 0
      },
      totalDistanceCovered: {
        type: Number,
        default: 0,
        min: 0 // in kilometers
      },
      averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
      },
      lastTripDate: Date
    },

    // Maintenance Records
    maintenanceHistory: [
      {
        type: {
          type: String,
          enum: ['routine', 'repair', 'accident', 'inspection']
        },
        description: String,
        cost: Number,
        performedAt: Date,
        performedBy: String,
        nextDueDate: Date,
        documents: [String], // Cloudinary URLs
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    // Additional Features
    features: {
      hasGPS: {
        type: Boolean,
        default: false
      },
      hasFastTag: {
        type: Boolean,
        default: false
      },
      hasAC: {
        type: Boolean,
        default: false
      },
      hasHydraulicLift: {
        type: Boolean,
        default: false
      },
      hasTarpaulin: {
        type: Boolean,
        default: false
      },
      isRefrigerated: {
        type: Boolean,
        default: false
      }
    },

    // Insurance Details
    insuranceDetails: {
      provider: String,
      policyNumber: String,
      coverageAmount: Number,
      premiumAmount: Number,
      startDate: Date,
      expiryDate: Date
    },

    // Compliance
    compliance: {
      isCommerciallyRegistered: {
        type: Boolean,
        default: true
      },
      hasNationalPermit: {
        type: Boolean,
        default: false
      },
      hasStatePermit: [String], // Array of state codes
      pollutionCertValid: {
        type: Boolean,
        default: false
      }
    },

    // Notes and Remarks
    notes: [
      {
        note: {
          type: String,
          required: true
        },
        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        addedAt: {
          type: Date,
          default: Date.now
        },
        isInternal: {
          type: Boolean,
          default: true
        }
      }
    ],

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
      ref: 'User'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Adds Vehicle.paginate()
vehicleSchema.plugin(paginationPlugin);

// Indexes for performance
vehicleSchema.index({ vehicleNumber: 1 }, {unique: true, partialFilterExpression: { vehicleNumber: { $exists: true, $ne: null } }});
vehicleSchema.index({ owner: 1, status: 1, availability: 1 });
vehicleSchema.index({ 'ownerRef.kind': 1, 'ownerRef.item': 1 });
vehicleSchema.index({ truckType: 1, bodyType: 1, availability: 1 });
vehicleSchema.index({ 'expiryDates.insurance': 1 }, { partialFilterExpression: { 'expiryDates.insurance': { $exists: true } } });
vehicleSchema.index({ 'expiryDates.fitness': 1 });
vehicleSchema.index({ createdAt: -1 });
vehicleSchema.index({ lastKnownLocation: '2dsphere' }, { partialFilterExpression: { 'lastKnownLocation.coordinates': { $exists: true } } });

// Virtual for checking if documents are expired
vehicleSchema.virtual('isDocumentsValid').get(function () {
  if (!this.expiryDates) return false;
  const now = new Date();
  return (
    this.expiryDates.insurance > now &&
    (!this.expiryDates.fitness || this.expiryDates.fitness > now) &&
    (!this.expiryDates.permit || this.expiryDates.permit > now)
  );
});

vehicleSchema.virtual('isVerified').get(function () {
  return this.verificationStatus === 'verified';
});

vehicleSchema.virtual('isAvailable').get(function () {
  return (
    !this.isDeleted &&
    this.availability === 'available' &&
    this.verificationStatus === 'verified' &&
    !this.currentBooking
  );
});

// Virtual for checking if vehicle needs maintenance
vehicleSchema.virtual('needsMaintenance').get(function () {
  if (!this.maintenanceHistory || !this.maintenanceHistory.length) return false;
  
  const lastMaintenance = this.maintenanceHistory[this.maintenanceHistory.length - 1];
  if (!lastMaintenance.nextDueDate) return false;
  
  return new Date() >= lastMaintenance.nextDueDate;
});

// Pre-save: keep owner and ownerRef in sync for backward compatibility
vehicleSchema.pre('save', function (next) {
  if (this.ownerRef?.item && this.ownerRef?.kind === 'Driver' && !this.owner) {
    this.owner = this.ownerRef.item;
  }
  if (this.owner && !this.ownerRef?.item) {
    this.ownerRef = { kind: 'Driver', item: this.owner };
  }
  next();
});

// Pre-save middleware to normalize vehicle number
vehicleSchema.pre('validate', function (next) {
  if (this.lastKnownLocation) {
    if (!this.lastKnownLocation.coordinates || !Array.isArray(this.lastKnownLocation.coordinates) || this.lastKnownLocation.coordinates.length !== 2) {
      this.lastKnownLocation = undefined;
    }
  }
  next();
});

vehicleSchema.pre('save', function (next) {
  if (this.isModified('vehicleNumber') && this.vehicleNumber) {
    this.vehicleNumber = this.vehicleNumber.replace(/-/g, '').toUpperCase();
  }
  next();
});

// Pre-save middleware to check expiry dates
vehicleSchema.pre('save', function (next) {
  const now = new Date();
  
  if (this.expiryDates.insurance && this.expiryDates.insurance <= now) {
    this.verificationStatus = 'expired';
  }
  
  next();
});

vehicleSchema.pre('save', function(next) {
  if (this.maintenanceHistory && this.maintenanceHistory.length > 100) {
    this.maintenanceHistory = this.maintenanceHistory.slice(-100);
  }
  next();
});

// Static method to find available vehicles
vehicleSchema.statics.findAvailable = function (filters = {}) {
  const query = {
    status: 'active',
    availability: 'available',
    verificationStatus: 'verified',
    isDeleted: false,
    nextBooking: null,
    'expiryDates.insurance': { $gt: new Date() }
  };

  if (filters.truckType) {
    query.truckType = filters.truckType;
  }

  if (filters.bodyType) {
    query.bodyType = filters.bodyType;
  }

  if (filters.minCapacity) {
    query['capacity.value'] = { $gte: filters.minCapacity };
  }

  if (filters.location) {
    // Find vehicles within radius (in meters)
    query.lastKnownLocation = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [filters.location.lng, filters.location.lat]
        },
        $maxDistance: filters.radius || 50000 // 50km default
      }
    };
  }

  return this.find(query).populate('owner', 'name phone');
};

// Static method to get vehicles needing maintenance
vehicleSchema.statics.getNeedingMaintenance = function () {
  return this.aggregate([
    {
      $match: {
        isDeleted: false,
        status: { $ne: 'retired' }
      }
    },
    {
      $addFields: {
        lastMaintenance: { $arrayElemAt: ['$maintenanceHistory', -1] }
      }
    },
    {
      $match: {
        'lastMaintenance.nextDueDate': { $lte: new Date() }
      }
    }
  ]);
};

// Instance method to mark as on-trip
vehicleSchema.methods.assignToBooking = async function (bookingId) {
  this.currentBooking = bookingId;
  this.availability = 'on-trip';
  return this.save();
};

// Instance method to release from trip
vehicleSchema.methods.releaseFromBooking = async function () {
  this.currentBooking = undefined;
  this.availability = 'available';
  this.stats.totalTrips += 1;
  this.stats.completedTrips += 1;
  this.stats.lastTripDate = new Date();
  return this.save();
};

// Instance method to add maintenance record
vehicleSchema.methods.addMaintenanceRecord = function (maintenanceData) {
  this.maintenanceHistory.push(maintenanceData);
  return this.save();
};

// Instance method for soft delete
vehicleSchema.methods.softDelete = function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.status = 'retired';
  this.availability = 'unavailable';
  return this.save();
};

// Static method to find active vehicles
vehicleSchema.statics.findActive = function() {
  return this.find({ isDeleted: false });
};

export default mongoose.model('Vehicle', vehicleSchema);