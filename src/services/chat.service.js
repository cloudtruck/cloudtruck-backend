import Conversation from '../models/conversation.model.js';
import Message from '../models/message.model.js';
import Booking from '../models/booking.model.js';
import Driver from '../models/driver.model.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import NotificationService from './notification.service.js';

let _io = null;

class ChatService {
  static setIO(io) {
    _io = io;
  }

  /**
   * Create or retrieve an existing conversation for a booking+driver pair.
   * Driver must be assigned to the booking.
   */
  static async createOrGetConversation(bookingId, driverUserId) {
    const booking = await Booking.findOne({ _id: bookingId, isDeleted: false })
      .select('_id bookingId driver assignedStaff status pickup drop');

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Verify the requesting user is the assigned driver
    const driverProfile = await Driver.findOne({ user: driverUserId }).select('_id user');
    if (!driverProfile) {
      throw new ApiError(403, 'Driver profile not found');
    }

    if (!booking.driver || booking.driver.toString() !== driverProfile._id.toString()) {
      throw new ApiError(403, 'You are not assigned to this booking');
    }

    // Build participants list: driver user + assigned staff users
    const participants = [driverUserId];
    if (booking.assignedStaff && booking.assignedStaff.length > 0) {
      booking.assignedStaff.forEach(s => {
        const uid = s.user ? s.user.toString() : s.toString();
        if (!participants.map(p => p.toString()).includes(uid)) {
          participants.push(uid);
        }
      });
    }

    const conversation = await Conversation.findOneAndUpdate(
      { booking: bookingId, driver: driverUserId },
      {
        $setOnInsert: {
          booking: bookingId,
          driver: driverUserId,
          participants,
        },
      },
      { upsert: true, new: true }
    ).populate('booking', 'bookingId pickup drop status');

    return conversation;
  }

  /**
   * Send a message in a conversation.
   * Persists to DB, updates lastMessage, increments unread for others, emits via Socket.io.
   */
  static async sendMessage(conversationId, senderId, senderRole, { text, attachments = [] }, io) {
    const conversation = await Conversation.findOne({ _id: conversationId, isDeleted: false });
    if (!conversation) {
      throw new ApiError(404, 'Conversation not found');
    }

    const isStaff = ['staff', 'internal', 'super-admin'].includes(senderRole);
    const isParticipant = isStaff || conversation.participants.some(p => p.toString() === senderId.toString());
    if (!isParticipant) {
      throw new ApiError(403, 'You are not a participant in this conversation');
    }

    if (!text && (!attachments || attachments.length === 0)) {
      throw new ApiError(400, 'Message must have text or attachments');
    }

    const message = await Message.create({
      conversation: conversationId,
      sender: senderId,
      senderRole,
      text: text || '',
      attachments,
      status: 'sent',
    });

    // Update conversation lastMessage + unread counts for other participants
    const unreadUpdate = {};
    conversation.participants.forEach(p => {
      if (p.toString() !== senderId.toString()) {
        const key = p.toString();
        const current = conversation.unreadCounts.get(key) || 0;
        unreadUpdate[`unreadCounts.${key}`] = current + 1;
      }
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: { text: text || '', sender: senderId, sentAt: new Date() },
      ...unreadUpdate,
      updatedAt: new Date(),
    });

    // Populate sender info before emitting
    const populated = await Message.findById(message._id)
      .populate('sender', 'name phone role')
      .lean();

    // Emit to socket room
    const socketInstance = io || _io;
    if (socketInstance) {
      socketInstance
        .of('/chat')
        .to(`conversation:${conversationId}`)
        .emit('message:new', populated);
    }

    // Notify other participants via in-app notification
    const otherParticipants = conversation.participants.filter(
      p => p.toString() !== senderId.toString()
    );
    otherParticipants.forEach(recipientId => {
      NotificationService.sendNotification({
        recipient: recipientId,
        title: 'New Message',
        message: text ? (text.length > 60 ? text.slice(0, 57) + '...' : text) : 'Sent an attachment',
        type: 'chat_message',
        channels: ['in-app'],
        entityType: 'conversation',
        entityId: conversationId,
      }).catch(err => logger.error('Chat notification failed:', err));
    });

    return populated;
  }

  /**
   * Get paginated messages for a conversation (newest first from DB, caller reverses for display).
   */
  static async getConversationMessages(conversationId, userId, { page = 1, limit = 30 }) {
    const conversation = await Conversation.findOne({ _id: conversationId, isDeleted: false });
    if (!conversation) {
      throw new ApiError(404, 'Conversation not found');
    }

    const isParticipant = conversation.participants.some(p => p.toString() === userId.toString());
    if (!isParticipant) {
      throw new ApiError(403, 'You are not a participant in this conversation');
    }

    const result = await Message.paginate(
      { conversation: conversationId, isDeleted: false },
      {
        page,
        limit,
        sort: { createdAt: -1 },
        populate: { path: 'sender', select: 'name phone role' },
      }
    );

    return result;
  }

  /**
   * Get all conversations for a user (driver or staff).
   */
  static async getMyConversations(userId, { page = 1, limit = 20 }) {
    const result = await Conversation.paginate(
      { participants: userId, isDeleted: false },
      {
        page,
        limit,
        sort: { updatedAt: -1 },
        populate: [
          { path: 'booking', select: 'bookingId pickup drop status' },
          { path: 'driver', select: 'name phone' },
        ],
      }
    );

    return result;
  }

  /**
   * Mark all messages in a conversation as read for the given user.
   */
  static async markAsRead(conversationId, userId) {
    const conversation = await Conversation.findOne({ _id: conversationId, isDeleted: false });
    if (!conversation) {
      throw new ApiError(404, 'Conversation not found');
    }

    const isParticipant = conversation.participants.some(p => p.toString() === userId.toString());
    if (!isParticipant) {
      throw new ApiError(403, 'You are not a participant in this conversation');
    }

    // Reset unread count for this user
    conversation.unreadCounts.set(userId.toString(), 0);
    await conversation.save();

    // Mark messages from others as read
    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: userId },
        status: { $ne: 'read' },
        isDeleted: false,
      },
      { $set: { status: 'read' } }
    );

    // Notify room
    if (_io) {
      _io.of('/chat')
        .to(`conversation:${conversationId}`)
        .emit('conversation:read', { conversationId, userId: userId.toString() });
    }

    return { success: true };
  }
}

export default ChatService;
