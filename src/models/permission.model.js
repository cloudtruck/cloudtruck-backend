import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // e.g. 'booking.create', 'driver.view'
  name: String, // human friendly
  description: String,
  resource: String, // 'booking', 'driver', 'vehicle'
  action: String, // 'create', 'read', 'update', 'delete'
  
  // Soft Delete
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/* Static Methods */
permissionSchema.statics.findActive = function() {
  return this.find({ isDeleted: false });
};

/* Instance Methods */
permissionSchema.methods.softDelete = function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  return this.save();
};

export default mongoose.model('Permission', permissionSchema);