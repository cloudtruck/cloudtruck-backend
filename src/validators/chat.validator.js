import { z } from 'zod';

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');

export const createConversationSchema = z.object({
  body: z.object({
    bookingId: mongoId,
  }),
});

export const sendMessageSchema = z.object({
  body: z
    .object({
      text: z.string().min(1).optional(),
      attachments: z
        .array(
          z.object({
            url: z.string().url(),
            name: z.string().optional(),
            type: z.string().optional(),
          })
        )
        .optional(),
    })
    .refine(data => data.text || (data.attachments && data.attachments.length > 0), {
      message: 'Message must have text or at least one attachment',
    }),
});

export const conversationIdParamSchema = z.object({
  params: z.object({
    id: mongoId,
  }),
});
