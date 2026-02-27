import { z } from 'zod';

/**
 * Create Booking Validator
 * POST /api/v1/bookings
 */
export const MATERIAL_TYPES = [
  'FMCG', 'electronics', 'furniture', 'steel', 'cement', 'tiles',
  'chemicals', 'textiles', 'agriculture', 'automobile-parts', 'machinery',
  'paper', 'pharma', 'plastic', 'food-grains', 'vegetables-fruits',
  'general-cargo', 'other'
];

export const createBookingSchema = z.object({
  body: z.object({
    pickupCity: z.string().min(1, 'Pickup city is required'),
    pickupState: z.string().min(1, 'Pickup state is required').optional(),
    pickupLat: z.preprocess((v) => (v === undefined ? v : parseFloat(v)), z.number().min(-90).max(90, 'Invalid pickup latitude')),
    pickupLng: z.preprocess((v) => (v === undefined ? v : parseFloat(v)), z.number().min(-180).max(180, 'Invalid pickup longitude')),
    pickupAddress: z.string().min(1, 'Pickup address is required'),
    pickupContactName: z.string().optional(),
    pickupContactPhone: z.string().optional(),
    dropCity: z.string().min(1, 'Drop city is required'),
    dropState: z.string().min(1, 'Drop state is required').optional(),
    dropLat: z.preprocess((v) => (v === undefined ? v : parseFloat(v)), z.number().min(-90).max(90, 'Invalid drop latitude')),
    dropLng: z.preprocess((v) => (v === undefined ? v : parseFloat(v)), z.number().min(-180).max(180, 'Invalid drop longitude')),
    dropAddress: z.string().min(1, 'Drop address is required'),
    dropContactName: z.string().optional(),
    dropContactPhone: z.string().optional(),
    materialType: z.enum(MATERIAL_TYPES, { errorMap: () => ({ message: `Material type must be one of: ${MATERIAL_TYPES.join(', ')}` }) }),
    weight: z.preprocess((v) => (v === undefined ? v : parseFloat(v)), z.number().positive('Weight must be positive')),
    weightUnit: z.enum(['kg', 'tons', 'quintal']).optional().default('tons'),
    truckType: z.string().min(1, 'Truck type is required'),
    bodyType: z.enum(['open', 'closed', 'container', 'tanker', 'flatbed']).optional().default('open'),
    loadDate: z.string().datetime('Invalid date format').refine(
      (val) => new Date(val) > new Date(),
      'Load date must be in the future'
    ).optional(),
    expectedDeliveryDate: z.string().datetime('Invalid date format').optional(),
    advanceRequired: z.preprocess((v) => (v === undefined ? 0 : parseFloat(v)), z.number().nonnegative('Advance amount cannot be negative')).default(0),
    additionalInstructions: z.string().optional(),
    expectedAmount: z.preprocess((v) => (v === undefined ? undefined : parseFloat(v)), z.number().positive().optional()),
    // Preprocess string booleans from multipart/text ("true"/"false") to real booleans
    isHazardous: z.preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean()).optional().default(false),
    isFragile: z.preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean()).optional().default(false),
    requiresTemperatureControl: z.preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean()).optional().default(false),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
    customerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid customer ID').optional()
  })
});

/**
 * Get Bookings Query Validator
 * GET /api/v1/bookings
 */
export const getBookingsQuerySchema = z.object({
  query: z.object({
    customerId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    driverId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    status: z.string().optional(),
    paymentStatus: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    truckType: z.string().optional(),
    podPending: z.enum(['true', 'false']).optional(),
    city: z.string().optional(),
    search: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sort: z.string().optional()
  })
});

/**
 * Booking ID Param Validator
 */
export const bookingIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Booking ID is required')
  })
});

/**
 * Update Status Validator
 * PATCH /api/v1/bookings/:id/status
 */
export const updateStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Booking ID is required')
  }),
  body: z.object({
    status: z.enum([
      'created',
      'under-review',
      'assigned',
      'driver-en-route',
      'reached-pickup',
      'loaded',
      'in-transit',
      'reached-destination',
      'delivered',
      'pod-received',
      'closed',
      'cancelled'
    ]),
    note: z.string().optional()
  })
});

/**
 * Update Booking Validator
 * PATCH /api/v1/bookings/:id
 */
export const updateBookingSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Booking ID is required')
  }),
  body: z.object({
    pickupCity: z.string().min(1, 'Pickup city is required').optional(),
    pickupState: z.string().optional(),
    pickupLat: z.preprocess((v) => (v === undefined ? v : parseFloat(v)), z.number().min(-90).max(90, 'Invalid pickup latitude').optional()),
    pickupLng: z.preprocess((v) => (v === undefined ? v : parseFloat(v)), z.number().min(-180).max(180, 'Invalid pickup longitude').optional()),
    pickupAddress: z.string().min(1, 'Pickup address is required').optional(),
    pickupContactName: z.string().optional(),
    pickupContactPhone: z.string().optional(),
    dropCity: z.string().min(1, 'Drop city is required').optional(),
    dropState: z.string().optional(),
    dropLat: z.preprocess((v) => (v === undefined ? v : parseFloat(v)), z.number().min(-90).max(90, 'Invalid drop latitude').optional()),
    dropLng: z.preprocess((v) => (v === undefined ? v : parseFloat(v)), z.number().min(-180).max(180, 'Invalid drop longitude').optional()),
    dropAddress: z.string().min(1, 'Drop address is required').optional(),
    dropContactName: z.string().optional(),
    dropContactPhone: z.string().optional(),
    materialType: z.string().min(1, 'Material type is required').optional(),
    weight: z.preprocess((v) => (v === undefined ? v : parseFloat(v)), z.number().positive('Weight must be positive').optional()),
    truckType: z.string().min(1, 'Truck type is required').optional(),
    bodyType: z.enum(['open', 'closed', 'container', 'tanker', 'flatbed']).optional(),
    expectedDeliveryDate: z.string().datetime('Invalid date format').optional(),
    additionalInstructions: z.string().optional(),
    isHazardous: z.preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean()).optional(),
    isFragile: z.preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean()).optional(),
    requiresTemperatureControl: z.preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean()).optional()
  })
});

/**
 * Assign Driver Validator
 * POST /api/v1/bookings/:id/assign-driver
 */
export const assignDriverSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Booking ID is required')
  }),
  body: z.object({
    driverId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid driver ID'),
    vehicleId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid vehicle ID')
  })
});

/**
 * Cancel Booking Validator
 * POST /api/v1/bookings/:id/cancel
 */
export const cancelBookingSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Booking ID is required')
  }),
  body: z.object({
    reason: z.string().min(5, 'Cancellation reason must be at least 5 characters')
  })
});

/**
 * Add Delay Validator
 * POST /api/v1/bookings/:id/delay
 */
export const addDelaySchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Booking ID is required')
  }),
  body: z.object({
    reason: z.string().min(5, 'Delay reason must be at least 5 characters'),
    estimatedDelay: z.number().positive('Estimated delay must be positive (in minutes)')
  })
});

/**
 * Get Statistics Query Validator
 * GET /api/v1/bookings/stats
 */
export const getStatsQuerySchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    customerId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional()
  })
});
