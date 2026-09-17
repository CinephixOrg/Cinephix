// The notification page's rules: where each notification leads, what it
// says, how the list is grouped, how times read, and how pages merge.
//
// Pure and React-free so it runs under `node --test` (notificationFeed.test.mts).

import type { Notification, NotificationType } from "../types";

// ---------------------------------------------------------------------------
// Where a tap goes
// ---------------------------------------------------------------------------

export type NotificationDestination =
  | { kind: "profile"; userId: string }
  // The sender's name and picture ride along so the chat's header shows who
  // it is from the first frame, while the conversation is still loading.
  | { kind: "chat"; userId: string; username?: string; avatar?: string }
  | { kind: "share"; authorId: string; shareId: string }
  | { kind: "none" };

type Routable = {
  type: NotificationType;
  sender?: { _id?: string; username?: string; profile_pic_url?: string | null } | null;
  share?: { shareId?: string } | null;
};

/** A route plus its params, as router.push takes it. */
export type NotificationHref = { pathname: string; params: Record<string, string> };

/**
 *   follow      they followed you        -> their profile
 *   message     they messaged you        -> the chat with them
 *   share_like  people liked your share  -> that share
 *
 * A message opens the chat nested under the sender's profile (user/[id]/chat),
 * which finds the conversation from the person. That keeps Back returning to
 * Notifications — the Socials tab's copy of the chat sat in a different stack
 * and sent Back to Socials — and works even for a notification with no
 * conversation id.
 *
 * A liked share is always the viewer's own, so it opens in the viewer's
 * profile stack (user/[viewerId]/shares/[shareId]): the card's links — a
 * title, a list — then open in that stack too, and Back returns to
 * Notifications.
 */
export function destinationFor(notification: Routable, viewerId: string): NotificationDestination {
  switch (notification.type) {
    case "follow":
      return notification.sender?._id ? { kind: "profile", userId: notification.sender._id } : { kind: "none" };
    case "message": {
      const sender = notification.sender;
      if (!sender?._id) return { kind: "none" };
      return {
        kind: "chat",
        userId: sender._id,
        ...(sender.username ? { username: sender.username } : {}),
        ...(sender.profile_pic_url ? { avatar: sender.profile_pic_url } : {}),
      };
    }
    case "share_like":
      return notification.share?.shareId && viewerId
        ? { kind: "share", authorId: viewerId, shareId: notification.share.shareId }
        : { kind: "none" };
    default:
      return { kind: "none" };
  }
}

/** The chat's params are the ones the profile's Message button sends (otherUsername, otherAvatar). */
export function hrefFor(destination: NotificationDestination): NotificationHref | null {
  switch (destination.kind) {
    case "profile":
      return { pathname: "/user/[id]", params: { id: destination.userId } };
    case "chat":
      return {
        pathname: "/user/[id]/chat",
        params: {
          id: destination.userId,
          ...(destination.username ? { otherUsername: destination.username } : {}),
          ...(destination.avatar ? { otherAvatar: destination.avatar } : {}),
        },
      };
    case "share":
      return { pathname: "/user/[id]/shares/[shareId]", params: { id: destination.authorId, shareId: destination.shareId } };
    case "none":
      return null;
  }
}

// ---------------------------------------------------------------------------
// What a notification says
// ---------------------------------------------------------------------------

export interface NotificationCopy {
  /** i18n key. */
  phrase: string;
  count?: number;
  /** Whether the sentence follows the sender's name ("ana liked your share") or stands alone ("10 users liked your share"). */
  afterSender: boolean;
  /** The start of the message, for a message notification that has text. */
  preview?: string;
}

const MESSAGE_PHRASE: Record<string, string> = {
  text: "sent you a message",
  recommendation: "sent you a recommendation",
  analysis_share: "shared an analysis with you",
  profile_share: "shared a profile with you",
  list_share: "shared a list with you",
};

export function copyFor(notification: Pick<Notification, "type" | "message" | "share">): NotificationCopy {
  switch (notification.type) {
    case "follow":
      return { phrase: "started following you", afterSender: true };
    case "message": {
      const phrase = MESSAGE_PHRASE[notification.message?.kind ?? "text"] ?? MESSAGE_PHRASE.text;
      const preview = notification.message?.preview?.trim();
      return preview ? { phrase, afterSender: true, preview } : { phrase, afterSender: true };
    }
    case "share_like": {
      const count = notification.share?.likerCount ?? 1;
      return count > 1
        ? { phrase: "{{count}} users liked your share", count, afterSender: false }
        : { phrase: "liked your share", afterSender: true };
    }
    default:
      return { phrase: "New notification", afterSender: false };
  }
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export type FeedSection = "today" | "yesterday" | "week" | "earlier";

/** i18n keys. */
export const SECTION_LABEL: Record<FeedSection, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This week",
  earlier: "Earlier",
};

