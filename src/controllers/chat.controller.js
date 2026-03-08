import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ChatService from '../services/chat.service.js';

/**
 * POST /api/v1/chats
 * Create or get existing conversation for a booking
 */
export const createOrGetConversation = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;
  const conversation = await ChatService.createOrGetConversation(bookingId, req.user._id);
  return res.status(200).json(new ApiResponse(200, conversation, 'Conversation ready'));
});

/**
 * GET /api/v1/chats
 * Get all conversations for the logged-in user
 */
export const getMyConversations = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const result = await ChatService.getMyConversations(req.user._id, { page, limit });
  return res.status(200).json(new ApiResponse(200, result, 'Conversations fetched'));
});

/**
 * GET /api/v1/chats/:id/messages
 * Get paginated messages for a conversation
 */
export const getMessages = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  const result = await ChatService.getConversationMessages(req.params.id, req.user._id, { page, limit });
  return res.status(200).json(new ApiResponse(200, result, 'Messages fetched'));
});

/**
 * POST /api/v1/chats/:id/messages
 * REST fallback for sending a message
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const { text, attachments } = req.body;
  const io = req.app.get('io');
  const message = await ChatService.sendMessage(
    req.params.id,
    req.user._id,
    req.user.role,
    { text, attachments },
    io
  );
  return res.status(201).json(new ApiResponse(201, message, 'Message sent'));
});

/**
 * PATCH /api/v1/chats/:id/read
 * Mark conversation as read
 */
export const markAsRead = asyncHandler(async (req, res) => {
  const result = await ChatService.markAsRead(req.params.id, req.user._id);
  return res.status(200).json(new ApiResponse(200, result, 'Conversation marked as read'));
});
