import { z } from 'zod';

/**
 * Submit Complaint Validator
 * POST /api/v1/support-tickets
 */
export const COMPLAINT_CATEGORIES = [
  'booking-issue',
  'payment-issue',
  'delivery-delay',
  'damaged-goods',
  'driver-behavior',
  'app-issue',
  'pod-issue',
  'other'
];

export const createTicketSchema = z.object({
  body: z.object({
    category: z.enum(COMPLAINT_CATEGORIES, { 
      errorMap: () => ({ message: `Invalid category. Must be one of: ${COMPLAINT_CATEGORIES.join(', ')}` }) 
    }),
    bookingId: z.string().optional(),
    subject: z.string().min(5, 'Subject must be at least 5 characters long').max(100),
    description: z.string().min(10, 'Description must be at least 10 characters long').max(1000),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  })
});

/**
 * Support Tickets Query Validator
 * GET /api/v1/support-tickets
 */
export const getSupportTicketsQuerySchema = z.object({
  query: z.object({
    category: z.string().optional(),
    status: z.string().optional(),
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID').optional(),
    userRole: z.enum(['driver', 'customer', 'staff']).optional(),
    priority: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional()
  })
});

/**
 * Ticket ID Param Validator
 */
export const ticketIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ticket ID')
  })
});
