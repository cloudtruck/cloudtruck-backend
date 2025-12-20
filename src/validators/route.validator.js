import { z } from 'zod';

/**
 * Create Route Validator
 * POST /api/v1/routes
 */
export const createRouteSchema = z.object({
  body: z.object({
    // Basic route info
    name: z.string().min(3, 'Route name must be at least 3 characters'),
    description: z.string().optional(),

    // Pickup location
    pickupCity: z.string().min(1, 'Pickup city is required'),
    pickupLat: z.number().min(-90).max(90, 'Invalid pickup latitude'),
    pickupLng: z.number().min(-180).max(180, 'Invalid pickup longitude'),
    pickupAddress: z.string().min(1, 'Pickup address is required'),
    pickupPincode: z.string().regex(/^\d{6}$/, 'Invalid pickup pincode').optional(),
    pickupLandmark: z.string().optional(),
    pickupContactName: z.string().optional(),
    pickupContactPhone: z.string().optional(),

    // Drop location
    dropCity: z.string().min(1, 'Drop city is required'),
    dropLat: z.number().min(-90).max(90, 'Invalid drop latitude'),
    dropLng: z.number().min(-180).max(180, 'Invalid drop longitude'),
    dropAddress: z.string().min(1, 'Drop address is required'),
    dropPincode: z.string().regex(/^\d{6}$/, 'Invalid drop pincode').optional(),
    dropLandmark: z.string().optional(),
    dropContactName: z.string().optional(),
    dropContactPhone: z.string().optional(),

    // Preferences and stats
    preferredTruckType: z.string().optional(),
    preferredBodyType: z.string().optional(),
    distance: z.number().positive().optional(),
    estimatedDuration: z.number().positive().optional(),

    // Additional metadata
    notes: z.string().optional(),
    specialInstructions: z.string().optional(),
    category: z.enum(['regular', 'express', 'bulk', 'special']).optional(),
    tags: z.array(z.string()).optional(),

    // Backwards compatibility
    // Accept legacy fields if present
    routeName: z.string().min(3).optional(),
    truckType: z.string().optional(),
    estimatedDistance: z.number().positive().optional(),

    isFavorite: z.boolean().optional()
  })
});

/**
 * Get My Routes Query Validator
 * GET /api/v1/routes/my-routes
 */
export const getMyRoutesQuerySchema = z.object({
  query: z.object({
    truckType: z.string().optional(),
    preferredTruckType: z.string().optional(),
    isFavorite: z.enum(['true', 'false']).optional(),
    city: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sort: z.string().optional()
  })
});

/**
 * Route ID Param Validator
 */
export const routeIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid route ID')
  })
});

/**
 * Search Routes Query Validator
 * GET /api/v1/routes/search
 */
export const searchRoutesQuerySchema = z.object({
  query: z.object({
    pickupCity: z.string().min(1, 'Pickup city is required'),
    dropCity: z.string().min(1, 'Drop city is required')
  })
});

/**
 * Update Route Validator
 * PATCH /api/v1/routes/:id
 */
export const updateRouteSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid route ID')
  }),
  body: z.object({
    name: z.string().min(3).optional(),
    description: z.string().optional(),
    preferredTruckType: z.string().optional(),
    preferredBodyType: z.string().optional(),
    notes: z.string().optional(),
    specialInstructions: z.string().optional(),
    category: z.enum(['regular', 'express', 'bulk', 'special']).optional(),
    tags: z.array(z.string()).optional(),
    isFavorite: z.boolean().optional(),

    // backwards compatibility
    routeName: z.string().min(3).optional(),
    truckType: z.string().optional()
  })
});

/**
 * Update Statistics Validator
 * POST /api/v1/routes/:id/statistics
 */
export const updateStatisticsSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid route ID')
  }),
  body: z.object({
    actualCost: z.number().positive('Actual cost must be positive'),
    actualDistance: z.number().positive('Actual distance must be positive').optional()
  })
});

/**
 * Clone Route Validator
 * POST /api/v1/routes/:id/clone
 */
export const cloneRouteSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid route ID')
  }),
  body: z.object({
    newName: z.string().min(3, 'New route name must be at least 3 characters')
  })
});

/**
 * Get Popular Routes Query Validator
 * GET /api/v1/routes/popular
 */
export const getPopularRoutesQuerySchema = z.object({
  query: z.object({
    limit: z.string().optional()
  })
});
