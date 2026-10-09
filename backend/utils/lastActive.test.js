import test from "node:test";
import assert from "node:assert/strict";
import { LAST_ACTIVE_INTERVAL_MS, lastActiveDue } from "./lastActive.js";

const NOW = new Date("2026-10-09T12:00:00Z");

test("lastActiveDue: nothing recorded yet means due", () => {
  for (const last of [0, undefined, NaN, null]) assert.equal(lastActiveDue(last, NOW), true, String(last));
});

test("lastActiveDue: at most once per interval", () => {
  assert.equal(LAST_ACTIVE_INTERVAL_MS, 5 * 60 * 1000);
  assert.equal(lastActiveDue(NOW.getTime() - 60_000, NOW), false, "a minute ago");
  assert.equal(lastActiveDue(NOW.getTime() - LAST_ACTIVE_INTERVAL_MS + 1, NOW), false, "just under");
  assert.equal(lastActiveDue(NOW.getTime() - LAST_ACTIVE_INTERVAL_MS, NOW), true, "exactly an interval");
  assert.equal(lastActiveDue(NOW.getTime() - 3600_000, NOW), true, "an hour ago");
  assert.equal(lastActiveDue(NOW.getTime() - 60_000, NOW, 30_000), true, "custom interval");
});
