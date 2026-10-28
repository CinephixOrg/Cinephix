import test from "node:test";
import assert from "node:assert/strict";
import { groupBySender, receiptsForViewer, visibleReaders, withInferredReads } from "./readReceipts.js";

test("newly read messages are grouped by their sender, populated or not", () => {
  const bySender = groupBySender([
    { _id: "m1", sender: "ana" },
    { _id: "m2", sender: { _id: "ben" } },
    { _id: "m3", sender: "ana" },
  ]);
  assert.deepEqual([...bySender.entries()], [
    ["ana", ["m1", "m3"]],
    ["ben", ["m2"]],
  ]);
});

test("a viewer gets readBy on their own messages only", () => {
  const read = [{ user: "x", at: "2026-10-27T10:00:00Z" }];
  const messages = [
    { _id: "m1", sender: { _id: "me" }, readBy: read },
    { _id: "m2", sender: { _id: "ana" }, readBy: read },
    { _id: "m3", sender: "ana" },
  ];
  const seen = receiptsForViewer(messages, "me");
  assert.deepEqual(seen[0].readBy, read);
  assert.ok(!("readBy" in seen[1]));
  assert.equal(seen[1].sender._id, "ana");
  assert.deepEqual(seen[2], messages[2]);
});

test("readers come earliest first, without deleted or blocked accounts", () => {
  const readers = visibleReaders(
    [
      { user: { _id: "late" }, at: "2026-10-27T12:00:00Z" },
      { user: null, at: "2026-10-27T09:00:00Z" },
      { user: { _id: "blocked" }, at: "2026-10-27T10:00:00Z" },
      { user: { _id: "early" }, at: "2026-10-27T11:00:00Z" },
    ],
    new Set(["blocked"])
  );
  assert.deepEqual(readers.map((r) => r.user._id), ["early", "late"]);
});

test("no readBy at all reads as no readers", () => {
  assert.deepEqual(visibleReaders(undefined, new Set()), []);
});

const at = (minute) => new Date(Date.UTC(2026, 9, 27, 10, minute)).toISOString();
const dm = [
  { _id: "m1", sender: { _id: "me" }, createdAt: at(1) },
  { _id: "m2", sender: { _id: "ana" }, createdAt: at(2) },
  { _id: "m3", sender: { _id: "me" }, createdAt: at(3) },
  { _id: "m4", sender: { _id: "me" }, createdAt: at(4), readBy: [] },
];
const readIds = (list) => list.filter((m) => m.readBy?.some((r) => r.user === "ana")).map((m) => m._id);

test("older messages: nothing unread means all of yours were read, with no time", () => {
  const out = withInferredReads(dm, { viewerId: "me", otherId: "ana", unreadFrom: null });
  assert.deepEqual(readIds(out), ["m1", "m3", "m4"]);
  assert.deepEqual(out[0].readBy, [{ user: "ana", at: null }]);
  assert.equal(out[1], dm[1], "their own message is left alone");
});

test("older messages: yours from the oldest unread one on stay unread", () => {
  const out = withInferredReads(dm, { viewerId: "me", otherId: "ana", unreadFrom: at(3) });
  assert.deepEqual(readIds(out), ["m1"]);
});

test("a recorded receipt is kept as it is", () => {
  const recorded = [{ _id: "m5", sender: "me", createdAt: at(5), readBy: [{ user: "ana", at: at(6) }] }];
  const out = withInferredReads(recorded, { viewerId: "me", otherId: "ana", unreadFrom: null });
  assert.equal(out[0], recorded[0]);
});

test("a receipt with no time is listed first", () => {
  const readers = visibleReaders([{ user: { _id: "b" }, at: at(9) }, { user: { _id: "a" }, at: null }], new Set());
  assert.deepEqual(readers.map((r) => r.user._id), ["a", "b"]);
});
