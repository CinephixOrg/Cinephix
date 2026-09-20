// Push notifications, from a saved in-app notification to what Expo is sent.
//
// Everything here is pure, so it's unit-tested (pushMessages.test.js);
// services/push.js does the database work and the sending.

import { pushPhrase } from "./pushCopy.js";

/** Devices kept per account; registering one more drops the one seen longest ago. */
export const MAX_PUSH_TOKENS = 10;

// The same shape expo-server-sdk's Expo.isExpoPushToken accepts for Expo tokens.
const EXPO_PUSH_TOKEN = /^Expo(nent)?PushToken\[[^\]\s]+\]$/;

export function isExpoPushToken(token) {
  return typeof token === "string" && token.length <= 200 && EXPO_PUSH_TOKEN.test(token);
}

const PLATFORMS = new Set(["ios", "android"]);
const LOCALE = /^[a-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$/;

/**
 * A device registration from a request body, or null when there's no valid
 * token. Only fields that are present and well-formed are kept.
 */
export function parseRegistration(body) {
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!isExpoPushToken(token)) return null;
  const registration = { token };
  if (PLATFORMS.has(body.platform)) registration.platform = body.platform;
  if (typeof body.locale === "string" && LOCALE.test(body.locale)) registration.locale = body.locale;
  if (typeof body.deviceName === "string" && body.deviceName.trim()) registration.deviceName = body.deviceName.trim().slice(0, 80);
  return registration;
}

/**
 * The update that records a device on its account, as a single atomic
 * pipeline: the device goes first (replacing any older entry for the same
 * token), and the list is cut to MAX_PUSH_TOKENS, so the devices dropped are
 * the ones not seen for the longest.
 */
