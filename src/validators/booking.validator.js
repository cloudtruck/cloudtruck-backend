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
    pickupContactGst: z.string().optional(),
    dropCity: z.string().min(1, 'Drop city is required'),
    dropState: z.string().min(1, 'Drop state is required').optional(),
    dropLat: z.preprocess((v) => (v === undefined ? v : parseFloat(v)), z.number().min(-90).max(90, 'Invalid drop latitude')),
    dropLng: z.preprocess((v) => (v === undefined ? v : parseFloat(v)), z.number().min(-180).max(180, 'Invalid drop longitude')),
    dropAddress: z.string().min(1, 'Drop address is required'),
    dropContactName: z.string().optional(),
    dropContactPhone: z.string().optional(),
    dropContactGst: z.string().optional(),
    materialType: z.string().min(1, 'Material type is required'),
    weight: z.preprocess((v) => {
      if (typeof v === 'number' || typeof v === 'string') {
        const parsed = parseFloat(v);
        return { value: isNaN(parsed) ? undefined : parsed };
      }
      return v;
    }, z.object({
      value: z.preprocess((v) => parseFloat(v), z.number().positive('Weight value must be positive')),
      unit: z.enum(['kg', 'tons', 'quintal']).optional()
    })),
    weightUnit: z.enum(['kg', 'tons', 'quintal']).optional().default('tons'),
    truckType: z.string().min(1, 'Truck type is required'),
    bodyType: z.enum(['open', 'closed', 'container', 'tanker', 'flatbed']).optional().default('open'),
    loadDate: z.string().datetime('Invalid date format').optional(),
    expectedDeliveryDate: z.string().datetime('Invalid date format').optional(),
    advanceRequired: z.preprocess((v) => (v === undefined ? 0 : parseFloat(v)), z.number().nonnegative('Advance amount cannot be negative')).default(0),
    additionalInstructions: z.string().optional(),
    expectedAmount: z.preprocess((v) => (v === undefined ? undefined : parseFloat(v)), z.number().positive().optional()),
    // Preprocess string booleans from multipart/text ("true"/"false") to real booleans
    isHazardous: z.preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean()).optional().default(false),
    isFragile: z.preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean()).optional().default(false),
    requiresTemperatureControl: z.preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean()).optional().default(false),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
    customerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid customer ID').optional(),
    // Digitify / indent fields
    laneCode:        z.string().optional(),
    sourceCode:      z.string().optional(),
    destinationCode: z.string().optional(),
    supplierEntity:  z.string().optional(), // ObjectId ref to Supplier
    loadType:        z.enum(['FTL', 'LTL', 'PTL']).nullable().optional().default(null),
    exim:            z.enum(['domestic', 'import', 'export']).optional().default('domestic'),
    trafficManager:  z.string().optional(),
    trafficController: z.string().optional(),
    supplierPrice:   z.preprocess((v) => (v === undefined ? 0 : parseFloat(v)), z.number().nonnegative()).optional().default(0),
    customerPrice:   z.preprocess((v) => (v === undefined ? 0 : parseFloat(v)), z.number().nonnegative()).optional().default(0),
    ratePerTon:      z.preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean()).optional().default(false),
    expiryTime:      z.string().datetime().optional(),
    postToSupplier:  z.preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean()).optional().default(true),
    remarks:         z.string().optional(),
    numberOfTrucks:  z.preprocess((v) => (v === undefined ? 1 : parseInt(v)), z.number().positive()).optional().default(1),
    // Direct Load / Direct Invoice fields
    vehicleId:            z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    driverId:             z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    customerAdvancePct:   z.preprocess(v => v === undefined ? 0 : parseFloat(v), z.number().min(0).max(100)).optional().default(0),
    supplierAdvancePct:   z.preprocess(v => v === undefined ? 0 : parseFloat(v), z.number().min(0).max(100)).optional().default(0),
    customerOnDelivery:   z.preprocess(v => v === undefined ? 0 : parseFloat(v), z.number().nonnegative()).optional().default(0),
    customerPaysSupplier: z.preprocess(v => v === undefined ? 0 : parseFloat(v), z.number().nonnegative()).optional().default(0),
    supplierPaysSupplier: z.preprocess(v => v === undefined ? 0 : parseFloat(v), z.number().nonnegative()).optional().default(0),
    customerPodBalance:   z.preprocess(v => v === undefined ? 0 : parseFloat(v), z.number().nonnegative()).optional().default(0),
    supplierPodBalance:   z.preprocess(v => v === undefined ? 0 : parseFloat(v), z.number().nonnegative()).optional().default(0),
    invoiceTo:            z.enum(['Customer', 'Supplier', 'Both']).optional(),
    invoiceParty:         z.enum(['consignor', 'consignee', 'customer']).optional().default('consignor'),
    payTo:                z.enum(['Supplier', 'Driver', 'Customer']).optional(),
    accountNo:            z.string().optional(),
    podType:              z.enum(['Hard', 'Soft']).optional(),
    tripKm:               z.preprocess(v => v === undefined ? undefined : parseFloat(v), z.number().positive()).optional(),
    bookingType:          z.enum(['indent', 'direct-load', 'direct-invoice', 'direct-lr']).optional().default('indent'),
    // LR reference fields
    invoiceNo:            z.string().trim().optional(),
    ewayBillNo:           z.string().trim().optional(),
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
    bookingType: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sort: z.string().optional()
  })
});

