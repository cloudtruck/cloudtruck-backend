import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  // Phone is required for customer/driver (OTP flow). Staff/internal users can be email/password only.
  phone: {
    type: String,
    required: function requiredPhone() {
      return ['customer', 'driver', 'supplier'].includes(this.role);
    }
  },
  email: { type: String },
  password: { type: String, select: false }, // staff/internal only
  role: { type: String, enum: ['customer','driver','staff','internal','super-admin','supplier'], required: true, index: true },
  status: { type: String, enum: ['active','blocked','pending-verification','inactive'], default: 'pending-verification', index: true },
  firebaseUid: String,
  lastLogin: Date,
  sessionMeta: {
    deviceModel: String,
    lastIp: String
  },
  
  // FCM Token for push notifications
  fcmToken: String,

  // Preferred language for app UI
  preferredLanguage: { type: String, enum: ['en', 'hi'], default: 'en' },
  
  // Password security
  lastPasswordChange: Date,
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  
  // Soft delete
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Audit tracking
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Unique phone but only when present and NOT deleted. Use partialFilterExpression to avoid sparse+unique pitfalls.
userSchema.index(
  { phone: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { 
      phone: { $exists: true, $ne: null },
      isDeleted: false 
    } 
  }
);
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $exists: true, $ne: null } } });

/* Virtual Fields */

// Check if account is locked
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

/* Instance Methods */

// Generate Access Token (7 days)
userSchema.methods.generateAccessToken = function() {
  return jwt.sign(
    {
      _id: this._id,
      role: this.role,
      phone: this.phone,
      email: this.email
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '7d' }
  );
};

// Generate Refresh Token (30 days)
userSchema.methods.generateRefreshToken = function() {
  return jwt.sign(
    {
      _id: this._id
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '30d' }
  );
};

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Soft delete
userSchema.methods.softDelete = function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  return this.save();
};

// Increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  // Otherwise, increment
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock the account after 5 failed attempts
  const maxAttempts = 5;
  const lockTime = 10 * 60 * 1000; // 10 minutes
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }
  
  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

/* Static Methods */

// Find active users
userSchema.statics.findActive = function() {
  return this.find({ isDeleted: false });
};

// Find by phone
userSchema.statics.findByPhone = function(phone) {
  const normalized = phone ? String(phone).replace(/[\s\-]/g, '').replace(/^\+/, '') : phone;
  return this.findOne({ phone: normalized, isDeleted: false });
};

// Find by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email, isDeleted: false });
};

/* Middleware */

// Normalize phone to digits-only with country code (e.g. "918459727003").
// Prevents duplicate accounts for the same number in different formats (+91..., 91..., raw 10-digit).
userSchema.pre('save', function(next) {
  if (this.isModified('phone') && this.phone) {
    this.phone = String(this.phone).replace(/[\s\-]/g, '').replace(/^\+/, '');
  }
  next();
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash if password is modified or new
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.lastPasswordChange = new Date();
    next();
  } catch (error) {
    next(error);
  }
});

// Don't return sensitive fields
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

export default mongoose.model('User', userSchema);
    