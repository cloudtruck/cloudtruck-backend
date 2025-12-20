import { z } from 'zod';

/**
 * Create Driver Validator
 * POST /api/v1/drivers
 */
export const createDriverSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    licenseNumber: z.string().min(5, 'License number must be at least 5 characters'),
    licenseExpiry: z.string().datetime('Invalid license expiry date'),
    aadhaarNumber: z.string()
      .regex(/^\d{12}$/, 'Aadhaar number must be 12 digits')
      .optional(),
    panNumber: z.string()
      .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format')
      .optional(),
    preferredTruckTypes: z.array(z.string()).optional(),
    emergencyContact: z.object({
      name: z.string().min(2),
      phone: z.string().regex(/^\+?[1-9]\d{9,14}$/),
      relation: z.string().optional()
    }).optional()
  })
});

/**
 * Get Drivers Query Validator
 * GET /api/v1/drivers
 */
export const getDriversQuerySchema = z.object({
  query: z.object({
    isAvailable: z.enum(['true', 'false']).optional(),
    isVerified: z.enum(['true', 'false']).optional(),
    isBlacklisted: z.enum(['true', 'false']).optional(),
    truckType: z.string().optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    radius: z.string().optional(),
    minRating: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sort: z.string().optional()
  })
});

/**
 * Driver ID Param Validator
 */
export const driverIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid driver ID')
  })
});

/**
 * Update Driver Validator
 * PATCH /api/v1/drivers/:id
 */
export const updateDriverSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid driver ID')
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    licenseExpiry: z.string().datetime().optional(),
    aadhaarNumber: z.string().regex(/^\d{12}$/).optional(),
    panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).optional(),
    preferredTruckTypes: z.array(z.string()).optional(),
    emergencyContact: z.object({
      name: z.string().min(2),
      phone: z.string().regex(/^\+?[1-9]\d{9,14}$/),
      relation: z.string().optional()
    }).optional(),
    bankDetails: z.object({
      accountNumber: z.string(),
      ifscCode: z.string(),
      accountHolderName: z.string(),
      bankName: z.string()
    }).optional()
  })
});

/**
 * Update Location Validator
 * POST /api/v1/drivers/:id/location
 */
export const updateLocationSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid driver ID').optional()
  }).optional(),
  body: z.object({
    latitude: z.number().min(-90).max(90, 'Invalid latitude'),
    longitude: z.number().min(-180).max(180, 'Invalid longitude')
  })
});

/**
 * Update Availability Validator
 * PATCH /api/v1/drivers/:id/availability
 */
export const updateAvailabilitySchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid driver ID').optional()
  }).optional(),
  body: z.object({
    isAvailable: z.boolean()
  })
});

/**
 * Add Rating Validator
 * POST /api/v1/drivers/:id/rating
 */
export const addRatingSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid driver ID')
  }),
  body: z.object({
    rating: z.number().min(1).max(5, 'Rating must be between 1 and 5'),
    feedback: z.string().optional(),
    bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid booking ID')
  })
});

/**
 * Blacklist Driver Validator
 * POST /api/v1/drivers/:id/blacklist
 */
export const blacklistDriverSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid driver ID')
  }),
  body: z.object({
    reason: z.string().min(10, 'Blacklist reason must be at least 10 characters')
  })
});

/**
 * Get Performance Query Validator
 * GET /api/v1/drivers/:id/performance
 */
export const getPerformanceQuerySchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid driver ID').optional()
  }).optional(),
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  })
});

/**
 * Get Nearby Drivers Query Validator
 * GET /api/v1/drivers/nearby
 */
export const getNearbyDriversQuerySchema = z.object({
  query: z.object({
    latitude: z.string().refine((val) => !isNaN(parseFloat(val)), 'Invalid latitude'),
    longitude: z.string().refine((val) => !isNaN(parseFloat(val)), 'Invalid longitude'),
    radius: z.string().optional(),
    truckType: z.string().optional()
  })
});
