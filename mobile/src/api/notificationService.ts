import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { Notification } from "../types";

export interface NotificationPage {
  items: Notification[];
  hasMore: boolean;
  /** The id to pass as `before` for the next page. */
  nextCursor: string | null;
  /** Unread notifications in total, not just on this page. */
  unreadCount: number;
}

// Cursor pages, newest first: each page continues strictly before the last
// id received, so deleting while scrolling can't skip or repeat anything.
export async function getNotificationPage({
  before = null,
  unreadOnly = false,
  limit = 20,
}: { before?: string | null; unreadOnly?: boolean; limit?: number } = {}): Promise<NotificationPage> {
  const res = await API.get(API_ROUTES.NOTIFICATIONS.GET_ALL, {
    params: { cursor: 1, limit, ...(before ? { before } : {}), ...(unreadOnly ? { unread: 1 } : {}) },
  });
  return res.data;
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
