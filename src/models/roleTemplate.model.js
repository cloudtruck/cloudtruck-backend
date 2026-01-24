import mongoose from 'mongoose';

const roleTemplateSchema = new mongoose.Schema({
  templateName: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    index: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  permissions: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Permission' 
  }],
  category: { 
    type: String, 
    enum: ['operations', 'finance', 'support', 'management', 'admin', 'custom'],
    default: 'custom',
    index: true
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

// Virtual for employee count
roleTemplateSchema.virtual('employeeCount', {
  ref: 'Staff',
  localField: '_id',
  foreignField: 'roleTemplate',
  count: true
});

/* Static Methods */
roleTemplateSchema.statics.findActive = function() {
  return this.find({ isDeleted: false, isActive: true });
};

roleTemplateSchema.statics.findByCategory = function(category) {
  return this.find({ isDeleted: false, isActive: true, category });
};

/* Instance Methods */
roleTemplateSchema.methods.softDelete = function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.isActive = false;
  return this.save();
};

// Check if template is in use
roleTemplateSchema.methods.isInUse = async function() {
  const Staff = mongoose.model('Staff');
  const count = await Staff.countDocuments({ 
    roleTemplate: this._id, 
    isDeleted: false 
  });
  return count > 0;
};

// Get employee count
roleTemplateSchema.methods.getEmployeeCount = async function() {
  const Staff = mongoose.model('Staff');
  return await Staff.countDocuments({ 
    roleTemplate: this._id, 
    isDeleted: false 
  });
};

export default mongoose.model('RoleTemplate', roleTemplateSchema);
