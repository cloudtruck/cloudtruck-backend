import { z } from 'zod';

/**
 * Send OTP Validator
 * POST /api/v1/auth/otp/send
 */
export const sendOTPSchema = z.object({
  body: z.object({
    phone: z.string().min(10, 'Phone number must be at least 10 digits')
  })
});

/**
 * Verify OTP Validator
 * POST /api/v1/auth/otp/verify
 */
export const verifyOTPSchema = z.object({
  body: z.object({
    phone: z.string().min(10, 'Phone number must be at least 10 digits'),
    otp: z.string().min(4, 'OTP must be at least 4 digits').max(6, 'OTP must be at most 6 digits'),
    role: z.enum(['customer', 'driver', 'supplier'], {
      errorMap: () => ({ message: 'Role must be customer, driver, or supplier' })
    }),
    deviceInfo: z.object({
      fcmToken: z.string().optional(),
      deviceModel: z.string().optional(),
      os: z.string().optional(),
      appVersion: z.string().optional(),
      ipAddress: z.string().optional()
    }).optional()
  })
});

/**
 * Mobile Login Validator
 * POST /api/v1/auth/login/mobile
 */
export const mobileLoginSchema = z.object({
  body: z.object({
    phone: z.string().min(10, 'Phone number must be at least 10 digits'),
    role: z.enum(['customer', 'driver'], {
      errorMap: () => ({ message: 'Role must be either customer or driver' })
    }),
    deviceInfo: z.object({
      fcmToken: z.string().optional(),
      deviceModel: z.string().optional(),
      os: z.string().optional(),
      appVersion: z.string().optional(),
      ipAddress: z.string().optional()
    }).optional()
  })
});

/**
 * Staff Login Validator
 * POST /api/v1/auth/login/staff
 */
export const staffLoginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    deviceInfo: z.object({
      deviceModel: z.string().optional(),
      os: z.string().optional(),
      appVersion: z.string().optional(),
      ipAddress: z.string().optional()
    }).optional()
  })
});

/**
 * Register Staff Validator
 * POST /api/v1/auth/register/staff
 */
export const registerStaffSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    phone: z.string().min(5, 'Phone must be at least 5 characters').optional(),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    role: z.enum(['staff', 'internal', 'super-admin']),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    department: z.string().optional(),
    title: z.string().optional(),
    reportingManager: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid manager ID').optional(),
    workingHours: z.object({
      start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
      end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
      timezone: z.string().optional(),
      workingDays: z.array(
        z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
      ).optional()
    }).optional(),
    permissions: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid permission ID')).optional()
  })
});

/**
 * Refresh Token Validator
 * POST /api/v1/auth/refresh-token
 */
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional()
  }).optional()
});

/**
 * Change Password Validator
 * POST /api/v1/auth/change-password
 */
export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string()
      .min(8, 'New password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
  })
});

/**
 * Reset Password Validator
 * POST /api/v1/auth/reset-password
 */
export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address')
  })
});

/**
 * User ID Param Validator
 * For routes with :userId parameter
 */
/**
 * Update Language Preference Validator
 * PATCH /api/v1/auth/language
 */
export const updateLanguageSchema = z.object({
  body: z.object({
    language: z.enum(['en', 'hi'], {
      errorMap: () => ({ message: 'Language must be either en (English) or hi (Hindi)' })
    })
  })
});

export const userIdParamSchema = z.object({
  params: z.object({
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format')
  })
});
