import mongoose from 'mongoose';
import { paginationPlugin } from '../utils/plugins/pagination.plugin.js';

const auditLogSchema = new mongoose.Schema(
  {
    // User who performed the action
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required for audit'],
      index: true
    },

    // Action performed
    action: {
      type: String,
      required: [true, 'Action is required'],
      index: true,
      enum: [
        // Booking actions
        'CREATE_BOOKING',
        'UPDATE_BOOKING',
        'UPDATE_BOOKING_DETAILS',
        'DELETE_BOOKING',
        'ASSIGN_DRIVER',
        'UNASSIGN_DRIVER',
        'UPDATE_BOOKING_STATUS',
        'CANCEL_BOOKING',
        'ADD_BOOKING_NOTE',
        
        // Driver actions
        'CREATE_DRIVER',
        'CREATE_DRIVER_PROFILE',
        'UPDATE_DRIVER',
        'UPDATE_DRIVER_PROFILE',
        'SUBMIT_DRIVER_KYC',
        'SUBMIT_DRIVER_ACCOUNT_INFO',
        'DELETE_DRIVER',
        'APPROVE_DRIVER',
        'VERIFY_DRIVER',
        'REJECT_DRIVER',
        'BLOCK_DRIVER',
        'UNBLOCK_DRIVER',
        
        // Vehicle actions
        'CREATE_VEHICLE',
        'DRIVER_ADD_TRUCK',
        'UPDATE_VEHICLE',
        'DELETE_VEHICLE',
        'APPROVE_VEHICLE',
        'VERIFY_VEHICLE',
        'REJECT_VEHICLE',
        'ADD_MAINTENANCE_RECORD',
        
        // Customer actions
        'CREATE_CUSTOMER',
        'CREATE_CUSTOMER_PROFILE',
        'UPDATE_CUSTOMER',
        'UPDATE_CUSTOMER_PROFILE',
        'UPDATE_CREDIT_LIMIT',
        'DELETE_CUSTOMER',
        'APPROVE_CUSTOMER',
        'VERIFY_CUSTOMER',
        'BLOCK_CUSTOMER',

        // Staff actions
        'CREATE_STAFF_PROFILE',
        'UPDATE_STAFF_PROFILE',
        'UPDATE_STAFF_PERMISSIONS',
        'DELETE_STAFF',

        // RBAC actions
        'CREATE_PERMISSION',
        'UPDATE_PERMISSION',
        'DELETE_PERMISSION',
        'CREATE_ROLE_TEMPLATE',
        'UPDATE_ROLE_TEMPLATE',
        'DELETE_ROLE_TEMPLATE',
        
        // Payment actions
        'CREATE_PAYMENT',
        'UPDATE_PAYMENT',
        'MARK_PAYMENT_RECEIVED',
        'REFUND_PAYMENT',
        'GENERATE_INVOICE',
        
        // User management
        'CREATE_USER',
        'UPDATE_USER',
        'DELETE_USER',
        'CHANGE_USER_ROLE',
        'RESET_PASSWORD',
        'CHANGE_USER_STATUS',
        
        // Document actions
        'UPLOAD_DOCUMENT',
        'DELETE_DOCUMENT',
        'VERIFY_DOCUMENT',
        
        // Authentication
        'LOGIN',
        'LOGOUT',
        'FAILED_LOGIN',
        'PASSWORD_RESET',
        
        // Support actions
        'CREATE_SUPPORT_TICKET',
        'RESOLVE_SUPPORT_TICKET',
        'REPLY_TO_TICKET',
        
        // System actions
        'SYSTEM_CONFIG_CHANGE',
        'BULK_UPDATE',
        'DATA_EXPORT',
        'DATA_IMPORT',
        'SYNC_EWAY_BILL',
        'CREATE_EWAY_BILL',
        'UPDATE_EWAY_BILL',
        'CANCEL_EWAY_BILL'
      ]
    },

    // Entity being modified
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      enum: [
        'booking',
        'driver',
        'vehicle',
        'customer',
        'payment',
        'user',
        'staff',
        'document',
        'tracking',
        'notification',
        'permission',
        'role-template',
        'system',
        'eway-bill',
        'support-ticket'
      ],
      index: true
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Entity ID is required'],
      index: true
    },

    // Changes made
    changes: {
      before: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
        select: false
      },
      after: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
        select: false
      },
      snapshotRef: {
        type: {
          provider: String,   // 's3' | 'document'
          providerId: String, // object key or Document._id
        },
        default: null,
        select: false
      }
    },

    // Metadata (device info and userAgent not returned by default)
    metadata: {
      ipAddress: { type: String, index: true },
      userAgent: { type: String, select: false },
      deviceInfo: { type: mongoose.Schema.Types.Mixed, select: false },
      location: {
        type: {
          type: String,
          enum: ['Point']
        },
        coordinates: [Number] // [longitude, latitude]
      },
      sessionId: { type: String, index: true, select: false },
      requestId: { type: String, index: true }
    },

    // Additional context
    context: {
      module: String, // e.g., 'booking-management', 'driver-assignment'
      description: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
      },
      tags: [String]
    },

    // Status of the action
    status: {
      type: String,
      enum: ['success', 'failed', 'partial'],
      default: 'success',
      index: true
    },

    errorDetails: {
      type: mongoose.Schema.Types.Mixed
    },

    // Timestamp
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
      index: true
    },

    // Related entities (for complex operations)
    relatedEntities: [
      {
        entityType: String,
        entityId: mongoose.Schema.Types.ObjectId
      }
    ]
  },
  {
    timestamps: false, // Using custom timestamp field
    collection: 'audit_logs'
  }
);

