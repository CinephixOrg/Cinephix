import test from "node:test";
import assert from "node:assert/strict";
import {
  appendPage,
  buildRows,
  copyFor,
  destinationFor,
  hrefFor,
  insertById,
  markAllReadIn,
  markReadById,
  mergeNewestPage,
  relativeTime,
  removeById,
  sectionFor,
} from "./notificationFeed.ts";
import type { Notification, NotificationType } from "../types/index.ts";

const ME = "6a0000000000000000000abc";
const SENDER = { _id: "691f53a845194a18bc31db24", username: "ana" };
const SHARE_ID = "6a7f855f9484891206f30637";

const notification = (id: string, createdAt: string, overrides: Partial<Notification> = {}): Notification => ({
  _id: id,
  sender: SENDER,
  type: "follow",
  conversationId: null,
  read: false,
  createdAt,
  ...overrides,
});

// ---- Routing -----------------------------------------------------------------

test("a follow opens the follower's profile", () => {
  const destination = destinationFor({ type: "follow", sender: SENDER }, ME);
  assert.deepEqual(destination, { kind: "profile", userId: SENDER._id });
  assert.deepEqual(hrefFor(destination), { pathname: "/user/[id]", params: { id: SENDER._id } });
});

test("a message opens the chat with its sender, nested under their profile, named from the first frame", () => {
  const destination = destinationFor({ type: "message", sender: SENDER }, ME);
  assert.deepEqual(destination, { kind: "chat", userId: SENDER._id, username: "ana" });
  assert.deepEqual(hrefFor(destination), {
    pathname: "/user/[id]/chat",
    params: { id: SENDER._id, otherUsername: "ana" },
  });
});

test("a message passes the sender's picture along when they have one", () => {
  const sender = { ...SENDER, profile_pic_url: "https://img.example/ana.jpg" };
  assert.deepEqual(hrefFor(destinationFor({ type: "message", sender }, ME))?.params, {
    id: SENDER._id,
    otherUsername: "ana",
    otherAvatar: "https://img.example/ana.jpg",
  });
});

test("a message from a sender without a name still opens the chat, with no empty params", () => {
  assert.deepEqual(hrefFor(destinationFor({ type: "message", sender: { _id: SENDER._id } }, ME)), {
    pathname: "/user/[id]/chat",
    params: { id: SENDER._id },
  });
});

test("a message without a conversation id still opens the chat", () => {
  const withoutConversation = notification("a", "2026-09-14T10:00:00Z", { type: "message", conversationId: null });
  assert.equal(hrefFor(destinationFor(withoutConversation, ME))?.pathname, "/user/[id]/chat");
});

test("a share like opens that share, in the viewer's own profile stack", () => {
  const destination = destinationFor({ type: "share_like", sender: SENDER, share: { shareId: SHARE_ID } }, ME);
  assert.deepEqual(destination, { kind: "share", authorId: ME, shareId: SHARE_ID });
  assert.deepEqual(hrefFor(destination), { pathname: "/user/[id]/shares/[shareId]", params: { id: ME, shareId: SHARE_ID } });
});

test("missing data leads nowhere instead of crashing", () => {
  assert.deepEqual(destinationFor({ type: "follow", sender: null }, ME), { kind: "none" });
  assert.deepEqual(destinationFor({ type: "message", sender: {} }, ME), { kind: "none" });
  assert.deepEqual(destinationFor({ type: "share_like", sender: SENDER, share: null }, ME), { kind: "none" });
  assert.deepEqual(destinationFor({ type: "share_like", sender: SENDER, share: { shareId: SHARE_ID } }, ""), { kind: "none" });
  assert.deepEqual(destinationFor({ type: "follow_request" as NotificationType, sender: SENDER }, ME), { kind: "none" });
  assert.equal(hrefFor({ kind: "none" }), null);
});

// ---- Copy ----------------------------------------------------------------------

test("a follow reads after the sender's name", () => {
  assert.deepEqual(copyFor({ type: "follow" }), { phrase: "started following you", afterSender: true });
});

test("a message carries its preview, trimmed", () => {
  assert.deepEqual(copyFor({ type: "message", message: { kind: "text", preview: "  See you at 8!  " } }), {
    phrase: "sent you a message",
    afterSender: true,
    preview: "See you at 8!",
  });
});

test("a message without text has no preview", () => {
  assert.deepEqual(copyFor({ type: "message" }), { phrase: "sent you a message", afterSender: true });
  assert.deepEqual(copyFor({ type: "message", message: { kind: "text", preview: "   " } }), { phrase: "sent you a message", afterSender: true });
});

test("richer messages say what was sent", () => {
  assert.equal(copyFor({ type: "message", message: { kind: "recommendation" } }).phrase, "sent you a recommendation");
  assert.equal(copyFor({ type: "message", message: { kind: "analysis_share" } }).phrase, "shared an analysis with you");
  assert.equal(copyFor({ type: "message", message: { kind: "profile_share" } }).phrase, "shared a profile with you");
  assert.equal(copyFor({ type: "message", message: { kind: "sticker" as "text" } }).phrase, "sent you a message");
});

