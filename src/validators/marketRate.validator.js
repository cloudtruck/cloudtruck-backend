import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createMarketRateSchema = z.object({
  body: z.object({
    fromCity: z.string().min(1).max(100),
    toCity: z.string().min(1).max(100),
    truckType: z.string().min(1).max(50),
    price: z.number().positive(),
    distance: z.number().positive().optional(),
    estimatedTime: z.string().max(50).optional(),
    bookingCount: z.number().int().min(0).optional(),
    priceTrends: z.array(z.object({
      month: z.string().min(1),
      year: z.number().int(),
      price: z.number().positive()
    })).optional()
  })
});

export const updateMarketRateSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid market rate ID')
  }),
  body: z.object({
    fromCity: z.string().min(1).max(100).optional(),
    toCity: z.string().min(1).max(100).optional(),
    truckType: z.string().min(1).max(50).optional(),
    price: z.number().positive().optional(),
    distance: z.number().positive().optional(),
    estimatedTime: z.string().max(50).optional(),
    bookingCount: z.number().int().min(0).optional(),
    priceTrends: z.array(z.object({
      month: z.string().min(1),
      year: z.number().int(),
      price: z.number().positive()
    })).optional(),
    isActive: z.boolean().optional()
  })
});

export const getMarketRatesQuerySchema = z.object({
  query: z.object({
    fromCity: z.string().optional(),
    toCity: z.string().optional(),
    truckType: z.string().optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional()
  })
});

export const getPriceTrendsQuerySchema = z.object({
  query: z.object({
    fromCity: z.string().optional(),
    toCity: z.string().optional(),
    truckType: z.string().optional()
  })
});

export const marketRateIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid market rate ID')
  })
});
