import mongoose from 'mongoose';
import { paginationPlugin } from '../utils/plugins/pagination.plugin.js';

const staffSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  name: { type: String, required: true, index: true },
  department: { type: String, index: true }, // e.g., ops, sales, support, finance
  title: String, // e.g., 'operations manager'
  permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Permission' }],
  reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', alias: 'manager' },
  
  // Work Schedule
  workingHours: {
    start: String, // e.g., '09:00'
    end: String,   // e.g., '18:00'
    timezone: { type: String, default: 'Asia/Kolkata' },
    workingDays: [{ type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] }]
  },
  
  // Performance Tracking
  performance: {
    bookingsAssigned: { type: Number, default: 0 },
    bookingsCompleted: { type: Number, default: 0 },
    avgResolutionTime: { type: Number, default: 0 }, // in minutes
    customerSatisfaction: { type: Number, default: 0, min: 0, max: 5 }
  },
  
  // Assigned Resources
  assignedBookings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
  assignedCustomers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }],
  
  isActive: { type: Boolean, default: true, index: true },
  lastSeenAt: Date,
  
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

// Example compound index if you frequently query staff by department + active
staffSchema.index({ department: 1, isActive: 1 });
staffSchema.index({ isDeleted: 1, isActive: 1 });
staffSchema.index({ reportingManager: 1 });

/* Virtual Fields */

// Workload
staffSchema.virtual('currentWorkload').get(function() {
  return this.assignedBookings?.length || 0;
});

// Completion Rate
staffSchema.virtual('completionRate').get(function() {
  if (this.performance.bookingsAssigned === 0) return 0;
  return (this.performance.bookingsCompleted / this.performance.bookingsAssigned) * 100;
});

/* Static Methods */

// Find active staff
staffSchema.statics.findActive = function() {
  return this.find({ isDeleted: false, isActive: true });
};

// Find by department
staffSchema.statics.findByDepartment = function(department) {
  return this.find({ isDeleted: false, isActive: true, department });
};

// Find least busy staff (for load balancing)
staffSchema.statics.findLeastBusy = async function(department = null) {
  const query = { isDeleted: false, isActive: true };
  if (department) query.department = department;
  
  return this.findOne(query).sort({ 'assignedBookings.length': 1 });
};

/* Instance Methods */

// Soft delete
staffSchema.methods.softDelete = function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.isActive = false;
  return this.save();
};

// Assign booking
staffSchema.methods.assignBooking = function(bookingId) {
  if (!this.assignedBookings.includes(bookingId)) {
    this.assignedBookings.push(bookingId);
    this.performance.bookingsAssigned += 1;
  }
  return this.save();
};

// Complete booking
staffSchema.methods.completeBooking = function(bookingId, resolutionTime = null) {
  const index = this.assignedBookings.indexOf(bookingId);
  if (index > -1) {
    this.assignedBookings.splice(index, 1);
    this.performance.bookingsCompleted += 1;
    
    if (resolutionTime) {
      // Update average resolution time
      const total = this.performance.bookingsCompleted;
      const previousAvg = this.performance.avgResolutionTime;
      this.performance.avgResolutionTime = ((previousAvg * (total - 1)) + resolutionTime) / total;
    }
  }
  return this.save();
};

// Update activity
staffSchema.methods.updateActivity = function() {
  this.lastSeenAt = new Date();
  return this.save();
};

// Adds Staff.paginate()
staffSchema.plugin(paginationPlugin);

export default mongoose.model('Staff', staffSchema);
