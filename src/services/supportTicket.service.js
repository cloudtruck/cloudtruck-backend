import SupportTicket from '../models/supportTicket.model.js';
import Booking from '../models/booking.model.js';
import AuditLog from '../models/auditLog.model.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import NotificationService from './notification.service.js';

class SupportTicketService {
  /**
   * Create new support ticket/complaint
   * @param {Object} data - Ticket data
   * @param {string} userId - User ID who's creating the ticket
   * @param {string} role - Role of the user
   * @returns {Promise<Object>} Created ticket
   */
  static async createTicket(data, userId, role) {
    const { category, bookingId, subject, description, priority } = data;

    // Optional: resolve numeric bookingId to MongoDB ID
    let bookingDocId = null;
    let bookingIdStr = bookingId;

    if (bookingId) {
      const b = await Booking.findOne({ 
        $or: [{ bookingId: bookingId }, { _id: bookingId }],
        isDeleted: false 
      }).select('_id bookingId');
      
      if (b) {
        bookingDocId = b._id;
        bookingIdStr = b.bookingId;
      }
    }

    const ticket = await SupportTicket.create({
      user: userId,
      userRole: role,
      category,
      booking: bookingDocId,
      bookingIdStr,
      subject,
      description,
      priority: priority || 'medium'
    });

    // Notify Operations Admin
    NotificationService.sendNotification({
      recipient: null, // Broadcast to staff/admin via role or custom logic if needed
      title: 'New Complaint Received',
      message: `A new complaint (${ticket.ticketId}) related to ${category} has been submitted.`,
      type: 'new_complaint',
      channels: ['in-app'],
      entityType: 'support-ticket',
      entityId: ticket._id
    }).catch(err => logger.error('Failed to notify staff of new ticket:', err));

    // Audit log
    AuditLog.create({
      user: userId,
      action: 'CREATE_SUPPORT_TICKET',
      entityType: 'system', // Use 'system' as it is a platform-wide feature for support
      entityId: ticket._id,
      changes: {
        before: null,
        after: ticket.toObject()
      }
    }).catch(err => logger.error('Failed to audit log for support ticket:', err));

    return ticket;
  }

  /**
   * Get tickets for currently logged in user
   * @param {string} userId - Auth user
   * @param {Object} pagination - Page and limit
   * @returns {Promise<Object>} Tickets with pagination
   */
  static async getMyTickets(userId, pagination = {}) {
    const { page = 1, limit = 20 } = pagination;
    
    return await SupportTicket.paginate(
      { user: userId, isDeleted: false },
      { 
        page, 
        limit, 
        sort: { createdAt: -1 } ,
        populate: [
          { path: 'booking', select: 'bookingId status' }
        ]
      }
    );
  }

  /**
   * Get all tickets (Staff/Admin)
   * @param {Object} filters - Filters like category, status
   * @param {Object} pagination - Page and limit
   * @returns {Promise<Object>} Tickets with pagination
   */
  static async getAllTickets(filters = {}, pagination = {}) {
    const { category, status, userId, userRole, priority } = filters;
    const { page = 1, limit = 20 } = pagination;

    const query = { isDeleted: false };
    if (category) query.category = category;
    if (status) query.status = status;
    if (userId) query.user = userId;
    if (userRole) query.userRole = userRole;
    if (priority) query.priority = priority;

    return await SupportTicket.paginate(
      query,
      { 
        page, 
        limit, 
        sort: { createdAt: -1 },
        populate: [
          { path: 'user', select: 'name phone email role' },
          { path: 'booking', select: 'bookingId status' }
        ]
      }
    );
  }

  /**
   * Add a reply to a ticket (driver/customer or staff)
   */
  static async addReply(id, userId, requesterRole, { message }) {
    const ticket = await SupportTicket.findOne({ _id: id, isDeleted: false });
    if (!ticket) throw new ApiError(404, 'Ticket not found');

    // Access control: owner or staff
    if (!['staff', 'internal', 'super-admin'].includes(requesterRole)) {
      if (ticket.user.toString() !== userId.toString()) {
        throw new ApiError(403, 'Access denied');
      }
    }

    ticket.replies.push({ user: userId, message, timestamp: new Date() });

    // Re-open ticket if it was closed/resolved and user replies
    if (['resolved', 'closed'].includes(ticket.status) && !['staff', 'internal', 'super-admin'].includes(requesterRole)) {
      ticket.status = 'open';
    }

    await ticket.save();

    // Return populated ticket so frontend gets updated replies with user names
    return SupportTicket.findById(ticket._id)
      .populate('user', 'name phone email role')
      .populate('replies.user', 'name phone email role');
  }

  /**
   * Update ticket status, priority, assignee, or resolution notes (Staff/Admin)
   */
  static async updateTicket(id, data) {
    const ticket = await SupportTicket.findOne({ _id: id, isDeleted: false });
    if (!ticket) throw new ApiError(404, 'Ticket not found');

    const { status, priority, assignedTo, resolutionNotes } = data;

    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;
    if (assignedTo !== undefined) ticket.assignedTo = assignedTo;
    if (resolutionNotes !== undefined) ticket.resolutionNotes = resolutionNotes;

    if ((status === 'resolved' || status === 'closed') && !ticket.resolvedAt) {
      ticket.resolvedAt = new Date();
    }

    await ticket.save();

    return SupportTicket.findById(ticket._id)
      .populate('user', 'name phone email role')
      .populate('booking', 'bookingId status')
      .populate('assignedTo', 'name department')
      .populate('replies.user', 'name phone email role');
  }

  /**
   * Get single ticket by ID
   */
  static async getTicketById(id, requesterId, requesterRole) {
    const ticket = await SupportTicket.findOne({ _id: id, isDeleted: false })
      .populate('user', 'name phone email role')
      .populate('booking', 'bookingId status pickup drop')
      .populate('replies.user', 'name phone email role');

    if (!ticket) throw new ApiError(404, 'Ticket not found');

    // Access control: Only owner or staff/admin
    if (requesterRole !== 'staff' && requesterRole !== 'internal' && requesterRole !== 'super-admin') {
      if (ticket.user._id.toString() !== requesterId.toString()) {
        throw new ApiError(403, 'Access denied');
      }
    }

    return ticket;
  }
}

export default SupportTicketService;
