import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, buildFeedFilter, parseFeedQuery, shapeCursorPage } from "./notificationFeed.js";

const ID = "6a7f855f9484891206f30637";

test("defaults: first page, 20 at a time, page mode, everything", () => {
  assert.deepEqual(parseFeedQuery({}), { limit: DEFAULT_PAGE_SIZE, before: null, cursor: false, unreadOnly: false, page: 1 });
});

test("the limit is clamped between 1 and the maximum", () => {
  assert.equal(parseFeedQuery({ limit: "500" }).limit, MAX_PAGE_SIZE);
  assert.equal(parseFeedQuery({ limit: "0" }).limit, 1);
  assert.equal(parseFeedQuery({ limit: "-4" }).limit, 1);
  assert.equal(parseFeedQuery({ limit: "abc" }).limit, DEFAULT_PAGE_SIZE);
});

test("cursor mode is opted into explicitly, or implied by a valid before id", () => {
  assert.equal(parseFeedQuery({ cursor: "1" }).cursor, true);
  assert.equal(parseFeedQuery({ cursor: "true" }).cursor, true);
  assert.deepEqual(
    [parseFeedQuery({ before: ID }).cursor, parseFeedQuery({ before: ID }).before],
    [true, ID]
  );
});

test("a malformed before id is ignored rather than passed to the database", () => {
  const parsed = parseFeedQuery({ before: "not-an-id", cursor: "1" });
  assert.equal(parsed.before, null);
  assert.equal(parseFeedQuery({ before: { $gt: "" } }).before, null);
});

test("page numbers below 1 or unparsable fall back to the first page", () => {
  assert.equal(parseFeedQuery({ page: "0" }).page, 1);
  assert.equal(parseFeedQuery({ page: "x" }).page, 1);
  assert.equal(parseFeedQuery({ page: "3" }).page, 3);
});

test("unread=1 filters to unread", () => {
  assert.equal(parseFeedQuery({ unread: "1" }).unreadOnly, true);
  assert.equal(parseFeedQuery({ unread: "0" }).unreadOnly, false);
});

test("the filter is always scoped to the caller, then narrowed", () => {
  assert.deepEqual(buildFeedFilter("u1"), { user: "u1" });
  assert.deepEqual(buildFeedFilter("u1", { unreadOnly: true, before: ID }), { user: "u1", read: false, _id: { $lt: ID } });
});

const doc = (id, sender = { _id: "s", username: "ana" }) => ({ _id: id, sender });

test("a page reports whether more remain and continues from its last id", () => {
  const docs = [doc("c"), doc("b"), doc("a")];
  assert.deepEqual(shapeCursorPage(docs, 2), { items: [doc("c"), doc("b")], hasMore: true, nextCursor: "b" });
  assert.deepEqual(shapeCursorPage(docs.slice(0, 2), 2), { items: [doc("c"), doc("b")], hasMore: false, nextCursor: "b" });
});

test("notifications from deleted accounts are dropped, but the cursor still moves past them", () => {
  const docs = [doc("c"), doc("b", null), doc("a", null)];
  const page = shapeCursorPage(docs, 2);
  assert.deepEqual(page.items, [doc("c")]);
  assert.equal(page.nextCursor, "b");
  assert.equal(page.hasMore, true);
});

test("an empty result is the end of the feed", () => {
  assert.deepEqual(shapeCursorPage([], 20), { items: [], hasMore: false, nextCursor: null });
});
