import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/response.js';

/**
 * @desc    Get all notifications for current user (with pagination)
 * @route   GET /api/notifications
 * @access  Private
 */
export const getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const notifications = await Notification.find({ user: req.user.id })
    .populate('sender', 'username profile_pic_url')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip)
    .lean();

  const total = await Notification.countDocuments({ user: req.user.id });

  sendPaginated(
    res,
    notifications,
    total,
    parseInt(page),
    parseInt(limit),
    'Notifications fetched'
  );
});

/**
 * @desc    Get unread notification count for current user
 * @route   GET /api/notifications/unread/count
 * @access  Private
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({
    user: req.user.id,
    read: false
  });

  sendSuccess(res, { unreadCount: count }, 'Unread count fetched', 200);
});

/**
 * @desc    Get unread message count per conversation
 * @route   GET /api/notifications/messages/unread
 * @access  Private
 */
export const getUnreadMessageCounts = asyncHandler(async (req, res) => {
  // Get all unread message notifications grouped by conversation
  const unreadMessages = await Notification.find({
    user: req.user.id,
    type: 'message',
    read: false
  })
    .select('conversationId')
    .lean();

  // Count per conversation
  const countByConversation = {};
  unreadMessages.forEach((notif) => {
    if (notif.conversationId) {
      const convId = notif.conversationId.toString();
      countByConversation[convId] = (countByConversation[convId] || 0) + 1;
    }
  });

  sendSuccess(res, countByConversation, 'Message unread counts fetched', 200);
});

/**
 * @desc    Mark a single notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
export const markNotificationAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findByIdAndUpdate(
    req.params.id,
    { read: true },
    { new: true }
  )
    .populate('sender', 'username profile_pic_url')
    .lean();

  if (!notification) {
    return sendError(res, 'Notification not found', 404);
  }

  if (notification.user.toString() !== req.user.id) {
    return sendError(res, 'Not authorized', 403);
  }

  sendSuccess(res, notification, 'Notification marked as read', 200);
});

/**
 * @desc    Mark all notifications as read
 * @route   PATCH /api/notifications/mark-all-read
 * @access  Private
 */
export const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { user: req.user.id, read: false },
    { read: true }
  );

  sendSuccess(res, null, 'All notifications marked as read', 200);
});

/**
 * @desc    Delete a notification
 * @route   DELETE /api/notifications/:id
 * @access  Private
 */
export const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    return sendError(res, 'Notification not found', 404);
  }

  if (notification.user.toString() !== req.user.id) {
    return sendError(res, 'Not authorized', 403);
  }

  await Notification.findByIdAndDelete(req.params.id);

  sendSuccess(res, null, 'Notification deleted', 200);
});

/**
 * @desc    Clear all notifications for user
 * @route   DELETE /api/notifications
 * @access  Private
 */
export const clearAllNotifications = asyncHandler(async (req, res) => {
  await Notification.deleteMany({ user: req.user.id });

  sendSuccess(res, null, 'All notifications cleared', 200);
});
