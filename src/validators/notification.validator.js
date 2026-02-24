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

export const getNotificationsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    status: z.enum(['read', 'unread']).optional(),
    category: z.enum(['truck', 'loading', 'delivery', 'pod', 'payment', 'general']).optional()
  })
});

export const notificationIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid notification ID')
  })
});
