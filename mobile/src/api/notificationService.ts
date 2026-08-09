import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ListResult } from "./contentService";
import type { Notification } from "../types";

export async function getNotifications(page = 1, limit = 20): Promise<ListResult<Notification>> {
  const res = await API.get(API_ROUTES.NOTIFICATIONS.GET_ALL, { params: { page, limit } });
  return { items: res.data, pagination: (res as any).pagination };
}

export async function getUnreadCount(): Promise<number> {
  const res = await API.get(API_ROUTES.NOTIFICATIONS.UNREAD_COUNT);
  return res.data?.unreadCount || 0;
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const res = await API.patch(API_ROUTES.NOTIFICATIONS.MARK_READ(id));
  return res.data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await API.patch(API_ROUTES.NOTIFICATIONS.MARK_ALL_READ);
}

export async function deleteNotification(id: string): Promise<void> {
  await API.delete(API_ROUTES.NOTIFICATIONS.DELETE(id));
}

export async function clearAllNotifications(): Promise<void> {
  await API.delete(API_ROUTES.NOTIFICATIONS.CLEAR_ALL);
}
