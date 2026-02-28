import mongoose from 'mongoose';

const masterDataSchema = new mongoose.Schema({
  category: { 
    type: String, 
    required: true,
    enum: ['truck-type', 'material-type', 'charge-type', 'body-type', 'document-type'],
    index: true
  },
  key: { 
    type: String, 
    required: true,
    trim: true,
    lowercase: true
  },
  displayName: { 
    type: String, 
    required: true,
    trim: true
  },
  description: String,
  imageUrl: String,
  metadata: { 
    type: Object,
    default: {}
  },
  displayOrder: { 
    type: Number, 
    default: 0,
    index: true
  },
  isActive: { 
    type: Boolean, 
    default: true,
    index: true
  },
  usageCount: { 
    type: Number, 
    default: 0,
    index: true
  },
  
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

// Compound unique index on category and key
masterDataSchema.index({ category: 1, key: 1 }, { unique: true });
masterDataSchema.index({ category: 1, displayOrder: 1 });
masterDataSchema.index({ category: 1, isActive: 1, isDeleted: 1 });

/* Static Methods */
masterDataSchema.statics.findActive = function() {
  return this.find({ isDeleted: false, isActive: true });
};

masterDataSchema.statics.findByCategory = function(category, includeInactive = false) {
  const query = { 
    isDeleted: false, 
    category 
  };
  
  // Only filter by isActive if not including inactive items
  if (!includeInactive) {
    query.isActive = true;
  }
  
  return this.find(query).sort({ displayOrder: 1, displayName: 1 });
};

masterDataSchema.statics.incrementUsage = async function(category, key) {
  return this.findOneAndUpdate(
    { category, key, isDeleted: false },
    { $inc: { usageCount: 1 } },
    { new: true }
  );
};

/* Instance Methods */
masterDataSchema.methods.softDelete = function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.isActive = false;
  return this.save();
};

masterDataSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  return this.save();
};

export default mongoose.model('MasterData', masterDataSchema);
