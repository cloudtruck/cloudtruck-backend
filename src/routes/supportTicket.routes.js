import express from 'express';
import * as supportTicketController from '../controllers/supportTicket.controller.js';

import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  createTicketSchema,
  getSupportTicketsQuerySchema,
  ticketIdParamSchema
} from '../validators/supportTicket.validator.js';

const router = express.Router();

/**
 * Common Submit Complaint route (Driver/Customer)
 * POST /api/v1/support-tickets
 */
router.post(
  '/', 
  verifyJWT, 
  validate(createTicketSchema), 
  supportTicketController.createTicket
);

/**
 * Get My Tickets (Self-service for Driver/Customer)
 * GET /api/v1/support-tickets/my-tickets
 */
router.get(
  '/my-tickets', 
  verifyJWT, 
  supportTicketController.getMyTickets
);

/**
 * Get Support Tickets (All for staff, My for Driver/Customer)
 * GET /api/v1/support-tickets
 */
router.get(
  '/', 
  verifyJWT, 
  checkRole('driver', 'customer', 'staff', 'internal', 'super-admin'), 
  validate(getSupportTicketsQuerySchema), 
  supportTicketController.getAllTickets
);

/**
 * Add Reply to Ticket
 * POST /api/v1/support-tickets/:id/reply
 */
router.post(
  '/:id/reply',
  verifyJWT,
  validate(ticketIdParamSchema),
  supportTicketController.addReply
);

/**
 * Get Ticket by ID (Authorized user or staff)
 * GET /api/v1/support-tickets/:id
 */
router.get(
  '/:id',
  verifyJWT,
  validate(ticketIdParamSchema),
  supportTicketController.getTicketById
);

export default router;
