import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, select: false }, // store hashed token
  deviceInfo: {
    model: String,
    os: String,
    appVersion: String
  },
  ipAddress: String,
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date,
  lastUsedAt: Date,
  
  // Revocation tracking
  isRevoked: { type: Boolean, default: false, index: true },
  revokedAt: Date,
  revokedReason: String
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// TTL index to auto-remove expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ user: 1, isRevoked: 1 });

/* Instance Methods */
refreshTokenSchema.methods.revoke = function(reason = 'manual') {
  this.isRevoked = true;
  this.revokedAt = new Date();
  this.revokedReason = reason;
  return this.save();
};

export default mongoose.model('RefreshToken', refreshTokenSchema);