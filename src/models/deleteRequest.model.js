import mongoose from 'mongoose';

const deleteRequestSchema = new mongoose.Schema({
  // What resource and which specific record is being requested for deletion
  resource: {
    type: String,
    required: true,
    enum: ['driver', 'vehicle', 'customer', 'staff', 'branch', 'supplier', 'master-data', 'account', 'route', 'document'],
    index: true
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  // Mongoose model name so the approve handler can look up and call .softDelete()
  resourceModel: {
    type: String,
    required: true,
    enum: ['Driver', 'Vehicle', 'Customer', 'Staff', 'Branch', 'Supplier', 'MasterData', 'Account', 'Route', 'Document']
  },
  // Snapshot of key display fields at request time (so approver sees context after potential changes)
  resourceSnapshot: {
    type: Object,
    default: {}
  },

  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  reason: {
    type: String,
    trim: true,
    maxlength: 500
  },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,

  rejectionReason: {
    type: String,
    trim: true,
    maxlength: 500
  },

  // Auto-expire pending requests after 30 days (MongoDB TTL on expiresAt only fires when status is still pending)
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  }
}, {
  timestamps: true
});

// Compound index for efficient pending-request lookups per resource
deleteRequestSchema.index({ resource: 1, resourceId: 1, status: 1 });

// TTL index: MongoDB will delete documents where expiresAt has passed
// We only want this for pending requests — approved/rejected are retained for audit
deleteRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { status: 'pending' } });

export default mongoose.model('DeleteRequest', deleteRequestSchema);