// Adds AuditLog.paginate()
auditLogSchema.plugin(paginationPlugin);

// Compound indexes for common queries
auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
auditLogSchema.index({ user: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ 'context.severity': 1, timestamp: -1 });
auditLogSchema.index({ status: 1, timestamp: -1 });

// TTL Index - configurable retention
const AUDIT_LOG_RETENTION_SECONDS = Number(process.env.AUDIT_LOG_RETENTION_SECONDS) || 63072000; // default 2 years
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: AUDIT_LOG_RETENTION_SECONDS });


// Static method to log an action
auditLogSchema.statics.logAction = async function (data) {
  try {
    return await this.create({
      user: data.user,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      changes: data.changes || {},
      metadata: {
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        deviceInfo: data.deviceInfo,
        location: data.location,
        sessionId: data.sessionId,
        requestId: data.requestId
      },
      context: {
        module: data.module,
        description: data.description,
        severity: data.severity || 'medium',
        tags: data.tags || []
      },
      status: data.status || 'success',
      errorDetails: data.errorDetails,
      relatedEntities: data.relatedEntities || []
    });
  } catch (error) {
    console.error('Audit log creation failed:', error);
    // Don't throw - audit failure shouldn't break the main operation
  }
};

// Static method to get audit trail for an entity
auditLogSchema.statics.getAuditTrail = function (entityType, entityId, options = {}) {
  const {
    page = 1,
    limit = 50,
    action,
    user,
    dateFrom,
    dateTo,
    severity
  } = options;

  const query = { entityType, entityId };

  if (action) query.action = action;
  if (user) query.user = user;
  if (severity) query['context.severity'] = severity;

  if (dateFrom || dateTo) {
    query.timestamp = {};
    if (dateFrom) query.timestamp.$gte = new Date(dateFrom);
    if (dateTo) query.timestamp.$lte = new Date(dateTo);
  }

  const skip = (page - 1) * limit;

  return this.find(query)
    .populate('user', 'name email phone role')
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

// Static method to get user activity
auditLogSchema.statics.getUserActivity = function (userId, options = {}) {
  const { page = 1, limit = 50, dateFrom, dateTo } = options;

  const query = { user: userId };

  if (dateFrom || dateTo) {
    query.timestamp = {};
    if (dateFrom) query.timestamp.$gte = new Date(dateFrom);
    if (dateTo) query.timestamp.$lte = new Date(dateTo);
  }

  const skip = (page - 1) * limit;

  return this.find(query)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

// Static method to get critical actions
auditLogSchema.statics.getCriticalActions = function (options = {}) {
  const { page = 1, limit = 100, dateFrom } = options;

  const query = {
    'context.severity': { $in: ['high', 'critical'] }
  };

  if (dateFrom) {
    query.timestamp = { $gte: new Date(dateFrom) };
  }

  const skip = (page - 1) * limit;

  return this.find(query)
    .populate('user', 'name email phone role')
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get failed actions
auditLogSchema.statics.getFailedActions = function (options = {}) {
  const { page = 1, limit = 100, dateFrom } = options;

  const query = { status: 'failed' };

  if (dateFrom) {
    query.timestamp = { $gte: new Date(dateFrom) };
  }

  const skip = (page - 1) * limit;

  return this.find(query)
    .populate('user', 'name email phone role')
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get statistics
auditLogSchema.statics.getStatistics = async function (dateFrom, dateTo) {
  const query = {};

  if (dateFrom || dateTo) {
    query.timestamp = {};
    if (dateFrom) query.timestamp.$gte = new Date(dateFrom);
    if (dateTo) query.timestamp.$lte = new Date(dateTo);
  }

  const stats = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalActions: { $sum: 1 },
        successfulActions: {
          $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
        },
        failedActions: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        criticalActions: {
          $sum: {
            $cond: [
              { $in: ['$context.severity', ['high', 'critical']] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  const actionsByType = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$action',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  const actionsByUser = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$user',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userDetails'
      }
    }
  ]);

  return {
    summary: stats[0] || {
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
      criticalActions: 0
    },
    topActions: actionsByType,
    topUsers: actionsByUser
  };
};

export default mongoose.model('AuditLog', auditLogSchema);