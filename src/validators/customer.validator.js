import { z } from 'zod';

/**
 * Create Customer Validator
 * POST /api/v1/customers
 */
export const createCustomerSchema = z.object({
  body: z.object({
    // For staff/admin creation you can provide either an existing customer `userId`
    // or a `phone` (and optionally email) to create/find the customer user.
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID').optional(),
    phone: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone format').optional(),
    email: z.string().email('Invalid email address').optional(),

    companyName: z.string().min(2, 'Company name must be at least 2 characters'),
    gstNumber: z.string()
      .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST format')
      .optional(),
    address: z.string().min(5, 'Address must be at least 5 characters'),
    city: z.string().min(2, 'City is required'),
    state: z.string().min(2, 'State is required'),
    pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
    contactPerson: z.union([
      z.string().min(2, 'Contact person name is required'),
      z.object({
        name: z.string().min(2, 'Contact person name is required'),
        phone: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone format').optional(),
        email: z.string().email('Invalid email address').optional()
      })
    ]),
    designation: z.string().optional(),
    alternatePhone: z.string().regex(/^\+?[1-9]\d{9,14}$/).optional(),
    creditLimit: z.number().nonnegative().optional(),
    paymentTerms: z.enum(['advance', 'credit', 'cod']).optional()
  })
});

/**
 * Get Customers Query Validator
 * GET /api/v1/customers
 */
export const getCustomersQuerySchema = z.object({
  query: z.object({
    isVerified: z.enum(['true', 'false']).optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    paymentTerms: z.enum(['advance', 'credit', 'cod']).optional(),
    minCreditLimit: z.string().optional(),
    accountManager: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    search: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sort: z.string().optional()
  })
});

/**
 * Customer ID Param Validator
 */
export const customerIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid customer ID')
  })
});

/**
 * Update Customer Validator
 * PATCH /api/v1/customers/:id
 */
export const updateCustomerSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid customer ID')
  }),
  body: z.object({
    companyName: z.string().min(2).optional(),
    gstNumber: z.string()
      .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
      .optional(),
    address: z.object({
      street: z.string(),
      city: z.string(),
      state: z.string(),
      pincode: z.string().regex(/^\d{6}$/)
    }).optional(),
    contactPerson: z.string().min(2).optional(),
    designation: z.string().optional(),
    alternatePhone: z.string().regex(/^\+?[1-9]\d{9,14}$/).optional()
  })
});

/**
 * Update My GST Validator
 * PATCH /api/v1/customers/my-gst
 */
export const updateMyGstSchema = z.object({
  body: z.object({
    gstNumber: z.string()
      .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST number format')
  })
});

/**
 * Update Credit Limit Validator
 * PATCH /api/v1/customers/:id/credit-limit
 */
export const updateCreditLimitSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid customer ID')
  }),
  body: z.object({
    creditLimit: z.number().nonnegative('Credit limit cannot be negative')
  })
});

/**
 * Assign Account Manager Validator
 * POST /api/v1/customers/:id/assign-manager
 */
export const assignAccountManagerSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid customer ID')
  }),
  body: z.object({
    staffId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid staff ID')
  })
});

/**
 * Get Booking History Query Validator
 * GET /api/v1/customers/:id/bookings
 */
export const getBookingHistoryQuerySchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid customer ID').optional()
  }).optional(),
  query: z.object({
    status: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sort: z.string().optional()
  })
});