test("one like names the liker; several read as a count on their own", () => {
  assert.deepEqual(copyFor({ type: "share_like", share: { shareId: SHARE_ID, likerCount: 1 } }), {
    phrase: "liked your share",
    afterSender: true,
  });
  assert.deepEqual(copyFor({ type: "share_like", share: { shareId: SHARE_ID, likerCount: 10 } }), {
    phrase: "{{count}} users liked your share",
    count: 10,
    afterSender: false,
  });
  assert.deepEqual(copyFor({ type: "share_like" }), { phrase: "liked your share", afterSender: true });
});

test("an unknown type still says something", () => {
  assert.deepEqual(copyFor({ type: "something_new" as NotificationType }), { phrase: "New notification", afterSender: false });
});

// ---- Sections ------------------------------------------------------------------

// Local-time constructors, so the boundaries hold in any time zone the tests run in.
const now = new Date(2026, 8, 14, 9, 30); // Monday 14 Sep 2026, 09:30
const at = (day: number, hour = 12, minute = 0) => new Date(2026, 8, day, hour, minute).toISOString();

test("sections follow calendar days, not 24-hour windows", () => {
  assert.equal(sectionFor(at(14, 0, 0), now), "today"); // midnight this morning
  assert.equal(sectionFor(at(13, 23, 59), now), "yesterday"); // a minute before midnight
  assert.equal(sectionFor(at(13, 0, 0), now), "yesterday");
  assert.equal(sectionFor(at(12, 23, 0), now), "week");
  assert.equal(sectionFor(at(8, 0, 0), now), "week"); // six days back, start of day
  assert.equal(sectionFor(at(7, 23, 59), now), "earlier");
});

test("a timestamp slightly in the future (clock skew) counts as today", () => {
  assert.equal(sectionFor(new Date(now.getTime() + 60_000).toISOString(), now), "today");
});

test("rows put one header before each section's notifications", () => {
  const items = [
    notification("d", at(14, 9)),
    notification("c", at(14, 8)),
    notification("b", at(13)),
    notification("a", at(1)),
  ];
  assert.deepEqual(
    buildRows(items, now).map((row) => (row.kind === "header" ? row.section : row.key)),
    ["today", "d", "c", "yesterday", "b", "earlier", "a"]
  );
});

test("no notifications, no headers", () => {
  assert.deepEqual(buildRows([], now), []);
});

// ---- Relative time -------------------------------------------------------------

test("relative times: just now, minutes, hours, days, then a date", () => {
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  assert.deepEqual(relativeTime(ago(30_000), now), { kind: "relative", key: "Just now" });
  assert.deepEqual(relativeTime(ago(5 * 60_000), now), { kind: "relative", key: "{{count}}m", count: 5 });
  assert.deepEqual(relativeTime(ago(3 * 3_600_000), now), { kind: "relative", key: "{{count}}h", count: 3 });
  assert.deepEqual(relativeTime(ago(2 * 86_400_000), now), { kind: "relative", key: "{{count}}d", count: 2 });
  assert.deepEqual(relativeTime(ago(8 * 86_400_000), now), { kind: "date" });
  assert.deepEqual(relativeTime(new Date(now.getTime() + 5_000).toISOString(), now), { kind: "relative", key: "Just now" });
});

// ---- Pages -----------------------------------------------------------------------

const ids = (items: Notification[]) => items.map((item) => item._id);
const n = (id: string) => notification(id, at(14));

test("a fresh first page that is the whole feed replaces the list", () => {
  assert.deepEqual(ids(mergeNewestPage([n("3"), n("2"), n("1")], [n("5"), n("4")], false)), ["5", "4"]);
});

test("a fresh first page keeps the older pages already loaded below it", () => {
  const existing = [n("6"), n("5"), n("4"), n("3"), n("2"), n("1")];
  const fresh = [n("8"), n("7"), n("5")]; // 6 was deleted elsewhere; 7 and 8 are new
  assert.deepEqual(ids(mergeNewestPage(existing, fresh, true)), ["8", "7", "5", "4", "3", "2", "1"]);
});

test("appending an older page skips duplicates", () => {
  assert.deepEqual(ids(appendPage([n("3"), n("2")], [n("2"), n("1")])), ["3", "2", "1"]);
});

test("remove, then insert back, restores the original order", () => {
  const items = [n("3"), n("2"), n("1")];
  const removed = removeById(items, "2");
  assert.deepEqual(ids(removed), ["3", "1"]);
  assert.deepEqual(ids(insertById(removed, n("2"))), ["3", "2", "1"]);
  assert.deepEqual(ids(insertById(items, n("2"))), ["3", "2", "1"]);
});

test("marking read touches only that notification, and returns the same array when nothing changes", () => {
  const items = [n("2"), n("1")];
  const marked = markReadById(items, "1");
  assert.equal(marked[1].read, true);
  assert.equal(marked[0], items[0]);
  assert.equal(markReadById(marked, "1"), marked);
  assert.equal(markReadById(items, "missing"), items);
});

test("mark all read keeps the array when everything is already read", () => {
  const unread = [n("2"), n("1")];
  const read = markAllReadIn(unread);
  assert.deepEqual(read.map((item) => item.read), [true, true]);
  assert.equal(markAllReadIn(read), read);
});
