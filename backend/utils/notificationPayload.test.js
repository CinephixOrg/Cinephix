import { test } from "node:test";
import assert from "node:assert/strict";
import { MESSAGE_PREVIEW_LENGTH, messagePreview, shareLikeSummary } from "./notificationPayload.js";

test("a short message is its own preview, with its type", () => {
  assert.deepEqual(messagePreview({ text: "See you at 8!", type: "text" }), { preview: "See you at 8!", kind: "text" });
});

test("whitespace and line breaks collapse to single spaces", () => {
  assert.equal(messagePreview({ text: "  Did you\n\nsee   it?  " }).preview, "Did you see it?");
});

test("a message without a type is a text message", () => {
  assert.equal(messagePreview({ text: "hi" }).kind, "text");
});

test("long messages are cut to the preview length with an ellipsis", () => {
  const { preview } = messagePreview({ text: "a".repeat(500) });
  assert.equal(Array.from(preview).length, MESSAGE_PREVIEW_LENGTH);
  assert.ok(preview.endsWith("…"));
});

test("cutting never splits an emoji", () => {
  const { preview } = messagePreview({ text: "🎬".repeat(200) });
  assert.ok(preview.endsWith("…"));
  assert.ok(Array.from(preview.slice(0, -1)).every((char) => char === "🎬"));
});

test("other message kinds keep their kind, even without text", () => {
  assert.deepEqual(messagePreview({ type: "profile_share" }), { preview: "", kind: "profile_share" });
  assert.deepEqual(messagePreview(null), { preview: "", kind: "text" });
});

const AUTHOR = "a0000000000000000000000a";

test("likers exclude the author, and the latest is the last to like", () => {
  const share = { user: AUTHOR, likes: ["b1", AUTHOR, "c2", "d3"] };
  assert.deepEqual(shareLikeSummary(share), { likerCount: 3, latestLikerId: "d3" });
});

test("a populated author works the same", () => {
  assert.deepEqual(shareLikeSummary({ user: { _id: AUTHOR }, likes: [AUTHOR, "b1"] }), { likerCount: 1, latestLikerId: "b1" });
});

test("no likes, or only the author's, means no one", () => {
  assert.deepEqual(shareLikeSummary({ user: AUTHOR, likes: [] }), { likerCount: 0, latestLikerId: null });
  assert.deepEqual(shareLikeSummary({ user: AUTHOR, likes: [AUTHOR] }), { likerCount: 0, latestLikerId: null });
  assert.deepEqual(shareLikeSummary({ user: AUTHOR }), { likerCount: 0, latestLikerId: null });
});
