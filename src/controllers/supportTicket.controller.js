import SupportTicketService from '../services/supportTicket.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';

/**
 * Submit New Complaint
 * POST /api/v1/support-tickets
 */
export const createTicket = asyncHandler(async (req, res) => {
  const ticketData = req.body;
  const userId = req.user._id;
  const role = req.user.role;

  const ticket = await SupportTicketService.createTicket(ticketData, userId, role);

  return res.status(201).json(
    new ApiResponse(201, ticket, 'Complaint submitted successfully. Our support team will review it shortly.')
  );
});

/**
 * Get My Tickets (Driver/Customer)
 * GET /api/v1/support-tickets/my-tickets
 */
export const getMyTickets = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { page, limit } = req.query;

  const tickets = await SupportTicketService.getMyTickets(userId, { page, limit });

  return res.status(200).json(
    new ApiResponse(200, tickets, 'Your support tickets fetched successfully')
  );
});

/**
 * Get Support Tickets (All for staff, My for Driver/Customer)
 * GET /api/v1/support-tickets
 */
export const getAllTickets = asyncHandler(async (req, res) => {
  const filters = { ...req.query };
  const { page, limit } = req.query;
  const userRole = req.user.role;
  const userId = req.user._id;

  // Enforcement: Only staff/admin can see everyone's tickets. Users see their own.
  if (userRole === 'driver' || userRole === 'customer') {
    filters.userId = userId;
    delete filters.userRole; // Don't allow them to filter by role
  }

  const tickets = await SupportTicketService.getAllTickets(filters, { page, limit });

  return res.status(200).json(
    new ApiResponse(200, tickets, 'Support tickets fetched successfully')
  );
});

/**
 * Add Reply to Ticket
 * POST /api/v1/support-tickets/:id/reply
 */
export const addReply = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const requesterRole = req.user.role;
  const { message } = req.body;

  if (!message || message.trim().length < 2) {
    throw new ApiError(400, 'Reply message must be at least 2 characters');
  }

  const ticket = await SupportTicketService.addReply(id, userId, requesterRole, { message: message.trim() });

  return res.status(200).json(
    new ApiResponse(200, ticket, 'Reply added successfully')
  );
});

/**
 * Get Ticket By ID
 * GET /api/v1/support-tickets/:id
 */
export const getTicketById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const requesterId = req.user._id;
  const requesterRole = req.user.role;

  const ticket = await SupportTicketService.getTicketById(id, requesterId, requesterRole);

  return res.status(200).json(
    new ApiResponse(200, ticket, 'Support ticket details fetched successfully')
  );
});
