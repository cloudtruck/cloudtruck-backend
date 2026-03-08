import { z } from 'zod';

/**
 * Create Driver Validator
 * POST /api/v1/drivers
 */
export const createDriverSchema = z.object({
  body: z.object({
    // Optional target user id - required when a staff/internal/super-admin creates a driver
    user: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID').optional(),
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID').optional(),

    // newUser: optional details to create a new User when admin omits `user`/`userId`
    newUser: z.object({
      phone: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number').optional(),
      email: z.string().email('Invalid email').optional(),
      password: z.string().min(6, 'Password must be at least 6 characters').optional()
    }).optional().refine(obj => !obj || (obj.phone || obj.email), {
      message: 'newUser must include phone or email'
    }),

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
 * Submit Driver KYC Validator
 * POST /api/v1/drivers/my-kyc
 */
export const submitDriverKycSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'),
    city: z.string().min(2, 'City must be at least 2 characters'),
    licenseNumber: z.string().min(5, 'License number must be at least 5 characters'),
    referralCode: z.string().optional(),
    truckType: z.string().min(1, 'Truck type is required')
  })
});

/**
 * Submit Account Info Validator
 * POST /api/v1/drivers/my-account-info
 */
export const submitAccountInfoSchema = z.object({
  body: z.object({
    accountHolderName: z.string().min(2, 'Account holder name must be at least 2 characters'),
    accountNumber: z.string().min(5, 'Account number must be at least 5 characters'),
    ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code'),
    aadhaarNumber: z.string().regex(/^\d{12}$/, 'Aadhaar number must be 12 digits').optional(),
    panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format').optional(),
    gstin: z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d[Z]{1}[A-Z\d]{1}$/, 'Invalid GSTIN format').optional()
  })
});

/**
 * Add My Truck Validator
 * POST /api/v1/drivers/my-truck
 */
export const addMyTruckSchema = z.object({
  body: z.object({
    truckNumber: z.string().min(5, 'Truck number must be at least 5 characters'),
    currentCity: z.string().min(2, 'City must be at least 2 characters'),
    driverPhoneNumber: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number'),
    truckHeight: z.number().positive('Truck height must be a positive number'),
    truckLength: z.number().min(6, 'Minimum length is 6 ft').max(60, 'Maximum length is 60 ft'),
    truckCapacity: z.number().min(0.5, 'Minimum capacity is 0.5 tons').max(40, 'Maximum capacity is 40 tons'),
    insuranceExpiryDate: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid insurance expiry date'),
    truckType: z.string().min(1, 'Truck type is required')
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
    kycStatus: z.enum(['pending', 'submitted', 'verified', 'rejected']).optional(),
    accountInfoStatus: z.enum(['pending', 'submitted', 'verified', 'rejected']).optional(),
    isBlacklisted: z.enum(['true', 'false']).optional(),
    truckType: z.string().optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    radius: z.string().optional(),
    minRating: z.string().optional(),
    matchPickupCity: z.string().optional(),
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

export const userIdParamSchema = z.object({
  params: z.object({
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID')
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
 * Reject Driver Validator
 * POST /api/v1/drivers/:id/reject
 */
export const rejectDriverSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid driver ID')
  }),
  body: z.object({
    reason: z.string().min(10, 'Rejection reason must be at least 10 characters')
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

/**
 * Trip history filter query (shared between admin and driver self-service)
 */
const tripHistoryQueryFields = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  status: z.string().optional(),
  startDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    'Invalid date format. Use YYYY-MM-DD or ISO datetime'
  ).optional(),
  endDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    'Invalid date format. Use YYYY-MM-DD or ISO datetime'
  ).optional(),
  search: z.string().optional(),
  truckType: z.string().optional(),
  customerName: z.string().optional()
});

/**
 * Get Trip History Query Validator
 * GET /api/v1/drivers/:id/trip-history
 */
export const getTripHistoryQuerySchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid driver ID')
  }),
  query: tripHistoryQueryFields
});

/**
 * Get My Trip History Query Validator
 * GET /api/v1/drivers/my-trip-history
 */
export const getMyTripHistoryQuerySchema = z.object({
  query: tripHistoryQueryFields
});
