import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Notification Type
  type: {
    type: String,
    enum: ['push', 'sms', 'email', 'in-app'],
    required: true,
    index: true
  },
  
  // Delivery Channel
  channel: {
    type: String,
    enum: ['firebase', 'twilio', 'sendgrid', 'internal'],
    default: 'firebase'
  },
  
  // Content
  title: {
    type: String,
    required: true
  },
  
  body: {
    type: String,
    required: true
  },
  
  // Custom payload for deep linking or actions
  data: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Category for filtering (maps to mobile app tabs)
  category: {
    type: String,
    enum: ['truck', 'loading', 'delivery', 'pod', 'payment', 'general'],
    default: 'general',
    index: true
  },

  // Related Entity (booking, payment, driver, vehicle)
  entity: {
    type: {
      type: String,
      enum: ['booking', 'payment', 'driver', 'vehicle', 'customer', 'document', 'system']
    },
    id: mongoose.Schema.Types.ObjectId
  },
  
  // Delivery Status
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
    default: 'pending',
    index: true
  },
  
  // Priority
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
    index: true
  },
  
  // Tracking Timestamps
  sentAt: Date,
  deliveredAt: Date,
  readAt: {
    type: Date,
    index: true
  },
  
  // Failure Tracking
  failureReason: String,
  failureCode: String,
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  nextRetryAt: Date,
  
  // External IDs from service providers
  fcmMessageId: String, // Firebase Cloud Messaging
  smsId: String,        // Twilio or other SMS provider
  emailId: String,      // SendGrid or other email provider
  
  // Scheduling
  scheduledFor: Date,
  
  // Actions (buttons in notification)
  actions: [{
    label: String,
    action: String, // 'view_booking', 'accept', 'reject'
    url: String
  }],
  
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Soft Delete
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/* Indexes */
notificationSchema.index({ user: 1, status: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1 });
notificationSchema.index({ status: 1, scheduledFor: 1 });
notificationSchema.index({ 'entity.type': 1, 'entity.id': 1 });

// TTL index: Auto-delete notifications older than 90 days
notificationSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 7776000, // 90 days
    partialFilterExpression: {
      readAt: { $exists: true },
      isDeleted: true
    }
  }
);

/* Virtual Fields */

// Check if notification is read
notificationSchema.virtual('isRead').get(function() {
  return !!this.readAt;
});

// Check if notification should be retried
notificationSchema.virtual('shouldRetry').get(function() {
  return this.status === 'failed' && 
         this.retryCount < this.maxRetries &&
         (!this.nextRetryAt || this.nextRetryAt <= new Date());
});

/* Static Methods */

// Find active notifications
notificationSchema.statics.findActive = function() {
  return this.find({ isDeleted: false });
};

// Get unread notifications for user
notificationSchema.statics.getUnreadForUser = function(userId, limit = 50) {
  return this.find({
    user: userId,
    isDeleted: false,
    readAt: null
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .lean();
};

// Get unread count for user
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    user: userId,
    isDeleted: false,
    readAt: null
  });
};

// Get pending notifications to send
notificationSchema.statics.getPendingToSend = function() {
  return this.find({
    status: 'pending',
    isDeleted: false,
    $or: [
      { scheduledFor: null },
      { scheduledFor: { $lte: new Date() } }
    ]
  }).limit(100);
};

// Get failed notifications for retry
notificationSchema.statics.getForRetry = function() {
  return this.find({
    status: 'failed',
    isDeleted: false,
    retryCount: { $lt: this.maxRetries },
    $or: [
      { nextRetryAt: null },
      { nextRetryAt: { $lte: new Date() } }
    ]
  }).limit(50);
};

/* Instance Methods */

// Mark as sent
notificationSchema.methods.markAsSent = function(externalId = null) {
  this.status = 'sent';
  this.sentAt = new Date();
  
  if (externalId) {
    if (this.type === 'push') this.fcmMessageId = externalId;
    else if (this.type === 'sms') this.smsId = externalId;
    else if (this.type === 'email') this.emailId = externalId;
  }
  
  return this.save();
};

// Mark as delivered
notificationSchema.methods.markAsDelivered = function() {
  this.status = 'delivered';
  this.deliveredAt = new Date();
  return this.save();
};

// Mark as read
notificationSchema.methods.markAsRead = function() {
  if (!this.readAt) {
    this.readAt = new Date();
    if (this.status === 'delivered' || this.status === 'sent') {
      this.status = 'read';
    }
  }
  return this.save();
};

// Mark as failed
notificationSchema.methods.markAsFailed = function(reason, code = null) {
  this.status = 'failed';
  this.failureReason = reason;
  this.failureCode = code;
  this.retryCount += 1;
  
  // Calculate next retry with exponential backoff
  const backoffMinutes = Math.pow(2, this.retryCount) * 5; // 5, 10, 20, 40 minutes
  this.nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
  
  return this.save();
};

// Soft delete (mark as deleted)
notificationSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Schedule notification
notificationSchema.methods.schedule = function(scheduledDate) {
  this.scheduledFor = scheduledDate;
  return this.save();
};

/* Middleware */

// Pre-save validation
notificationSchema.pre('save', function(next) {
  // Validate entity type and id together
  if (this.entity && this.entity.type && !this.entity.id) {
    return next(new Error('Entity ID is required when entity type is specified'));
  }
  
  next();
});

export default mongoose.model('Notification', notificationSchema);
