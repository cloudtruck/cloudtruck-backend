import AuditService from '../services/audit.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';

/**
 * Get Audit Logs
 * GET /api/v1/audit
 */
export const getAuditLogs = asyncHandler(async (req, res) => {
  const {
    user,
    action,
    entityType,
    entityId,
    startDate,
    endDate,
    ipAddress,
    page,
    limit,
    sort
  } = req.query;

  const filters = {
    user,
    action: action ? action.split(',') : undefined,
    entityType,
    entityId,
    startDate,
    endDate,
    ipAddress
  };

  const pagination = { page, limit, sort };

  const result = await AuditService.getLogs(filters, pagination);

  return res.status(200).json(
    new ApiResponse(200, result, 'Audit logs fetched successfully')
  );
});

/**
 * Get Entity History
 * GET /api/v1/audit/entity/:entityType/:entityId
 */
export const getEntityHistory = asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;

  const logs = await AuditService.getEntityHistory(entityType, entityId);

  return res.status(200).json(
    new ApiResponse(200, logs, 'Entity history fetched successfully')
  );
});

/**
 * Get User Activity
 * GET /api/v1/audit/user/:userId
 */
export const getUserActivity = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { startDate, endDate, limit } = req.query;

  const dateRange = { startDate, endDate };

  const logs = await AuditService.getUserActivity(
    userId,
    dateRange,
    limit ? parseInt(limit) : 100
  );

  return res.status(200).json(
    new ApiResponse(200, logs, 'User activity fetched successfully')
  );
});

/**
 * Get My Activity
 * GET /api/v1/audit/my-activity
 */
export const getMyActivity = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { startDate, endDate, limit } = req.query;

  const dateRange = { startDate, endDate };

  const logs = await AuditService.getUserActivity(
    userId,
    dateRange,
    limit ? parseInt(limit) : 100
  );

  return res.status(200).json(
    new ApiResponse(200, logs, 'Activity fetched successfully')
  );
});

/**
 * Get Activity Statistics
 * GET /api/v1/audit/stats
 */
export const getActivityStats = asyncHandler(async (req, res) => {
  const { startDate, endDate, entityType } = req.query;

  const filters = { startDate, endDate, entityType };

  const stats = await AuditService.getActivityStats(filters);

  return res.status(200).json(
    new ApiResponse(200, stats, 'Activity statistics fetched successfully')
  );
});

/**
 * Get Change Timeline
 * GET /api/v1/audit/timeline/:entityType/:entityId
 */
export const getChangeTimeline = asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;

  const timeline = await AuditService.getChangeTimeline(entityType, entityId);

  return res.status(200).json(
    new ApiResponse(200, timeline, 'Change timeline fetched successfully')
  );
});

/**
 * Get Suspicious Activities
 * GET /api/v1/audit/suspicious
 */
export const getSuspiciousActivities = asyncHandler(async (req, res) => {
  const { action, minCount, timeWindow } = req.query;

  const criteria = {
    action,
    minCount: minCount ? parseInt(minCount) : 10,
    timeWindow: timeWindow ? parseInt(timeWindow) : 60
  };

  const activities = await AuditService.getSuspiciousActivities(criteria);

  return res.status(200).json(
    new ApiResponse(200, activities, 'Suspicious activities fetched successfully')
  );
});

/**
 * Export Audit Logs
 * GET /api/v1/audit/export
 */
export const exportLogs = asyncHandler(async (req, res) => {
  const { format, ...filters } = req.query;

  const logs = await AuditService.exportLogs(filters, format || 'json');

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    return res.send(logs);
  }

  return res.status(200).json(
    new ApiResponse(200, logs, 'Audit logs exported successfully')
  );
});
