import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

const bankDetailsSchema = z.object({
  accountNumber:     z.string().optional(),
  ifscCode:          z.string().optional(),
  accountHolderName: z.string().optional(),
  bankName:          z.string().optional(),
}).optional();

export const createSupplierSchema = z.object({
  body: z.object({
    displayName:  z.string().min(1),
    companyName:  z.string().min(1),

    panNumber:    z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format (e.g. ABCDE1234F)'),
    aadharNumber: z.string().regex(/^\d{12}$/, 'Aadhaar must be 12 digits').optional(),

    gstin:                     z.string().optional(),
    companyRegistrationNumber: z.string().optional(),

    phone: z.string().min(10),
    email: z.string().email().optional(),
    city:  z.string().optional(),

    bankDetails: bankDetailsSchema,
  }),
});

export const updateSupplierSchema = z.object({
  body: z.object({
    displayName:               z.string().min(1).optional(),
    companyName:               z.string().optional(),
    gstin:                     z.string().optional(),
    companyRegistrationNumber: z.string().optional(),
    panNumber:                 z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format').optional(),
    aadharNumber:              z.string().regex(/^\d{12}$/, 'Aadhaar must be 12 digits').optional(),
    phone:                     z.string().min(10).optional(),
    email:                     z.string().email().optional(),
    city:                      z.string().optional(),
    bankDetails:               bankDetailsSchema,
  }),
});

export const getSuppliersQuerySchema = z.object({
  query: z.object({
    supplierType:       z.enum(['company', 'individual']).optional(),
    verificationStatus: z.string().optional(),
    isBlacklisted:      z.enum(['true', 'false']).optional(),
    search:             z.string().optional(),
    city:               z.string().optional(),
    page:               z.string().optional(),
    limit:              z.string().optional(),
    sort:               z.string().optional(),
  }),
});

export const addDriverToFleetSchema = z.object({
  body: z.object({
    driverId:      objectId.optional(),
    name:          z.string().min(2, 'Name must be at least 2 characters').optional(),
    phone:         z.string().min(10).optional(),
    licenseNumber: z.string().optional(),
  }).refine((data) => data.driverId || data.phone, {
    message: 'Either driverId or phone is required',
  }),
});

export const addVehicleToFleetSchema = z.object({
  body: z.object({
    vehicleId: objectId,
  }),
});

export const rejectSupplierSchema = z.object({
  body: z.object({
    reason: z.string().min(1),
  }),
});

export const blacklistSupplierSchema = z.object({
  body: z.object({
    reason: z.string().min(1),
  }),
});
