import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({
  accountNumber: { 
    type: String, 
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  ifscCode: { 
    type: String, 
    required: true,
    trim: true,
    uppercase: true
  },
  accountHolderName: { 
    type: String, 
    required: true,
    trim: true
  },
  bankName: { 
    type: String, 
    required: true,
    trim: true
  },
  branchName: { 
    type: String, 
    trim: true
  },
  accountType: { 
    type: String, 
    enum: ['savings', 'current', 'od'],
    default: 'current'
  },
  isPrimary: { 
    type: Boolean, 
    default: false,
    index: true
  },
  isActive: { 
    type: Boolean, 
    default: true,
    index: true
  },
  
  // Optional fields
  upiId: String,
  swiftCode: String,
  
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

// Only one primary account allowed
accountSchema.pre('save', async function(next) {
  if (this.isPrimary && this.isModified('isPrimary')) {
    // Unset other primary accounts
    await this.constructor.updateMany(
      { _id: { $ne: this._id }, isPrimary: true },
      { $set: { isPrimary: false } }
    );
  }
  next();
});

/* Static Methods */
accountSchema.statics.findActive = function() {
  return this.find({ isDeleted: false, isActive: true });
};

accountSchema.statics.getPrimary = function() {
  return this.findOne({ isDeleted: false, isActive: true, isPrimary: true });
};

/* Instance Methods */
accountSchema.methods.softDelete = function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.isActive = false;
  if (this.isPrimary) {
    this.isPrimary = false;
  }
  return this.save();
};

accountSchema.methods.makePrimary = async function() {
  // Unset other primary accounts
  await this.constructor.updateMany(
    { _id: { $ne: this._id } },
    { $set: { isPrimary: false } }
  );
  this.isPrimary = true;
  return this.save();
};

export default mongoose.model('Account', accountSchema);
