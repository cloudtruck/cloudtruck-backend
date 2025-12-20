import { z } from 'zod';

/**
 * Get Audit Logs Query Validator
 * GET /api/v1/audit
 */
export const getAuditLogsQuerySchema = z.object({
  query: z.object({
    user: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    action: z.string().optional(),
    entityType: z.string().optional(),
    entityId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    ipAddress: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sort: z.string().optional()
  })
});

/**
 * Entity History Param Validator
 * GET /api/v1/audit/entity/:entityType/:entityId
 */
export const entityHistoryParamSchema = z.object({
  params: z.object({
    entityType: z.string().min(1, 'Entity type is required'),
    entityId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid entity ID')
  })
});

/**
 * User Activity Param Validator
 * GET /api/v1/audit/user/:userId
 */
export const userActivityParamSchema = z.object({
  params: z.object({
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID')
  }),
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    limit: z.string().optional()
  })
});

/**
 * Activity Stats Query Validator
 * GET /api/v1/audit/stats
 */
export const activityStatsQuerySchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    entityType: z.string().optional()
  })
});

/**
 * Change Timeline Param Validator
 * GET /api/v1/audit/timeline/:entityType/:entityId
 */
export const changeTimelineParamSchema = z.object({
  params: z.object({
    entityType: z.string().min(1, 'Entity type is required'),
    entityId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid entity ID')
  })
});

/**
 * Suspicious Activities Query Validator
 * GET /api/v1/audit/suspicious
 */
export const suspiciousActivitiesQuerySchema = z.object({
  query: z.object({
    action: z.string().optional(),
    minCount: z.string().optional(),
    timeWindow: z.string().optional()
  })
});

/**
 * Export Logs Query Validator
 * GET /api/v1/audit/export
 */
export const exportLogsQuerySchema = z.object({
  query: z.object({
    format: z.enum(['json', 'csv']).optional(),
    user: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    action: z.string().optional(),
    entityType: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  })
});
