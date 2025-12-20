import AuditLog from '../models/auditLog.model.js';
import ApiError from '../utils/ApiError.js';

/**
 * Audit Service
 * Handles audit logging and retrieval
 */
class AuditService {
  /**
   * Create audit log entry
   * @param {Object} data - Audit log data
   * @returns {Promise<Object>} Created audit log
   */
  static async createLog(data) {
    const {
      user,
      action,
      entityType,
      entityId,
      changes,
      metadata = {}
    } = data;

    const auditLog = await AuditLog.create({
      user,
      action,
      entityType,
      entityId,
      changes: {
        before: changes.before || null,
        after: changes.after || null
      },
      metadata
    });

    return auditLog;
  }

  /**
   * Get audit logs with filters
   * @param {Object} filters - Query filters
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Audit logs
   */
  static async getLogs(filters = {}, pagination = {}) {
    const {
      user,
      action,
      entityType,
      entityId,
      startDate,
      endDate,
      ipAddress
    } = filters;

    const query = {};

    if (user) query.user = user;
    if (action) {
      query.action = Array.isArray(action) ? { $in: action } : action;
    }
    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;
    if (ipAddress) query['metadata.ipAddress'] = ipAddress;

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const result = await AuditLog.paginate(query, {
      page: pagination.page || 1,
      limit: pagination.limit || 50,
      sort: pagination.sort || { timestamp: -1 },
      populate: [
        { path: 'user', select: 'email phone role' }
      ]
    });

    return result;
  }

  /**
   * Get audit logs for specific entity
   * @param {string} entityType - Entity type
   * @param {string} entityId - Entity ID
   * @returns {Promise<Array>} Audit logs
   */
  static async getEntityHistory(entityType, entityId) {
    const logs = await AuditLog.find({
      entityType,
      entityId
    })
      .sort({ timestamp: -1 })
      .populate('user', 'email phone role')
      .lean();

    return logs;
  }

  /**
   * Get user activity logs
   * @param {string} userId - User ID
   * @param {Object} dateRange - Date range filter
   * @param {number} limit - Maximum number of logs
   * @returns {Promise<Array>} User activity logs
   */
  static async getUserActivity(userId, dateRange = {}, limit = 100) {
    const { startDate, endDate } = dateRange;

    const query = { user: userId };

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return logs;
  }

  /**
   * Get activity statistics
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Activity statistics
   */
  static async getActivityStats(filters = {}) {
    const { startDate, endDate, entityType } = filters;

    const matchStage = {};

    if (startDate || endDate) {
      matchStage.timestamp = {};
      if (startDate) matchStage.timestamp.$gte = new Date(startDate);
      if (endDate) matchStage.timestamp.$lte = new Date(endDate);
    }
    if (entityType) matchStage.entityType = entityType;

    const stats = await AuditLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            action: '$action',
            entityType: '$entityType'
          },
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: '$user' }
        }
      },
      {
        $project: {
          action: '$_id.action',
          entityType: '$_id.entityType',
          count: 1,
          uniqueUserCount: { $size: '$uniqueUsers' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    return stats;
  }

  /**
   * Get timeline of changes for an entity
   * @param {string} entityType - Entity type
   * @param {string} entityId - Entity ID
   * @returns {Promise<Array>} Timeline of changes
   */
  static async getChangeTimeline(entityType, entityId) {
    const logs = await AuditLog.find({
      entityType,
      entityId
    })
      .sort({ timestamp: 1 })
      .populate('user', 'email phone role')
      .select('action timestamp changes user')
      .lean();

    // Format timeline with readable changes
    const timeline = logs.map(log => ({
      timestamp: log.timestamp,
      action: log.action,
      user: log.user,
      changes: this.formatChanges(log.changes)
    }));

    return timeline;
  }

  /**
   * Format changes for display
   * @param {Object} changes - Changes object
   * @returns {Array} Formatted changes
   */
  static formatChanges(changes) {
    if (!changes || !changes.after) return [];

    const formatted = [];
    const before = changes.before || {};
    const after = changes.after || {};

    // Get all keys from both before and after
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

    keys.forEach(key => {
      if (before[key] !== after[key]) {
        formatted.push({
          field: key,
          oldValue: before[key],
          newValue: after[key]
        });
      }
    });

    return formatted;
  }

  /**
   * Get suspicious activities
   * @param {Object} criteria - Suspicious activity criteria
   * @returns {Promise<Array>} Suspicious activities
   */
  static async getSuspiciousActivities(criteria = {}) {
    const {
      action = 'DELETE',
      minCount = 10,
      timeWindow = 60 // minutes
    } = criteria;

    const startTime = new Date(Date.now() - timeWindow * 60 * 1000);

    const activities = await AuditLog.aggregate([
      {
        $match: {
          action: { $regex: action, $options: 'i' },
          timestamp: { $gte: startTime }
        }
      },
      {
        $group: {
          _id: {
            user: '$user',
            action: '$action',
            ipAddress: '$metadata.ipAddress'
          },
          count: { $sum: 1 },
          firstActivity: { $min: '$timestamp' },
          lastActivity: { $max: '$timestamp' },
          entities: { $push: { type: '$entityType', id: '$entityId' } }
        }
      },
      {
        $match: {
          count: { $gte: minCount }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Populate user details
    for (const activity of activities) {
      const user = await this.getUserDetails(activity._id.user);
      activity.user = user;
    }

    return activities;
  }

  /**
   * Get user details (helper method)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User details
   */
  static async getUserDetails(userId) {
    const User = (await import('../models/user.model.js')).default;
    const user = await User.findById(userId)
      .select('email phone role')
      .lean();
    return user;
  }

  /**
   * Export audit logs
   * @param {Object} filters - Filter options
   * @param {string} format - Export format (json, csv)
   * @returns {Promise<Array>} Audit logs for export
   */
  static async exportLogs(filters = {}, format = 'json') {
    const logs = await AuditLog.find(filters)
      .sort({ timestamp: -1 })
      .populate('user', 'email phone role')
      .lean();

    if (format === 'csv') {
      // Convert to CSV format (basic implementation)
      return this.convertToCSV(logs);
    }

    return logs;
  }

  /**
   * Convert logs to CSV format
   * @param {Array} logs - Audit logs
   * @returns {string} CSV string
   */
  static convertToCSV(logs) {
    const headers = [
      'Timestamp',
      'User Email',
      'Action',
      'Entity Type',
      'Entity ID',
      'IP Address'
    ];

    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      log.user?.email || 'N/A',
      log.action,
      log.entityType,
      log.entityId,
      log.metadata?.ipAddress || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Clean old audit logs (for maintenance)
   * @param {number} daysToKeep - Number of days to keep logs
   * @returns {Promise<Object>} Deletion result
   */
  static async cleanOldLogs(daysToKeep = 365) {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const result = await AuditLog.deleteMany({
      timestamp: { $lt: cutoffDate }
    });

    return {
      deletedCount: result.deletedCount,
      cutoffDate
    };
  }
}

export default AuditService;
