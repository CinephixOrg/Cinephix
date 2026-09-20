import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PUSH_TOKENS,
  buildPushMessage,
  buildTicketPushMessage,
  createCooldown,
  isExpoPushToken,
  parseRegistration,
  pushData,
  readReceipts,
  readTickets,
  registerTokenPipeline,
} from "./pushMessages.js";

const TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";
const RECIPIENT = "6a0000000000000000000abc";
const SENDER = { _id: "691f53a845194a18bc31db24", username: "ana", profile_pic_url: "https://img.example/ana.jpg" };
const NOTIFICATION_ID = "6a7f000000000000000000aa";

const notification = (fields) => ({ _id: NOTIFICATION_ID, user: RECIPIENT, sender: SENDER._id, ...fields });

// ---- Tokens ------------------------------------------------------------------

test("only Expo push tokens are accepted", () => {
  assert.equal(isExpoPushToken(TOKEN), true);
  assert.equal(isExpoPushToken("ExpoPushToken[abc123]"), true);
  for (const bad of ["", "abc", "ExponentPushToken[]", "ExponentPushToken[a b]", `ExponentPushToken[${"a".repeat(300)}]`, null, 42]) {
    assert.equal(isExpoPushToken(bad), false, String(bad));
  }
});

test("a registration keeps only well-formed fields", () => {
  assert.deepEqual(parseRegistration({ token: ` ${TOKEN} `, platform: "android", locale: "pt-BR", deviceName: "  Pixel 8  " }), {
    token: TOKEN,
    platform: "android",
    locale: "pt-BR",
    deviceName: "Pixel 8",
  });
  assert.deepEqual(parseRegistration({ token: TOKEN, platform: "windows", locale: "<script>", deviceName: "  " }), { token: TOKEN });
  assert.equal(parseRegistration({ token: "nope" }), null);
  assert.equal(parseRegistration(undefined), null);
});

test("registering puts the device first, replaces its old entry and caps the list", () => {
  const now = new Date("2026-09-14T10:00:00Z");
  const [stage] = registerTokenPipeline({ token: TOKEN, platform: "ios" }, now);
  const [concat, max] = stage.$set.pushTokens.$slice;
  assert.equal(max, MAX_PUSH_TOKENS);
  const [[first], filtered] = concat.$concatArrays;
  assert.deepEqual(first, { $literal: { token: TOKEN, platform: "ios", lastSeenAt: now } });
  assert.deepEqual(filtered.$filter.cond, { $ne: ["$$device.token", TOKEN] });
});

// ---- Messages ------------------------------------------------------------------

test("a follow reads as a sentence in the device's language", () => {
  const push = buildPushMessage({ notification: notification({ type: "follow" }), sender: SENDER, token: TOKEN, locale: "en", badge: 3 });
  assert.equal(push.body, "ana started following you");
  assert.equal(push.title, undefined);
  assert.equal(push.channelId, "activity");
  assert.equal(push.badge, 3);
  assert.equal(push.to, TOKEN);

  const turkish = buildPushMessage({ notification: notification({ type: "follow" }), sender: SENDER, token: TOKEN, locale: "tr" });
  assert.equal(turkish.body, "ana sizi takip etmeye başladı");
  assert.equal(turkish.badge, undefined);
});

test("a message shows who sent it and what they said, grouped by conversation", () => {
  const push = buildPushMessage({
    notification: notification({ type: "message", conversationId: "c1", message: { preview: "Watched Dune yet?", kind: "text" } }),
    sender: SENDER,
    token: TOKEN,
    locale: "en",
  });
  assert.equal(push.title, "ana");
  assert.equal(push.body, "Watched Dune yet?");
  assert.equal(push.channelId, "messages");
  assert.equal(push.threadId, "conversation-c1");
});

test("a message without words says what was sent", () => {
  const push = buildPushMessage({
    notification: notification({ type: "message", conversationId: "c1", message: { preview: "", kind: "recommendation" } }),
    sender: SENDER,
    token: TOKEN,
    locale: "en",
  });
  assert.equal(push.body, "ana sent you a recommendation");
});

test("share likes read singly or as a count, and replace each other in the tray", () => {
  const share = (likerCount) => notification({ type: "share_like", share: { shareId: "s1", likerCount } });
  const single = buildPushMessage({ notification: share(1), sender: SENDER, token: TOKEN, locale: "en" });
  assert.equal(single.body, "ana liked your share");
  const many = buildPushMessage({ notification: share(10), sender: SENDER, token: TOKEN, locale: "en" });
  assert.equal(many.body, "10 users liked your share");
  assert.equal(many.tag, "share-like-s1");
  assert.equal(many.collapseId, "share-like-s1");
});

test("unknown types aren't pushed", () => {
  assert.equal(buildPushMessage({ notification: notification({ type: "follow_request" }), sender: SENDER, token: TOKEN }), null);
});

