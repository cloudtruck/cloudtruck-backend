import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

// Accepts 10-digit Indian mobiles with optional 91 / +91 prefix, spaces or dashes
const phoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s\-]/g, '').replace(/^\+?91(?=\d{10}$)/, ''))
  .refine((v) => /^[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit Indian mobile number')
  .transform((v) => `+91${v}`);

const stateSchema = z.string().trim().min(1).max(100);

export const createAgentContactSchema = z.object({
  body: z.object({
    state: stateSchema,
    phone: phoneSchema,
    isActive: z.boolean().optional()
  })
});

export const updateAgentContactSchema = z.object({
  params: z.object({ id: z.string().regex(objectIdRegex, 'Invalid agent contact ID') }),
  body: z.object({
    state: stateSchema.optional(),
    phone: phoneSchema.optional(),
    isActive: z.boolean().optional()
  })
});

export const agentContactIdParamSchema = z.object({
  params: z.object({ id: z.string().regex(objectIdRegex, 'Invalid agent contact ID') })
});

export const lookupAgentContactSchema = z.object({
  query: z.object({ state: z.string().trim().min(1).max(100) })
});
