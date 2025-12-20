import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const recordLocationSchema = z.object({
  params: z.object({
    bookingId: z.string().regex(objectIdRegex, 'Invalid booking ID')
  }),
  body: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().nonnegative().optional(),
    speed: z.number().nonnegative().optional(),
    heading: z.number().min(0).max(360).optional(),
    battery: z.number().min(0).max(100).optional(),
    networkType: z.string().optional()
  })
});

export const bookingIdParamSchema = z.object({
  params: z.object({
    bookingId: z.string().regex(objectIdRegex, 'Invalid booking ID')
  })
});

export const getTrackingHistorySchema = z.object({
  params: z.object({
    bookingId: z.string().regex(objectIdRegex, 'Invalid booking ID')
  }),
  query: z.object({
    fromTime: z.string().datetime().optional(),
    toTime: z.string().datetime().optional()
  })
});

export const getTrackingRouteSchema = z.object({
  params: z.object({
    bookingId: z.string().regex(objectIdRegex, 'Invalid booking ID')
  }),
  query: z.object({
    interval: z.string().regex(/^\d+$/).optional()
  })
});
