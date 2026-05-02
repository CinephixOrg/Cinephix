import React, { createContext, useState, useEffect, useCallback, useContext } from "react";
import API from "../api/axios.js";
import { AuthContext } from "./AuthContext.jsx";

export const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messageUnreadCounts, setMessageUnreadCounts] = useState({});
  const [loading, setLoading] = useState(false);

  // Fetch all notifications
  const fetchNotifications = useCallback(async (page = 1) => {
    if (!user) return;
    try {
      const res = await API.get(`/notifications?page=${page}&limit=20`);
      setNotifications(res.data);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  }, [user]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await API.get(`/notifications/unread/count`);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      console.error("Failed to fetch unread count:", err);
    }
  }, [user]);

  // Fetch message unread counts per conversation
  const fetchMessageUnreadCounts = useCallback(async () => {
    if (!user) return;
    try {
      const res = await API.get(`/notifications/messages/unread`);
      setMessageUnreadCounts(res.data || {});
    } catch (err) {
      console.error("Failed to fetch message unread counts:", err);
    }
  }, [user]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await API.patch(`/notifications/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await API.patch(`/notifications/mark-all-read`);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      await API.delete(`/notifications/${notificationId}`);
      setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  }, []);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    try {
      await API.delete(`/notifications`);
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to clear notifications:", err);
    }
  }, []);

  // Increment unread message count for conversation
  const incrementMessageUnread = useCallback((conversationId) => {
    setMessageUnreadCounts((prev) => ({
      ...prev,
      [conversationId]: (prev[conversationId] || 0) + 1
    }));
  }, []);

  // Set message unread count to 0 for conversation (mark as read)
  const clearConversationUnread = useCallback((conversationId) => {
    setMessageUnreadCounts((prev) => ({
      ...prev,
      [conversationId]: 0
    }));
  }, []);

  // Initial load
  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchUnreadCount();
      fetchMessageUnreadCounts();
    }
  }, [user, fetchNotifications, fetchUnreadCount, fetchMessageUnreadCounts]);

  const value = {
    notifications,
    unreadCount,
    messageUnreadCounts,
    loading,
    fetchNotifications,
    fetchUnreadCount,
    fetchMessageUnreadCounts,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    incrementMessageUnread,
    clearConversationUnread
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
