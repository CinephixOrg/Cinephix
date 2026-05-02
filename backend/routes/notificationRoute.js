import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  getNotifications,
  getUnreadCount,
  getUnreadMessageCounts,
  markNotificationAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications
} from '../controllers/notificationController.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// GET all notifications with pagination
router.get('/', getNotifications);

// GET unread notification count
router.get('/unread/count', getUnreadCount);

// GET unread message counts per conversation
router.get('/messages/unread', getUnreadMessageCounts);

// PATCH mark single notification as read
router.patch('/:id/read', markNotificationAsRead);

// PATCH mark all notifications as read
router.patch('/mark-all-read', markAllAsRead);

// DELETE single notification
router.delete('/:id', deleteNotification);

// DELETE all notifications
router.delete('/', clearAllNotifications);

export default router;