test("push data is flat strings the app can route from", () => {
  assert.deepEqual(pushData(notification({ type: "message", conversationId: { _id: "c1" } }), SENDER), {
    notificationId: NOTIFICATION_ID,
    recipientId: RECIPIENT,
    type: "message",
    senderId: SENDER._id,
    senderUsername: "ana",
    senderAvatar: SENDER.profile_pic_url,
    conversationId: "c1",
  });
  const like = pushData(notification({ type: "share_like", share: { shareId: "s1" } }), { ...SENDER, profile_pic_url: "" });
  assert.equal(like.shareId, "s1");
  assert.equal("senderAvatar" in like, false);
  assert.equal("conversationId" in like, false);
  for (const value of Object.values(like)) assert.equal(typeof value, "string");
});

// ---- Tickets and receipts ------------------------------------------------------

test("tickets give receipts to check and tokens already known dead", () => {
  const tokens = ["ExpoPushToken[a]", "ExpoPushToken[b]", "ExpoPushToken[c]"];
  const result = readTickets(
    [
      { status: "ok", id: "r1" },
      { status: "error", message: "gone", details: { error: "DeviceNotRegistered", expoPushToken: "ExpoPushToken[b]" } },
      { status: "error", message: "too big", details: { error: "MessageTooBig" } },
    ],
    tokens
  );
  assert.deepEqual(result.receipts, [{ id: "r1", token: "ExpoPushToken[a]" }]);
  assert.deepEqual(result.deadTokens, ["ExpoPushToken[b]"]);
  assert.deepEqual(result.errors, ["MessageTooBig"]);
});

test("receipts name tokens for apps no longer on the device", () => {
  const tokenByReceiptId = new Map([["r1", "ExpoPushToken[a]"], ["r2", "ExpoPushToken[b]"], ["r3", "ExpoPushToken[c]"]]);
  const result = readReceipts(
    {
      r1: { status: "ok" },
      r2: { status: "error", message: "x", details: { error: "DeviceNotRegistered" } },
      r3: { status: "error", message: "x", details: { error: "InvalidCredentials" } },
    },
    tokenByReceiptId
  );
  assert.deepEqual(result.deadTokens, ["ExpoPushToken[b]"]);
  assert.deepEqual(result.errors, ["InvalidCredentials"]);
});

test("the cooldown lets one push through per window", () => {
  let clock = 0;
  const cooldown = createCooldown(1000, () => clock);
  assert.equal(cooldown.tryAcquire("s1"), true);
  assert.equal(cooldown.tryAcquire("s1"), false);
  assert.equal(cooldown.tryAcquire("s2"), true);
  clock = 1000;
  assert.equal(cooldown.tryAcquire("s1"), true);
});

// ---- Support tickets ---------------------------------------------------------

const TICKET = { _id: "6ab0000000000000000000cc", userId: RECIPIENT, title: "Feed taps dead", status: "Resolved" };

test("a ticket's push says what happened to it, and carries the ticket to open", () => {
  const push = buildTicketPushMessage({ ticket: TICKET, token: TOKEN, locale: "en", badge: 2, statusChanged: true });
  assert.equal(push.title, "Cinephix Support");
  assert.equal(push.body, "Your ticket has been resolved: Feed taps dead");
  assert.deepEqual(push.data, { type: "ticket_update", ticketId: TICKET._id, recipientId: RECIPIENT });
  assert.equal(push.badge, 2);
  // A newer update about the same ticket replaces the older one in the tray.
  assert.equal(push.tag, `ticket-${TICKET._id}`);
  assert.equal(push.collapseId, push.tag);
});

test("an answer is what the push says, even when the status moved too", () => {
  const push = buildTicketPushMessage({ ticket: TICKET, token: TOKEN, locale: "en", replied: true, statusChanged: true });
  assert.equal(push.body, "Support replied to your ticket: Feed taps dead");
});

test("each status has its own wording, in the device's language", () => {
  const body = (status, locale) => buildTicketPushMessage({ ticket: { ...TICKET, status }, token: TOKEN, locale, statusChanged: true }).body;
  assert.equal(body("Open", "en"), "Your ticket was reopened: Feed taps dead");
  assert.equal(body("In Progress", "en"), "Your ticket is in progress: Feed taps dead");
  assert.equal(body("Closed", "en"), "Your ticket has been closed: Feed taps dead");
  assert.equal(body("Resolved", "tr"), "Talebin çözüldü: Feed taps dead");
});

test("nothing is pushed when nothing actually changed", () => {
  assert.equal(buildTicketPushMessage({ ticket: TICKET, token: TOKEN, locale: "en" }), null);
  assert.equal(buildTicketPushMessage({ ticket: { ...TICKET, status: "Nonsense" }, token: TOKEN, locale: "en", statusChanged: true }), null);
});
