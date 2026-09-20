// What a push notification carries, and whether to act on it.
//
// A push's data is the server's flat copy of the in-app notification
// (backend/utils/pushMessages.js pushData). toRoutable rebuilds the shape the
// feed routes from, so a tapped push opens exactly the screen its row in the
// feed opens: destinationFor / hrefFor in notificationFeed.ts decide both.
//
// Pure (no React Native) so it runs under `node --test` (pushRouting.test.mts).

import type { NotificationType } from "../types";

/**
 * A push's own type. Every in-app notification type, plus "ticket_update",
 * which is pushed without a feed row behind it (backend
 * utils/pushMessages.js buildTicketPushMessage).
 */
export type PushType = NotificationType | "ticket_update";

export interface PushData {
  type: PushType;
  notificationId?: string;
  /** The account the push was sent to. */
  recipientId?: string;
  senderId?: string;
  senderUsername?: string;
  senderAvatar?: string;
  conversationId?: string;
  shareId?: string;
  /** type "ticket_update": the ticket to open. */
  ticketId?: string;
}

const TYPES: ReadonlySet<string> = new Set<PushType>(["follow", "message", "share_like", "ticket_update"]);
const FIELDS = ["notificationId", "recipientId", "senderId", "senderUsername", "senderAvatar", "conversationId", "shareId", "ticketId"] as const;

/**
 * A push's data as ours, or null for anything else (another sender, a local
 * notification, a malformed payload). Accepts the data as an object or as
 * the JSON string some Android deliveries hand over.
 */
export function parsePushData(raw: unknown): PushData | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.type !== "string" || !TYPES.has(record.type)) return null;

  const data: PushData = { type: record.type as PushType };
  for (const field of FIELDS) {
    const fieldValue = record[field];
    if (typeof fieldValue === "string" && fieldValue.length > 0) data[field] = fieldValue;
  }
  return data;
}

/**
 * Whether the signed-in account should act on this push. A push addressed to
 * a different account (one signed in on this device before) is ignored rather
 * than opening someone else's chat.
 */
export function isForViewer(data: PushData, viewerId: string | null | undefined): viewerId is string {
  return Boolean(viewerId) && (!data.recipientId || data.recipientId === viewerId);
}

/**
 * The in-app notification's routing shape, for destinationFor. Only for a
 * push that has a feed row behind it — "ticket_update" doesn't, and opens
 * its ticket directly (src/hooks/usePushNotifications.ts).
 */
export function toRoutable(data: PushData & { type: NotificationType }) {
  return {
    type: data.type,
    sender: data.senderId
      ? { _id: data.senderId, username: data.senderUsername, profile_pic_url: data.senderAvatar ?? null }
      : null,
    share: data.shareId ? { shareId: data.shareId } : null,
  };
}

export interface ActiveChat {
  conversationId: string | null;
  /** The other person, when the chat was opened from them rather than a conversation. */
  participantId: string | null;
}

/** Whether a push is a message in the chat already on screen, which needs no banner. */
export function isForActiveChat(data: PushData, active: ActiveChat | null): boolean {
  if (data.type !== "message" || !active) return false;
  if (data.conversationId && active.conversationId === data.conversationId) return true;
  return Boolean(data.senderId) && active.participantId === data.senderId;
}
