import { Expo } from "expo-server-sdk";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import {
  buildPushMessage,
  buildTicketPushMessage,
  createCooldown,
  isExpoPushToken,
  readReceipts,
  readTickets,
  registerTokenPipeline,
} from "../utils/pushMessages.js";

// Device push notifications, sent through Expo's push service.
//
// services/notifications.js calls pushNotification for every in-app
// notification it saves. Delivery runs in the background: a slow or failing
// push never holds up (or fails) the request that caused it.
//
// Environment:
//   EXPO_ACCESS_TOKEN   only if "Enhanced push security" is on for the Expo project
//   PUSH_NOTIFICATIONS  "off" to disable sending entirely (e.g. local development)

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN || undefined });

const isEnabled = () => process.env.PUSH_NOTIFICATIONS !== "off";

// Share likes push at most once per share every five minutes (see createCooldown).
const shareLikeCooldown = createCooldown(5 * 60 * 1000);

// Deliveries still running, so a script can wait for them before it exits.
const inFlight = new Set();

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/**
 * Records a device on an account. A device belongs to one account at a time:
 * signing in as someone else on the same phone moves the token over, so the
 * previous account's notifications stop arriving there.
 */
export async function savePushToken(userId, registration) {
  await User.updateMany(
    { _id: { $ne: userId }, "pushTokens.token": registration.token },
    { $pull: { pushTokens: { token: registration.token } } }
  );
  await User.updateOne({ _id: userId }, registerTokenPipeline(registration));
}

export async function removePushToken(userId, token) {
  await User.updateOne({ _id: userId }, { $pull: { pushTokens: { token } } });
}

async function removeDeadTokens(tokens) {
  if (tokens.length === 0) return;
  await User.updateMany({ "pushTokens.token": { $in: tokens } }, { $pull: { pushTokens: { token: { $in: tokens } } } });
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/** Sends a saved notification to its recipient's devices, in the background. */
export function pushNotification(notification) {
  if (!isEnabled() || !notification) return;
  const delivery = deliver(notification)
    .catch((error) => console.error("Push delivery failed:", error?.message || error))
    .finally(() => inFlight.delete(delivery));
  inFlight.add(delivery);
}

/**
 * Tells someone their support ticket moved on: a moderator answered it, or
 * changed its status (controllers/ticketController.js). Background, like
 * every other push — answering a ticket never waits on Expo.
 */
export function pushTicketUpdate(ticket, { replied, statusChanged }) {
  if (!isEnabled() || !ticket || (!replied && !statusChanged)) return;
  const delivery = deliverTicket(ticket, { replied, statusChanged })
    .catch((error) => console.error("Ticket push failed:", error?.message || error))
    .finally(() => inFlight.delete(delivery));
  inFlight.add(delivery);
}

async function deliverTicket(ticket, { replied, statusChanged }) {
  const devices = await devicesOf(ticket.userId);
  if (devices.length === 0) return;
  const badge = await Notification.countDocuments({ user: ticket.userId, read: false });
  const messages = [];
  const tokens = [];
  for (const device of devices) {
    const message = buildTicketPushMessage({ ticket, token: device.token, locale: device.locale, badge, replied, statusChanged });
    if (!message) return;
    messages.push(message);
    tokens.push(device.token);
  }
  await send(messages, tokens);
}

/**
 * The account's push-capable devices. Tokens are hidden from every Mongoose
 * query (select: false on the model); this is the one place that reads them,
 * and only them.
 */
async function devicesOf(userId) {
  const account = await User.collection.findOne({ _id: userId }, { projection: { pushTokens: 1 } });
  return (account?.pushTokens || []).filter((device) => isExpoPushToken(device.token));
}

/** Resolves once every push started so far has been handed to Expo. For scripts. */
export async function flushPushDeliveries() {
  await Promise.allSettled([...inFlight]);
}

async function deliver(notification) {
  if (notification.type === "share_like" && !shareLikeCooldown.tryAcquire(`${notification.user}:${notification.share?.shareId}`)) {
    return;
  }

  const [devices, sender] = await Promise.all([
    devicesOf(notification.user),
    User.findById(notification.sender).select("username profile_pic_url").lean(),
  ]);
  if (devices.length === 0 || !sender) return;

  const badge = await Notification.countDocuments({ user: notification.user, read: false });
  const messages = [];
  const tokens = [];
  for (const device of devices) {
    const message = buildPushMessage({ notification, sender, token: device.token, locale: device.locale, badge });
    if (!message) return;
    messages.push(message);
    tokens.push(device.token);
  }

  await send(messages, tokens);
}

/** Hands a batch to Expo, in its chunks, and retires whatever it rejects. */
async function send(messages, tokens) {
  let offset = 0;
  for (const chunk of expo.chunkPushNotifications(messages)) {
    const chunkTokens = tokens.slice(offset, offset + chunk.length);
    offset += chunk.length;
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    const { receipts, deadTokens, errors } = readTickets(tickets, chunkTokens);
    if (errors.length > 0) console.warn("Push tickets reported errors:", errors.join(", "));
    await removeDeadTokens(deadTokens);
    queueReceipts(receipts);
  }
}

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------
//
// A ticket only means Expo accepted the push. Whether Apple or Google
// delivered it is known from its receipt, available some minutes later; a
// receipt saying the app is no longer on the device retires that token.
// Pending receipts live in memory: after a restart they're skipped, and a
// dead token is then caught by the next push's ticket instead.

const RECEIPT_DELAY_MS = 15 * 60 * 1000;
const RECEIPT_CHECK_INTERVAL_MS = 60 * 1000;
const MAX_PENDING_RECEIPTS = 20000;

const pendingReceipts = [];
let receiptTimer = null;

function queueReceipts(receipts) {
  if (receipts.length === 0) return;
  const dueAt = Date.now() + RECEIPT_DELAY_MS;
  for (const receipt of receipts) {
    if (pendingReceipts.length >= MAX_PENDING_RECEIPTS) break;
    pendingReceipts.push({ ...receipt, dueAt });
  }
  if (!receiptTimer) {
    receiptTimer = setInterval(() => {
      checkReceipts().catch((error) => console.error("Push receipt check failed:", error?.message || error));
    }, RECEIPT_CHECK_INTERVAL_MS);
    // Never keeps the process alive on its own.
    receiptTimer.unref?.();
  }
}

async function checkReceipts() {
  const now = Date.now();
  const due = [];
  while (pendingReceipts.length > 0 && pendingReceipts[0].dueAt <= now) due.push(pendingReceipts.shift());
  if (pendingReceipts.length === 0 && receiptTimer) {
    clearInterval(receiptTimer);
    receiptTimer = null;
  }
  if (due.length === 0) return;

  const tokenByReceiptId = new Map(due.map((receipt) => [receipt.id, receipt.token]));
  for (const ids of expo.chunkPushNotificationReceiptIds([...tokenByReceiptId.keys()])) {
    const receipts = await expo.getPushNotificationReceiptsAsync(ids);
    const { deadTokens, errors } = readReceipts(receipts, tokenByReceiptId);
    if (errors.length > 0) console.warn("Push receipts reported errors:", errors.join(", "));
    await removeDeadTokens(deadTokens);
  }
}