/**
 * Get Available Loads Query Validator
 * GET /api/v1/bookings/available-loads
 */
export const getAvailableLoadsQuerySchema = z.object({
  query: z.object({
    city: z.string().optional(),
    pickupCity: z.string().optional(),
    dropCity: z.string().optional(),
    truckType: z.string().optional(), // comma-separated
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    radius: z.string().optional(),
    loadDate: z.string().optional(), // YYYY-MM-DD
    page: z.string().optional(),
    limit: z.string().optional()
  })
});

/**
 * Get Unloading Trucks Query Validator
 * GET /api/v1/bookings/unloading-trucks
 */
export const getUnloadingTrucksQuerySchema = z.object({
  query: z.object({
    dropCity: z.string().min(1, 'dropCity is required'),
    truckType: z.string().optional(),
    limit: z.string().optional(),
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
      'unloading',
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
    pickupContactGst: z.string().optional(),
    dropCity: z.string().min(1, 'Drop city is required').optional(),
    dropState: z.string().optional(),
    dropLat: z.preprocess((v) => (v === undefined ? v : parseFloat(v)), z.number().min(-90).max(90, 'Invalid drop latitude').optional()),
    dropLng: z.preprocess((v) => (v === undefined ? v : parseFloat(v)), z.number().min(-180).max(180, 'Invalid drop longitude').optional()),
    dropAddress: z.string().min(1, 'Drop address is required').optional(),
    dropContactName: z.string().optional(),
    dropContactPhone: z.string().optional(),
    dropContactGst: z.string().optional(),
    materialType: z.string().min(1, 'Material type is required').optional(),
    weight: z.preprocess((v) => {
      if (typeof v === 'number' || typeof v === 'string') {
        const parsed = parseFloat(v);
        return { value: isNaN(parsed) ? undefined : parsed };
      }
      return v;
    }, z.object({
      value: z.preprocess((v) => parseFloat(v), z.number().positive('Weight value must be positive')),
      unit: z.enum(['kg', 'tons', 'quintal']).optional()
    })).optional(),
    weightUnit: z.enum(['kg', 'tons', 'quintal']).optional(),
    truckType: z.string().min(1, 'Truck type is required').optional(),
    bodyType: z.enum(['open', 'closed', 'container', 'tanker', 'flatbed']).optional(),
    expectedDeliveryDate: z.string().datetime('Invalid date format').optional(),
    additionalInstructions: z.string().optional(),
    isHazardous: z.preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean()).optional(),
    isFragile: z.preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean()).optional(),
    requiresTemperatureControl: z.preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean()).optional(),
    // Indent-specific fields
    trafficManager: z.string().optional(),
    trafficController: z.string().optional(),
    numberOfTrucks: z.preprocess((v) => (v === undefined ? v : parseInt(v)), z.number().int().min(1).max(10)).optional(),
    customerPrice: z.preprocess((v) => (v === undefined ? v : parseFloat(v)), z.number().min(0)).optional(),
    supplierPrice: z.preprocess((v) => (v === undefined ? v : parseFloat(v)), z.number().min(0)).optional(),
    customerDetentionCharge: z.preprocess((v) => (v === undefined || v === null ? v : parseFloat(v)), z.number().min(0).nullable()).optional(),
    supplierDetentionCharge: z.preprocess((v) => (v === undefined || v === null ? v : parseFloat(v)), z.number().min(0).nullable()).optional(),
    truckTypeNeeded: z.string().optional(),
    expiryTime: z.string().optional(),
    postToSupplier: z.preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean()).optional(),
    supervisor: z.string().optional(),
    laneCode: z.string().optional(),
    loadType: z.enum(['FTL', 'LTL', 'PTL']).nullable().optional(),
    remarks: z.string().optional(),
    podCourier: z.string().optional(),
    podDocketNo: z.string().optional(),
    podAckNo: z.string().optional(),
    supplierTds: z.preprocess(v => v === undefined || v === null ? null : parseFloat(v), z.number().min(0).max(100).nullable()).optional(),
    actualKm: z.preprocess(v => v === undefined ? undefined : parseFloat(v), z.number().positive()).optional(),
    // LR & Reference Number fields
    boeNumber: z.string().trim().optional(),
    jobNo: z.string().trim().optional(),
    hireChallan: z.string().trim().optional(),
    invoiceNo: z.string().trim().optional(),
    ewayBillNo: z.string().trim().optional(),
    shipmentNo: z.string().trim().optional(),
    containerNo: z.string().trim().optional(),
    poNumber: z.string().trim().optional(),
    invoiceParty: z.enum(['consignor', 'consignee', 'customer']).optional(),
    bookingType: z.enum(['indent', 'direct-load', 'direct-invoice', 'direct-lr']).optional(),
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
