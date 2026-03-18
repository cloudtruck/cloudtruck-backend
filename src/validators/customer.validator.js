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
    address: z.string().min(5, 'Address must be at least 5 characters').optional(),
    city: z.string().min(2, 'City is required').optional(),
    state: z.string().min(2, 'State is required').optional(),
    pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits').optional(),
    contactPerson: z.union([
      z.string().min(2, 'Contact person name is required'),
      z.object({
        name: z.string().min(2, 'Contact person name is required'),
        phone: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone format').optional(),
        email: z.string().email('Invalid email address').optional()
      })
    ]).optional(),
    designation: z.string().optional(),
    alternatePhone: z.string().regex(/^\+?[1-9]\d{9,14}$/).optional(),
    creditLimit: z.number().nonnegative().optional(),
    paymentTerms: z.enum(['advance', 'credit', 'cod']).optional(),
    pan: z.string().optional(),
    customerType: z.string().optional(),
    companyType: z.string().optional(),
    shortName: z.string().optional(),
    customerCode: z.string().optional()
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
 * Bank Account ID Param Validator
 */
export const bankAccountIdParamSchema = z.object({
  params: z.object({
    accountId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid bank account ID')
  })
});

/**
 * Add Bank Account Validator
 * POST /api/v1/customers/my-bank-accounts
 */
export const addBankAccountSchema = z.object({
  body: z.object({
    accountNumber: z.string().min(1, 'Account number is required').trim(),
    ifscCode: z.string().min(1, 'IFSC code is required').trim()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i, 'Invalid IFSC code format'),
    accountHolderName: z.string().min(1, 'Account holder name is required').trim(),
    bankName: z.string().min(1, 'Bank name is required').trim(),
    branchName: z.string().trim().optional(),
    accountType: z.enum(['savings', 'current', 'od']).optional(),
    upiId: z.string().trim().optional(),
    isPrimary: z.boolean().optional()
  })
});

/**
 * Update Bank Account Validator
 * PATCH /api/v1/customers/my-bank-accounts/:accountId
 */
export const updateBankAccountSchema = z.object({
  params: z.object({
    accountId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid bank account ID')
  }),
  body: z.object({
    accountNumber: z.string().min(1).trim().optional(),
    ifscCode: z.string().trim()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i, 'Invalid IFSC code format').optional(),
    accountHolderName: z.string().min(1).trim().optional(),
    bankName: z.string().min(1).trim().optional(),
    branchName: z.string().trim().optional(),
    accountType: z.enum(['savings', 'current', 'od']).optional(),
    upiId: z.string().trim().optional(),
    isPrimary: z.boolean().optional()
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
    truckType: z.string().optional(),
    podPending: z.enum(['true', 'false']).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sort: z.string().optional()
  })
});
