import express from 'express';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  createConversationSchema,
  sendMessageSchema,
  conversationIdParamSchema,
} from '../validators/chat.validator.js';
import * as chatController from '../controllers/chat.controller.js';

const router = express.Router();

// Create or get conversation (driver initiates, linked to a booking)
router.post(
  '/',
  verifyJWT,
  checkRole('driver', 'staff', 'super-admin'),
  validate(createConversationSchema),
  chatController.createOrGetConversation
);

// Get all conversations for the logged-in user
router.get('/', verifyJWT, chatController.getMyConversations);

// Get messages in a conversation
router.get(
  '/:id/messages',
  verifyJWT,
  validate(conversationIdParamSchema),
  chatController.getMessages
);

// Send message (REST fallback)
router.post(
  '/:id/messages',
  verifyJWT,
  validate(sendMessageSchema),
  chatController.sendMessage
);

// Mark conversation as read
router.patch(
  '/:id/read',
  verifyJWT,
  validate(conversationIdParamSchema),
  chatController.markAsRead
);

export default router;
