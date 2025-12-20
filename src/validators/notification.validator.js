import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const sendCustomNotificationSchema = z.object({
  body: z.object({
    userId: z.string().regex(objectIdRegex, 'Invalid user ID'),
    title: z.string().min(1).max(100),
    message: z.string().min(1).max(500),
    data: z.record(z.any()).optional()
  })
});

export const sendBulkNotificationSchema = z.object({
  body: z.object({
    userIds: z.array(z.string().regex(objectIdRegex, 'Invalid user ID')).min(1),
    title: z.string().min(1).max(100),
    message: z.string().min(1).max(500),
    data: z.record(z.any()).optional()
  })
});

export const testNotificationSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(100).optional(),
    message: z.string().min(1).max(500).optional()
  })
});