/** Calendar days in the device's time zone, so "Yesterday" means yesterday, not "24 to 48 hours ago". */
export function sectionFor(createdAt: string, now: Date): FeedSection {
  const time = new Date(createdAt).getTime();
  const startOf = (daysAgo: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo).getTime();
  if (time >= startOf(0)) return "today";
  if (time >= startOf(1)) return "yesterday";
  if (time >= startOf(6)) return "week";
  return "earlier";
}

export type FeedRow =
  | { kind: "header"; key: string; section: FeedSection }
  | { kind: "item"; key: string; item: Notification };

/** Rows for the list: each section's header, then its notifications. Expects newest-first items. */
export function buildRows(items: readonly Notification[], now: Date): FeedRow[] {
  const rows: FeedRow[] = [];
  let current: FeedSection | null = null;
  for (const item of items) {
    const section = sectionFor(item.createdAt, now);
    if (section !== current) {
      rows.push({ kind: "header", key: `header:${section}`, section });
      current = section;
    }
    rows.push({ kind: "item", key: item._id, item });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Relative time
// ---------------------------------------------------------------------------

export type RelativeTime = { kind: "relative"; key: string; count?: number } | { kind: "date" };

/** "Just now", "5m", "3h", "2d" (as i18n keys), or a plain date past a week. */
export function relativeTime(createdAt: string, now: Date): RelativeTime {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / 1000));
  if (seconds < 60) return { kind: "relative", key: "Just now" };
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return { kind: "relative", key: "{{count}}m", count: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { kind: "relative", key: "{{count}}h", count: hours };
  const days = Math.floor(hours / 24);
  if (days < 7) return { kind: "relative", key: "{{count}}d", count: days };
  return { kind: "date" };
}

// ---------------------------------------------------------------------------
// Pages and optimistic updates
// ---------------------------------------------------------------------------

// Notification ids are ObjectIds: equal-length lowercase hex, so string order
// is creation order.
const newerFirst = (a: Notification, b: Notification) => (a._id < b._id ? 1 : a._id > b._id ? -1 : 0);

/**
 * A refreshed first page over a list that may already hold older pages.
 *
 * When the fresh page is the whole feed, it replaces the list outright. When
 * more remain, the older notifications already loaded below the fresh page
 * are kept, so pulling to refresh deep in the list doesn't throw away what's
 * been scrolled through.
 */
export function mergeNewestPage(existing: readonly Notification[], fresh: readonly Notification[], freshHasMore: boolean): Notification[] {
  if (!freshHasMore || fresh.length === 0) return [...fresh];
  const oldestFresh = fresh[fresh.length - 1]._id;
  const freshIds = new Set(fresh.map((item) => item._id));
  return [...fresh, ...existing.filter((item) => item._id < oldestFresh && !freshIds.has(item._id))];
}

/** Appends an older page, skipping anything already present. */
export function appendPage(existing: readonly Notification[], older: readonly Notification[]): Notification[] {
  const ids = new Set(existing.map((item) => item._id));
  return [...existing, ...older.filter((item) => !ids.has(item._id))];
}

export function removeById(items: readonly Notification[], id: string): Notification[] {
  return items.filter((item) => item._id !== id);
}

/** Puts a notification back in its place — undoing an optimistic removal that failed. */
export function insertById(items: readonly Notification[], item: Notification): Notification[] {
  if (items.some((existing) => existing._id === item._id)) return [...items];
  return [...items, item].sort(newerFirst);
}

/** Marks one read, keeping every other item — and the array, when nothing changes — as it was. */
export function markReadById(items: Notification[], id: string): Notification[] {
  const index = items.findIndex((item) => item._id === id);
  if (index === -1 || items[index].read) return items;
  const next = items.slice();
  next[index] = { ...items[index], read: true };
  return next;
}

export function markAllReadIn(items: Notification[]): Notification[] {
  return items.some((item) => !item.read) ? items.map((item) => (item.read ? item : { ...item, read: true })) : items;
}
