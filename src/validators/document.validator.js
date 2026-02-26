import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const uploadDocumentSchema = z.object({
  body: z.object({
    entityType: z.enum(['booking', 'driver', 'customer', 'vehicle']),
    entityId: z.string().regex(objectIdRegex, 'Invalid entity ID'),
    documentType: z.enum(['pod', 'lr', 'lr-copy', 'weight-slip', 'loading-image', 'rc', 'license', 'permit', 'gst', 'pan', 'other'])
  })
});

export const getDocumentsByEntitySchema = z.object({
  params: z.object({
    entityType: z.enum(['booking', 'driver', 'customer', 'vehicle']),
    entityId: z.string().regex(objectIdRegex, 'Invalid entity ID')
  }),
  query: z.object({
    documentType: z.enum(['pod', 'lr', 'lr-copy', 'weight-slip', 'loading-image', 'rc', 'license', 'permit', 'gst', 'pan', 'other']).optional()
  })
});

export const documentIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid document ID')
  })
});

export const bookingIdParamSchema = z.object({
  params: z.object({
    bookingId: z.string().regex(objectIdRegex, 'Invalid booking ID')
  })
});

export const uploadLRSchema = z.object({
  params: z.object({
    bookingId: z.string().regex(objectIdRegex, 'Invalid booking ID')
  }),
  body: z.object({
    lrNumber: z.string().min(1, 'LR number is required'),
    lrDate: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid date format'),
    remarks: z.string().optional()
  })
});

export const getSignedUrlSchema = z.object({
  params: z.object({
    cloudinaryId: z.string().min(1, 'Cloudinary ID required')
  }),
  query: z.object({
    expiresIn: z.string().regex(/^\d+$/).optional()
  })
});
