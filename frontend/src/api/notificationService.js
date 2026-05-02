import API from './axios';

/**
 * Notification Service
 * Handles all notification-related API calls
 */

export const notificationService = {
  /**
   * Get all notifications with pagination
   */
  getNotifications: async (page = 1, limit = 20) => {
    try {
      const response = await API.get(`/notifications?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch notifications' };
    }
  },

  /**
   * Get unread notification count
   */
  getUnreadCount: async () => {
    try {
      const response = await API.get(`/notifications/unread/count`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch unread count' };
    }
  },

  /**
   * Get unread message counts per conversation
   */
  getUnreadMessageCounts: async () => {
    try {
      const response = await API.get(`/notifications/messages/unread`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch message unread counts' };
    }
  },

  /**
   * Mark single notification as read
   */
  markAsRead: async (notificationId) => {
    try {
      const response = await API.patch(`/notifications/${notificationId}/read`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to mark notification as read' };
    }
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async () => {
    try {
      const response = await API.patch(`/notifications/mark-all-read`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to mark all as read' };
    }
  },

  /**
   * Delete single notification
   */
  deleteNotification: async (notificationId) => {
    try {
      const response = await API.delete(`/notifications/${notificationId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to delete notification' };
    }
  },

  /**
   * Clear all notifications
   */
  clearAll: async () => {
    try {
      const response = await API.delete(`/notifications`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to clear notifications' };
    }
  }
};

// Legacy exports for backward compatibility
export const getNotifications = notificationService.getNotifications;
export const getUnreadNotificationCount = notificationService.getUnreadCount;
export const markAsRead = notificationService.markAsRead;

export default notificationService;
