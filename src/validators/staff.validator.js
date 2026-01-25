import { z } from 'zod';

/**
 * Create Staff Validator
 * POST /api/v1/staff
 */
export const createStaffSchema = z.object({
  body: z.object({
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID').optional(),
    email: z.string().email('Invalid email address').optional(),
    password: z.string().min(6, 'Password must be at least 6 characters').optional(),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    department: z.enum(['operations', 'support', 'sales', 'finance', 'admin', 'management']),
    title: z.string().min(2, 'Title is required').optional(),
    roleTemplate: z.string().optional(),
    phone: z.string().optional(),
    reportingManager: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid manager ID').optional(),
    workingHours: z.object({
      start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
      end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)')
    }).optional(),
    permissions: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional()
  }).refine(data => data.userId || (data.email && data.password), {
    message: 'Either userId or both email and password must be provided',
    path: ['userId']
  })
});

/**
 * Get Staff Query Validator
 * GET /api/v1/staff
 */
export const getStaffQuerySchema = z.object({
  query: z.object({
    department: z.enum(['operations', 'support', 'sales', 'finance', 'admin', 'management']).optional(),
    isActive: z.enum(['true', 'false']).optional(),
    reportingManager: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    search: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sort: z.string().optional()
  })
});

/**
 * Staff ID Param Validator
 */
export const staffIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid staff ID')
  })
});

/**
 * Update Staff Validator
 * PATCH /api/v1/staff/:id
 */
export const updateStaffSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid staff ID')
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    department: z.enum(['operations', 'support', 'sales', 'finance', 'admin', 'management']).optional(),
    title: z.string().min(2).optional(),
    reportingManager: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    workingHours: z.object({
      start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
      end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    }).optional(),
    isActive: z.boolean().optional()
  })
});

/**
 * Assign Permissions Validator
 * POST /api/v1/staff/:id/permissions
 */
export const assignPermissionsSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid staff ID')
  }),
  body: z.object({
    permissionIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid permission ID'))
      .min(1, 'At least one permission is required')
  })
});

/**
 * Check Permission Param Validator
 * GET /api/v1/staff/:id/has-permission/:permissionKey
 */
export const hasPermissionParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid staff ID'),
    permissionKey: z.string().min(1, 'Permission key is required')
  })
});

/**
 * Get Performance Query Validator
 * GET /api/v1/staff/:id/performance
 */
export const getPerformanceQuerySchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid staff ID').optional()
  }).optional(),
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  })
});

/**
 * Set Active Status Validator
 * PATCH /api/v1/staff/:id/active-status
 */
export const setActiveStatusSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid staff ID')
  }),
  body: z.object({
    isActive: z.boolean()
  })
});
