import NotificationService from '../services/notification.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';

/**
 * Send custom notification to user
 */
export const sendCustomNotification = asyncHandler(async (req, res) => {
  const { userId, title, message, data } = req.body;

  await NotificationService.sendCustomNotification(userId, title, message, data);

  return res.status(200).json(new ApiResponse(200, null, 'Notification sent successfully'));
});

/**
 * Send notification to multiple users
 */
export const sendBulkNotification = asyncHandler(async (req, res) => {
  const { userIds, title, message, data } = req.body;

  await NotificationService.sendToMultipleUsers(userIds, {
    title,
    body: message,
    data
  });

  return res.status(200).json(new ApiResponse(200, null, `Notification sent to ${userIds.length} users`));
});

/**
 * Test notification
 */
export const testNotification = asyncHandler(async (req, res) => {
  const { title, message } = req.body;

  await NotificationService.sendToUser(req.user._id, {
    title: title || 'Test Notification',
    body: message || 'This is a test notification from Cloudtruck',
    data: {
      type: 'test'
    }
  });

  return res.status(200).json(new ApiResponse(200, null, 'Test notification sent'));
});
