import NotificationService from '../services/notification.service.js';
import Notification from '../models/notification.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';

/**
 * Get notifications for authenticated user
 */
export const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 20, status } = req.query;

  const pageNum = Math.max(parseInt(page), 1);
  const limitNum = Math.min(Math.max(parseInt(limit), 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const filter = { user: userId, isDeleted: false };
  if (status === 'read') filter.readAt = { $ne: null };
  else if (status === 'unread') filter.readAt = null;

  const [items, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    Notification.countDocuments(filter)
  ]);

  return res.status(200).json(new ApiResponse(200, {
    items,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
  }, 'Notifications fetched successfully'));
});

/**
 * Get unread notification count
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.getUnreadCount(req.user._id);

  return res.status(200).json(new ApiResponse(200, { count }, 'Unread count fetched'));
});

/**
 * Mark a single notification as read
 */
export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification || notification.isDeleted || notification.user.toString() !== req.user._id.toString()) {
    throw new ApiError(404, 'Notification not found');
  }

  await notification.markAsRead();

  return res.status(200).json(new ApiResponse(200, { notificationId: notification._id }, 'Notification marked as read'));
});

/**
 * Mark all notifications as read
 */
export const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { user: req.user._id, isDeleted: false, readAt: null },
    { $set: { readAt: new Date(), status: 'read' } }
  );

  return res.status(200).json(new ApiResponse(200, { count: result.modifiedCount }, 'All notifications marked as read'));
});

/**
 * Soft-delete a notification
 */
export const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification || notification.isDeleted || notification.user.toString() !== req.user._id.toString()) {
    throw new ApiError(404, 'Notification not found');
  }

  await notification.softDelete();

  return res.status(200).json(new ApiResponse(200, null, 'Notification deleted'));
});

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
