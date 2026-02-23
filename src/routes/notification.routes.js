import express from 'express';
import * as notificationController from '../controllers/notification.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  sendCustomNotificationSchema,
  sendBulkNotificationSchema,
  testNotificationSchema,
  getNotificationsSchema,
  notificationIdParamSchema
} from '../validators/notification.validator.js';

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

// User notification endpoints
router.get('/', validate(getNotificationsSchema), notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', validate(notificationIdParamSchema), notificationController.markAsRead);
router.delete('/:id', validate(notificationIdParamSchema), notificationController.deleteNotification);

// Test notification (any authenticated user)
router.post('/test', validate(testNotificationSchema), notificationController.testNotification);

// Staff/Admin only routes
router.post(
  '/send',
  checkRole('staff', 'internal', 'super-admin'),
  validate(sendCustomNotificationSchema),
  notificationController.sendCustomNotification
);

router.post(
  '/send-bulk',
  checkRole('internal', 'super-admin'),
  validate(sendBulkNotificationSchema),
  notificationController.sendBulkNotification
);

export default router;
