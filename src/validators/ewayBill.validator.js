import { z } from 'zod';

/**
 * GSTIN validation regex
 * Format: 2 digits + 5 chars + 4 digits + 1 char + 1 char/digit + Z + 1 char/digit
 */
const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Vehicle number validation regex
 * Format: AA00AA0000 (Indian vehicle registration)
 */
const vehicleNumberRegex = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/;

/**
 * GSTIN Schema
 */
export const gstinSchema = z.string()
  .min(15, 'GSTIN must be 15 characters')
  .max(15, 'GSTIN must be 15 characters')
  .regex(gstinRegex, 'Invalid GSTIN format')
  .transform(val => val.toUpperCase().trim());

/**
 * Item Schema for E-way Bill
 */
const itemSchema = z.object({
  hsnCode: z.string()
    .min(4, 'HSN code must be at least 4 digits')
    .max(8, 'HSN code must be at most 8 digits')
    .regex(/^\d{4,8}$/, 'HSN code must contain only digits'),
  description: z.string().min(3, 'Item description is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.enum(['KGS', 'MTR', 'LTR', 'PCS', 'BOX', 'TON', 'BAG', 'ROLL', 'BUNDLE', 'OTHER']),
  taxableValue: z.number().nonnegative('Taxable value cannot be negative'),
  cgst: z.number().nonnegative('CGST cannot be negative').default(0),
  sgst: z.number().nonnegative('SGST cannot be negative').default(0),
  igst: z.number().nonnegative('IGST cannot be negative').default(0)
});

/**
 * Create E-way Bill Validator
 * POST /api/v1/eway-bills
 */
export const createEwayBillSchema = z.object({
  body: z.object({
    ewayBillNumber: z.string()
      .min(12, 'E-way bill number is required')
      .max(20, 'E-way bill number too long')
      .transform(val => val.toUpperCase().trim()),
    
    bookingId: z.string()
      .min(1, 'Booking ID is required')
      .regex(/^[0-9a-fA-F]{24}$|^BK\d+$/, 'Invalid booking ID format'),
    
    // Part A: Consignment Details
    fromGstin: gstinSchema,
    toGstin: gstinSchema,
    
    documentNumber: z.string().min(1, 'Document number is required'),
    documentDate: z.string().datetime('Invalid document date format'),
    documentType: z.enum(['INV', 'BIL', 'CHL', 'DCN', 'OTH']).default('INV'),
    
    itemList: z.array(itemSchema)
      .min(1, 'At least one item is required')
      .max(100, 'Maximum 100 items allowed'),
    
    partATotalValue: z.number().positive('Total value must be positive'),
    totalTax: z.number().nonnegative('Total tax cannot be negative'),
    
    // Part B: Transporter Details (optional at creation)
    vehicleNumber: z.string()
      .regex(vehicleNumberRegex, 'Invalid vehicle number format')
      .transform(val => val.toUpperCase().trim())
      .optional(),
    
    transporterId: z.string()
      .min(15, 'Transporter ID must be 15 characters (GSTIN)')
      .max(15, 'Transporter ID must be 15 characters')
      .optional(),
    
    transMode: z.enum(['ROAD', 'RAIL', 'AIR', 'SHIP']).default('ROAD'),
    transDocNo: z.string().optional(),
    transDate: z.string().datetime('Invalid transport date format').optional(),
    
    // Validity Period
    validFrom: z.string().datetime('Invalid validity start date'),
    validUpto: z.string().datetime('Invalid validity end date')
  })
    .refine(data => {
      // Ensure validUpto is after validFrom
      const from = new Date(data.validFrom);
      const upto = new Date(data.validUpto);
      return upto > from;
    }, {
      message: 'Validity end date must be after start date',
      path: ['validUpto']
    })
    .refine(data => {
      // Ensure fromGstin and toGstin are different
      return data.fromGstin !== data.toGstin;
    }, {
      message: 'Supplier and recipient GSTIN cannot be the same',
      path: ['toGstin']
    })
});

/**
 * Update Part-B Validator
 * PUT /api/v1/eway-bills/:id/part-b
 */
export const updatePartBSchema = z.object({
  body: z.object({
    vehicleNumber: z.string()
      .regex(vehicleNumberRegex, 'Invalid vehicle number format')
      .transform(val => val.toUpperCase().trim()),
    
    transporterId: z.string()
      .min(15, 'Transporter ID must be 15 characters (GSTIN)')
      .max(15, 'Transporter ID must be 15 characters')
      .optional(),
    
    transMode: z.enum(['ROAD', 'RAIL', 'AIR', 'SHIP']).optional(),
    transDocNo: z.string().optional(),
    transDate: z.string().datetime('Invalid transport date format').optional(),
    
    reason: z.enum([
      'VEHICLE_BREAKDOWN',
      'DRIVER_CHANGE',
      'ROUTE_CHANGE',
      'TRANSSHIPMENT',
      'FIRST_ASSIGNMENT',
      'OTHER'
    ]),
    
    notes: z.string().max(500, 'Notes must be less than 500 characters').optional()
  })
});

/**
 * Get E-way Bills Query Validator
 * GET /api/v1/eway-bills
 */
export const getEwayBillsQuerySchema = z.object({
  query: z.object({
    status: z.union([
      z.enum(['draft', 'active', 'expired', 'cancelled']),
      z.string() // For comma-separated multiple statuses
    ]).optional(),
    
    bookingId: z.string().optional(),
    
    dateFrom: z.string().datetime('Invalid date format').optional(),
    dateTo: z.string().datetime('Invalid date format').optional(),
    
    expiringWithinDays: z.string()
      .regex(/^\d+$/, 'Must be a number')
      .transform(val => parseInt(val, 10))
      .optional(),
    
    search: z.string().optional(),
    
    page: z.string()
      .regex(/^\d+$/, 'Page must be a number')
      .transform(val => parseInt(val, 10))
      .optional(),
    
    limit: z.string()
      .regex(/^\d+$/, 'Limit must be a number')
      .transform(val => parseInt(val, 10))
      .optional(),
    
    sort: z.string().optional()
  })
});

/**
 * Get E-way Bill by ID Validator
 * GET /api/v1/eway-bills/:id
 */
export const getEwayBillByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid E-way bill ID')
  })
});

/**
 * Cancel E-way Bill Validator
 * PATCH /api/v1/eway-bills/:id/cancel
 */
export const cancelEwayBillSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid E-way bill ID')
  }),
  body: z.object({
    reason: z.string().min(10, 'Cancellation reason must be at least 10 characters')
  })
});

/**
 * Sync E-way bill from Portal by Number
 * POST /api/v1/eway-bills/sync
 */
export const syncEwayBillSchema = z.object({
  body: z.object({
    ewayBillNumber: z.string()
      .min(12, 'E-way bill number must be 12 digits')
      .max(12, 'E-way bill number must be 12 digits')
      .regex(/^\d{12}$/, 'E-way bill number must be 12 digits')
      .transform(val => val.trim())
  })
});

/**
 * Get Part-B History Validator
 * GET /api/v1/eway-bills/:id/history
 */
export const getPartBHistorySchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid E-way bill ID')
  })
});
