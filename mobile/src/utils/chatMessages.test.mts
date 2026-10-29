import test from "node:test";
import assert from "node:assert/strict";
import { chatRows, confirmedOnly, dayHeading, dayLabel, formatInboxTime, inboxTimeKind, mergeLatestPage, messageRuns, unreadChatCount, upsertMessage } from "./chatMessages.ts";
import type { Message } from "../types/index.ts";

function message(id: string, minute: number, extra: Partial<Message> = {}): Message {
  return {
    _id: id,
    roomType: "dm",
    roomId: "room",
    sender: { _id: "u1", username: "ana" },
    text: id,
    type: "text",
    createdAt: new Date(Date.UTC(2026, 8, 18, 10, minute)).toISOString(),
    ...extra,
  } as Message;
}

const ids = (list: Message[]) => list.map((m) => m._id);

test("a complete fresh page replaces what was cached", () => {
  const cached = [message("a", 1), message("b", 2)];
  const fresh = [message("b", 2), message("c", 3)];
  assert.deepEqual(ids(mergeLatestPage(cached, fresh, false)), ["b", "c"]);
});

test("with older history on the server, cached messages older than the fresh page are kept", () => {
  const cached = [message("old1", 1), message("old2", 2), message("b", 3)];
  const fresh = [message("b", 3), message("c", 4)];
  assert.deepEqual(ids(mergeLatestPage(cached, fresh, true)), ["old1", "old2", "b", "c"]);
});

test("messages still sending stay at the end until the server confirms them", () => {
  const pending = message("temp-1", 5, { status: "pending", clientTempId: "temp-1" });
  const cached = [message("a", 1), pending];
  assert.deepEqual(ids(mergeLatestPage(cached, [message("a", 1)], false)), ["a", "temp-1"]);
  const confirmed = message("real-1", 5, { clientTempId: "temp-1" });
  assert.deepEqual(ids(mergeLatestPage(cached, [message("a", 1), confirmed], false)), ["a", "real-1"]);
});

test("an empty fresh page clears a stale cache (the chat really is empty)", () => {
  assert.deepEqual(mergeLatestPage([message("a", 1)], [], false), []);
});

test("an incoming message replaces its optimistic copy in place", () => {
  const list = [message("a", 1), message("temp-9", 2, { status: "pending" })];
  const incoming = message("real-9", 2, { clientTempId: "temp-9" });
  assert.deepEqual(ids(upsertMessage(list, incoming)), ["a", "real-9"]);
});

test("a duplicate incoming message is ignored, keeping the array", () => {
  const list = [message("a", 1)];
  assert.equal(upsertMessage(list, message("a", 1)), list);
});

test("a new incoming message is appended", () => {
  assert.deepEqual(ids(upsertMessage([message("a", 1)], message("b", 2))), ["a", "b"]);
});

test("the cache only keeps confirmed messages", () => {
  const list = [message("a", 1)];
  assert.equal(confirmedOnly(list), list, "nothing pending keeps the array");
  assert.deepEqual(ids(confirmedOnly([...list, message("t", 2, { status: "pending" })])), ["a"]);
});

test("inbox times: today shows the time, this week the weekday, older a date", () => {
  const now = new Date(2026, 8, 18, 15, 0);
  assert.equal(inboxTimeKind(new Date(2026, 8, 18, 0, 5).toISOString(), now), "time");
  assert.equal(inboxTimeKind(new Date(2026, 8, 17, 23, 59).toISOString(), now), "weekday");
  assert.equal(inboxTimeKind(new Date(2026, 8, 12, 9, 0).toISOString(), now), "weekday");
  assert.equal(inboxTimeKind(new Date(2026, 8, 11, 23, 0).toISOString(), now), "date");
  assert.match(formatInboxTime(new Date(2026, 8, 18, 9, 7).toISOString(), now, "en-GB"), /09:07/);
});

