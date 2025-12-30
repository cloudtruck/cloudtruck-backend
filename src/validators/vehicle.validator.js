import { z } from 'zod';

/**
 * Create Vehicle Validator
 * POST /api/v1/vehicles
 */
export const createVehicleSchema = z.object({
  body: z.object({
    vehicleNumber: z.string()
      .min(5, 'Vehicle number must be at least 5 characters')
      .regex(/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/, 'Invalid vehicle number format'),
    truckType: z.enum([
      '14ft',
      '17ft',
      '19ft',
      '20ft',
      '22ft',
      '24ft',
      '32ft',
      '40ft',
      'container-20ft',
      'container-40ft',
      'trailer',
      'tanker',
      'tipper',
      'refrigerated'
    ]),
    length: z.number().positive('Length must be positive'),
    capacity: z.number().positive('Capacity must be positive'),
    bodyType: z.enum(['open', 'closed', 'container', 'flatbed']),
    manufacturer: z.string().optional(),
    model: z.string().optional(),
    year: z.number()
      .int()
      .min(1990, 'Year must be 1990 or later')
      .max(new Date().getFullYear() + 1, 'Invalid year')
      .optional(),
    owner: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid owner ID').optional(),
    registrationState: z.string().min(2).optional(),
    permitType: z.enum(['national', 'state', 'city']).optional(),
    hasGPS: z.boolean().optional(),
    hasFASTag: z.boolean().optional()
  })
});

/**
 * Get Vehicles Query Validator
 * GET /api/v1/vehicles
 */
export const getVehiclesQuerySchema = z.object({
  query: z.object({
    isAvailable: z.enum(['true', 'false']).optional(),
    truckType: z.string().optional(),
    bodyType: z.enum(['open', 'closed', 'container', 'flatbed']).optional(),
    minCapacity: z.string().optional(),
    maxCapacity: z.string().optional(),
    owner: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    radius: z.string().optional(),
    hasGPS: z.enum(['true', 'false']).optional(),
    hasFASTag: z.enum(['true', 'false']).optional(),
    search: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sort: z.string().optional()
  })
});

/**
 * Vehicle ID Param Validator
 */
export const vehicleIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid vehicle ID')
  })
});

/**
 * Driver ID Param Validator
 * GET /api/v1/vehicles/driver/:driverId
 */
export const driverIdParamSchema = z.object({
  params: z.object({
    driverId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid driver ID')
  })
});

/**
 * Verify Vehicle Validator
 * POST /api/v1/vehicles/:id/verify
 */
export const verifyVehicleSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid vehicle ID')
  })
});

/**
 * Update Vehicle Validator
 * PATCH /api/v1/vehicles/:id
 */
export const updateVehicleSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid vehicle ID')
  }),
  body: z.object({
    truckType: z.enum([
      '14ft', '17ft', '19ft', '20ft', '22ft', '24ft', '32ft', '40ft',
      'container-20ft', 'container-40ft', 'trailer', 'tanker', 'tipper', 'refrigerated'
    ]).optional(),
    length: z.number().positive().optional(),
    capacity: z.number().positive().optional(),
    bodyType: z.enum(['open', 'closed', 'container', 'flatbed']).optional(),
    manufacturer: z.string().optional(),
    model: z.string().optional(),
    year: z.number().int().min(1990).max(new Date().getFullYear() + 1).optional(),
    owner: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    permitType: z.enum(['national', 'state', 'city']).optional(),
    hasGPS: z.boolean().optional(),
    hasFASTag: z.boolean().optional()
  })
});

/**
 * Update Location Validator
 * POST /api/v1/vehicles/:id/location
 */
export const updateLocationSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid vehicle ID')
  }),
  body: z.object({
    latitude: z.number().min(-90).max(90, 'Invalid latitude'),
    longitude: z.number().min(-180).max(180, 'Invalid longitude')
  })
});

/**
 * Update Availability Validator
 * PATCH /api/v1/vehicles/:id/availability
 */
export const updateAvailabilitySchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid vehicle ID')
  }),
  body: z.object({
    isAvailable: z.boolean()
  })
});

/**
 * Add Maintenance Validator
 * POST /api/v1/vehicles/:id/maintenance
 */
export const addMaintenanceSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid vehicle ID')
  }),
  body: z.object({
    type: z.enum(['repair', 'service', 'inspection', 'replacement']),
    description: z.string().min(5, 'Description must be at least 5 characters'),
    cost: z.number().nonnegative('Cost cannot be negative'),
    serviceDate: z.string().datetime('Invalid service date'),
    nextServiceDue: z.string().datetime().optional(),
    serviceCenter: z.string().optional()
  })
});

/**
 * Get Available Vehicles Query Validator
 * GET /api/v1/vehicles/available
 */
export const getAvailableVehiclesQuerySchema = z.object({
  query: z.object({
    truckType: z.string().min(1, 'Truck type is required'),
    minCapacity: z.string().optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    radius: z.string().optional(),
    loadDate: z.string().datetime().optional()
  })
});
