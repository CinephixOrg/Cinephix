import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY_CATEGORIES,
  ALL_ACTIVITY_TYPES,
  MAX_ACTIVITY_LIMIT,
  MAX_ACTIVITY_PAGE,
  compareEvents,
  mergeActivityPage,
  mergeFollowEvents,
  parseActivityQuery,
} from "./activityFeed.js";

const NOW = new Date("2026-09-18T12:00:00.000Z");
const ev = (key, iso, extra = {}) => ({ key, createdAt: new Date(iso), ...extra });

test("ranges: week and month cut off, all time doesn't", () => {
  assert.equal(parseActivityQuery({}, NOW).range, "week");
  assert.equal(parseActivityQuery({}, NOW).cutoff.toISOString(), "2026-09-11T12:00:00.000Z");
  assert.equal(parseActivityQuery({ range: "month" }, NOW).cutoff.toISOString(), "2026-08-19T12:00:00.000Z");
  assert.equal(parseActivityQuery({ range: "all" }, NOW).cutoff, null);
  assert.equal(parseActivityQuery({ range: "decade" }, NOW).range, "week", "unknown falls back");
});

test("categories expand to their types; none or only unknown ones means everything", () => {
  const { types } = parseActivityQuery({ categories: "likes,cinematch" }, NOW);
  assert.deepEqual([...types].sort(), ["match_analyzed", "profile_analyzed", "review_liked"]);
  assert.equal(parseActivityQuery({ categories: "" }, NOW).types.size, ALL_ACTIVITY_TYPES.length);
  assert.equal(parseActivityQuery({ categories: "bogus,__proto__" }, NOW).types.size, ALL_ACTIVITY_TYPES.length);
  assert.equal(new Set(ALL_ACTIVITY_TYPES).size, ALL_ACTIVITY_TYPES.length, "no type is in two categories");
  assert.ok(Object.keys(ACTIVITY_CATEGORIES).length >= 10);
});

test("page and limit are bounded", () => {
  const q = parseActivityQuery({ page: "999", limit: "999" }, NOW);
  assert.equal(q.page, MAX_ACTIVITY_PAGE);
  assert.equal(q.limit, MAX_ACTIVITY_LIMIT);
  assert.equal(parseActivityQuery({ page: "-3", limit: "abc" }, NOW).page, 1);
  assert.equal(parseActivityQuery({ limit: "abc" }, NOW).limit, 10);
});

test("events sort newest first, ties by key so the order is stable", () => {
  const list = [ev("a", "2026-09-10"), ev("c", "2026-09-12"), ev("b", "2026-09-10")].sort(compareEvents);
  assert.deepEqual(list.map((e) => e.key), ["c", "b", "a"]);
});

test("pages merge across sources in time order", () => {
  const ratings = { events: [ev("r1", "2026-09-17"), ev("r2", "2026-09-14")] };
  const reviews = { events: [ev("v1", "2026-09-16"), ev("v2", "2026-09-10")] };
  const first = mergeActivityPage([ratings, reviews], { page: 1, limit: 3, cap: 3 });
  assert.deepEqual(first.items.map((e) => e.key), ["r1", "v1", "r2"]);
  assert.equal(first.hasMore, true);
  const second = mergeActivityPage([ratings, reviews], { page: 2, limit: 3, cap: 6 });
  assert.deepEqual(second.items.map((e) => e.key), ["v2"]);
  assert.equal(second.hasMore, false);
});

test("a source that came back full means there may be more, even at an exact page boundary", () => {
  const full = { events: [ev("a", "2026-09-17"), ev("b", "2026-09-16")] };
  const page = mergeActivityPage([full], { page: 1, limit: 2, cap: 2 });
  assert.equal(page.hasMore, true);
  const short = mergeActivityPage([{ events: [ev("a", "2026-09-17")] }], { page: 1, limit: 2, cap: 2 });
  assert.equal(short.hasMore, false);
});

test("follows: logged first, notifications fill older ones, only people still followed, once each", () => {
  const logged = [ev("f:1", "2026-09-15", { targetId: "u1" })];
  const notified = [
    ev("n:1", "2026-09-01", { targetId: "u1" }),
    ev("n:2", "2026-08-20", { targetId: "u2" }),
    ev("n:3", "2026-08-10", { targetId: "u3" }),
  ];
  const merged = mergeFollowEvents(logged, notified, new Set(["u1", "u2"]));
  assert.deepEqual(merged.map((e) => e.key), ["f:1", "n:2"]);
});