test("consecutive messages from one sender form a run; a new sender or a long gap starts another", () => {
  const other = { _id: "u2", username: "bo" };
  const list = [
    message("a", 1),
    message("b", 2),
    message("c", 3, { sender: other }),
    message("d", 20, { sender: other }),
    message("e", 21, { sender: other }),
  ];
  assert.deepEqual(messageRuns(list), [
    { first: true, last: false },
    { first: false, last: true },
    { first: true, last: true },
    { first: true, last: false },
    { first: false, last: true },
  ]);
  assert.deepEqual(messageRuns([]), []);
});

// Regression: a message from a since-deleted account comes back with
// `sender: null` (the server still returns the message, Mongoose just
// can't resolve a ref that no longer exists) — this used to throw
// ("Cannot read property '_id' of null") the instant a chat containing one
// was opened, since messageRuns' own run-grouping compared `.sender._id`
// with no null check.
test("a message with a null sender (deleted account) never crashes and always starts its own run", () => {
  const list = [message("a", 1), message("b", 2, { sender: null }), message("c", 3)];
  assert.deepEqual(messageRuns(list), [
    { first: true, last: true },
    { first: true, last: true },
    { first: true, last: true },
  ]);
});

function at(id: string, date: Date, extra: Partial<Message> = {}): Message {
  return message(id, 0, { createdAt: date.toISOString(), ...extra });
}

test("a new day starts with a separator, and runs don't cross it", () => {
  const list = [
    at("a", new Date(2026, 8, 15, 23, 58)),
    at("b", new Date(2026, 8, 16, 0, 1)),
    at("c", new Date(2026, 8, 16, 0, 2)),
  ];
  const rows = chatRows(list);
  assert.deepEqual(
    rows.map((r) => (r.kind === "day" ? r.key : `${r.key}:${r.first ? "F" : ""}${r.last ? "L" : ""}`)),
    ["day:2026-9-15", "a:FL", "day:2026-9-16", "b:F", "c:L"]
  );
  assert.deepEqual(chatRows([]), []);
});

test("separators read Today, Yesterday, a weekday this week, then a date", () => {
  const now = new Date(2026, 8, 18, 12, 0);
  assert.deepEqual(dayLabel(new Date(2026, 8, 18, 0, 1).toISOString(), now), { kind: "today" });
  assert.deepEqual(dayLabel(new Date(2026, 8, 17, 23, 0).toISOString(), now), { kind: "yesterday" });
  assert.deepEqual(dayLabel(new Date(2026, 8, 12, 9, 0).toISOString(), now), { kind: "weekday" });
  assert.deepEqual(dayLabel(new Date(2026, 8, 3, 9, 0).toISOString(), now), { kind: "date", withYear: false });
  assert.deepEqual(dayLabel(new Date(2025, 11, 31, 9, 0).toISOString(), now), { kind: "date", withYear: true });
});

test("day headings use the caller's words for today and yesterday, dates otherwise", () => {
  const now = new Date(2026, 8, 18, 12, 0);
  const words = { today: "Bugün", yesterday: "Dün" };
  assert.equal(dayHeading(new Date(2026, 8, 18, 1).toISOString(), now, "tr", words), "Bugün");
  assert.equal(dayHeading(new Date(2026, 8, 17, 1).toISOString(), now, "tr", words), "Dün");
  assert.match(dayHeading(new Date(2026, 8, 3, 9).toISOString(), now, "en-GB", words), /3 September/);
  assert.match(dayHeading(new Date(2025, 11, 31, 9).toISOString(), now, "en-GB", words), /2025/);
});

test("the Socials badge counts chats with something new, not messages", () => {
  const dms = [{ unreadCount: 45 }, { unreadCount: 0 }, { unreadCount: 2 }];
  const groups = [{ unreadCount: 0 }, { unreadCount: 1 }];
  // One busy community is one thing to look at, not 45.
  assert.equal(unreadChatCount(dms, groups), 3);
  assert.equal(unreadChatCount([{ unreadCount: 99 }], []), 1);
  assert.equal(unreadChatCount([], []), 0);
  assert.equal(unreadChatCount([{ unreadCount: 0 }], [{ unreadCount: 0 }]), 0);
});
