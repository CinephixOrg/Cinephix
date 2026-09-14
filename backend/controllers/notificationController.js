import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/response.js';
import { buildFeedFilter, parseFeedQuery, shapeCursorPage } from '../utils/notificationFeed.js';

const SENDER_FIELDS = 'username profile_pic_url';

/**
 * @desc    Notifications for the current user, newest first
 * @route   GET /api/notifications
 *            ?cursor=1[&before=<id>]  cursor pages (the app): { items, hasMore, nextCursor, unreadCount }
 *            ?page=N                  numbered pages (the web client), paginated envelope
 *            &unread=1                unread only; &limit=N (max 50)
 * @access  Private
 */
export const getNotifications = asyncHandler(async (req, res) => {
  const { limit, before, cursor, unreadOnly, page } = parseFeedQuery(req.query);
  const userId = req.user.id;

  if (cursor) {
    // The unread total rides along so the app's badge is exact the moment
    // the list loads, instead of waiting for its next background poll.
    const [docs, unreadCount] = await Promise.all([
      Notification.find(buildFeedFilter(userId, { before, unreadOnly }))
        .sort({ _id: -1 })
        .limit(limit + 1)
        .populate('sender', SENDER_FIELDS)
        .lean(),
      Notification.countDocuments({ user: userId, read: false }),
    ]);
    return sendSuccess(res, { ...shapeCursorPage(docs, limit), unreadCount }, 'Notifications fetched', 200);
  }

  const filter = buildFeedFilter(userId, { unreadOnly });
  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('sender', SENDER_FIELDS)
      .lean(),
    Notification.countDocuments(filter),
  ]);

  // Rows whose sender account is gone have no one to show; see shapeCursorPage.
  sendPaginated(res, notifications.filter((n) => n.sender), total, page, limit, 'Notifications fetched');
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
  if (!mongoose.isValidObjectId(req.params.id)) {
    return sendError(res, 'Notification not found', 404);
  }

  // Scoped to the caller inside the update itself. This used to update first
  // and check ownership afterwards, so anyone could mark anyone's
  // notification read — the 403 arrived after the write.
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { read: true },
    { new: true }
  )
    .populate('sender', SENDER_FIELDS)
    .lean();

  if (!notification) {
    return sendError(res, 'Notification not found', 404);
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
  if (!mongoose.isValidObjectId(req.params.id)) {
    return sendError(res, 'Notification not found', 404);
  }

  // One scoped query; someone else's notification reads as not found.
  const { deletedCount } = await Notification.deleteOne({ _id: req.params.id, user: req.user.id });
  if (!deletedCount) {
    return sendError(res, 'Notification not found', 404);
  }

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