export function registerTokenPipeline(registration, now = new Date(), max = MAX_PUSH_TOKENS) {
  const entry = { ...registration, lastSeenAt: now };
  return [
    {
      $set: {
        pushTokens: {
          $slice: [
            {
              $concatArrays: [
                [{ $literal: entry }],
                {
                  $filter: {
                    input: { $ifNull: ["$pushTokens", []] },
                    as: "device",
                    cond: { $ne: ["$$device.token", registration.token] },
                  },
                },
              ],
            },
            max,
          ],
        },
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const MESSAGE_PHRASE = {
  text: "sent you a message",
  recommendation: "sent you a recommendation",
  analysis_share: "shared an analysis with you",
  profile_share: "shared a profile with you",
  list_share: "shared a list with you",
};

/** Android channels, created by the app (mobile/src/push/registration.ts). */
export const PUSH_CHANNELS = { messages: "messages", activity: "activity" };

const id = (value) => (value == null ? undefined : String(value?._id ?? value));

/**
 * The data a tapped push is routed from. Flat strings only, so it survives
 * every platform's payload encoding unchanged; the app rebuilds the in-app
 * notification's shape from it and routes it with the feed's own rules
 * (mobile/src/utils/pushRouting.ts).
 */
export function pushData(notification, sender) {
  const data = {
    notificationId: id(notification._id),
    recipientId: id(notification.user),
    type: notification.type,
    senderId: id(sender?._id ?? notification.sender),
    senderUsername: sender?.username,
    senderAvatar: sender?.profile_pic_url || undefined,
    conversationId: notification.type === "message" ? id(notification.conversationId) : undefined,
    shareId: notification.type === "share_like" ? id(notification.share?.shareId) : undefined,
  };
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== ""));
}

/**
 * One device's push for a notification, in that device's language, or null
 * for a type that isn't pushed.
 *
 *   follow      "ana started following you"
 *   message     title "ana", body the message's own words, or what they sent
 *   share_like  "ana liked your share" / "10 users liked your share"
 *
 * `badge` is the recipient's unread count, for the app icon.
 */
export function buildPushMessage({ notification, sender, token, locale, badge }) {
  const name = sender?.username || "Cinephix";
  const message = { to: token, sound: "default", priority: "high", data: pushData(notification, sender) };

  switch (notification.type) {
    case "follow":
      Object.assign(message, { body: `${name} ${pushPhrase(locale, "started following you")}`, channelId: PUSH_CHANNELS.activity });
      break;
    case "message": {
      const preview = notification.message?.preview?.trim();
      const phrase = MESSAGE_PHRASE[notification.message?.kind] ?? MESSAGE_PHRASE.text;
      Object.assign(message, {
        title: name,
        body: preview || `${name} ${pushPhrase(locale, phrase)}`,
        channelId: PUSH_CHANNELS.messages,
      });
      // One conversation's messages stack together on iOS.
      if (message.data.conversationId) message.threadId = `conversation-${message.data.conversationId}`;
      break;
    }
    case "share_like": {
      const count = notification.share?.likerCount ?? 1;
      Object.assign(message, {
        body: count > 1 ? pushPhrase(locale, "{{count}} users liked your share", { count }) : `${name} ${pushPhrase(locale, "liked your share")}`,
        channelId: PUSH_CHANNELS.activity,
      });
      // A newer push about the same share replaces the older one in the tray,
      // the way the in-app notification is replaced.
      if (message.data.shareId) {
        message.tag = `share-like-${message.data.shareId}`;
        message.collapseId = message.tag;
      }
      break;
    }
    default:
      return null;
  }

  if (Number.isInteger(badge) && badge >= 0) message.badge = badge;
  return message;
}

const TICKET_STATUS_PHRASE = {
  Open: "Your ticket was reopened",
  "In Progress": "Your ticket is in progress",
  Resolved: "Your ticket has been resolved",
  Closed: "Your ticket has been closed",
};

/**
 * One device's push about a support ticket, in that device's language: the
 * new status, or that support has answered. `changed` says which of the two
 * happened — both at once reads as the answer, since that's what the person
 * will want to open.
 *
 * Its data carries the ticket's id, so tapping it opens that ticket
 * (mobile/src/utils/pushRouting.ts).
 */
export function buildTicketPushMessage({ ticket, token, locale, badge, replied, statusChanged }) {
  const phrase = replied ? "Support replied to your ticket" : statusChanged ? TICKET_STATUS_PHRASE[ticket.status] : null;
  if (!phrase) return null;
  const message = {
    to: token,
    sound: "default",
    priority: "high",
    title: pushPhrase(locale, "Cinephix Support"),
    body: `${pushPhrase(locale, phrase)}: ${ticket.title}`,
    channelId: PUSH_CHANNELS.activity,
    data: {
      type: "ticket_update",
      ticketId: id(ticket._id),
      recipientId: id(ticket.userId),
    },
    // A newer update about the same ticket replaces the older one in the tray.
    tag: `ticket-${id(ticket._id)}`,
  };
  message.collapseId = message.tag;
  if (Number.isInteger(badge) && badge >= 0) message.badge = badge;
  return message;
}

// ---------------------------------------------------------------------------
// Tickets and receipts
// ---------------------------------------------------------------------------

/**
 * What the send response says, ticket by ticket (tickets come back in the
 * order the messages were sent): receipts to check later, and tokens Expo
 * already knows are dead.
 */
export function readTickets(tickets, tokens) {
  const receipts = [];
  const deadTokens = new Set();
  const errors = [];
  (tickets || []).forEach((ticket, index) => {
    const token = tokens[index];
    if (!ticket || !token) return;
    if (ticket.status === "ok" && ticket.id) {
      receipts.push({ id: ticket.id, token });
    } else if (ticket.status === "error") {
      if (ticket.details?.error === "DeviceNotRegistered") deadTokens.add(ticket.details.expoPushToken || token);
      else errors.push(ticket.details?.error || ticket.message || "unknown");
    }
  });
  return { receipts, deadTokens: [...deadTokens], errors };
}

/** Tokens whose delivery receipts say the app is gone from the device (uninstalled, or notifications reset). */
export function readReceipts(receiptsById, tokenByReceiptId) {
  const deadTokens = new Set();
  const errors = [];
  for (const [receiptId, receipt] of Object.entries(receiptsById || {})) {
    if (receipt?.status !== "error") continue;
    if (receipt.details?.error === "DeviceNotRegistered") {
      const token = receipt.details.expoPushToken || tokenByReceiptId.get(receiptId);
      if (token) deadTokens.add(token);
    } else {
      errors.push(receipt.details?.error || receipt.message || "unknown");
    }
  }
  return { deadTokens: [...deadTokens], errors };
}

/**
 * At most one pass per key per window. Keeps a popular share's likes from
 * buzzing its author's phone once per like: the first like pushes at once,
 * and the next push after the window carries the running count.
 */
export function createCooldown(windowMs, now = Date.now) {
  const until = new Map();
  return {
    tryAcquire(key) {
      const time = now();
      if (until.size > 5000) {
        for (const [k, expires] of until) if (expires <= time) until.delete(k);
      }
      const expires = until.get(key);
      if (expires !== undefined && expires > time) return false;
      until.set(key, time + windowMs);
      return true;
    },
  };
}
