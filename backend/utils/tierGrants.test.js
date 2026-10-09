import test from "node:test";
import assert from "node:assert/strict";
import {
  effectiveTier,
  endGrantUpdate,
  grantActive,
  grantExpired,
  grantUpdate,
  parseExtend,
  parseGrant,
  previousTierFor,
  remaining,
  usernameSearch,
} from "./tierGrants.js";

const NOW = new Date("2026-10-09T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (days) => new Date(NOW.getTime() + days * DAY);

test("parseGrant: tier must be plus or premium", () => {
  assert.ok(parseGrant({ tier: "pro", days: 7 }, NOW).error);
  assert.ok(parseGrant({ tier: "dev", days: 7 }, NOW).error);
  assert.ok(parseGrant({ tier: "free", days: 7 }, NOW).error);
  assert.deepEqual(parseGrant({ tier: "plus", days: 7 }, NOW).value, { tier: "plus", expiresAt: at(7), note: undefined });
});

test("parseGrant: days or an end date, exactly one, within a year", () => {
  assert.ok(parseGrant({ tier: "premium" }, NOW).error, "neither");
  assert.ok(parseGrant({ tier: "premium", days: 7, expiresAt: at(3).toISOString() }, NOW).error, "both");
  for (const days of [0, -1, 1.5, "abc", 366]) assert.ok(parseGrant({ tier: "premium", days }, NOW).error, String(days));
  assert.equal(parseGrant({ tier: "premium", days: "30" }, NOW).value.expiresAt.getTime(), at(30).getTime());
  assert.equal(parseGrant({ tier: "premium", days: 365 }, NOW).value.expiresAt.getTime(), at(365).getTime());

  assert.ok(parseGrant({ tier: "premium", expiresAt: "not a date" }, NOW).error);
  assert.ok(parseGrant({ tier: "premium", expiresAt: at(-1).toISOString() }, NOW).error, "in the past");
  assert.ok(parseGrant({ tier: "premium", expiresAt: NOW.toISOString() }, NOW).error, "now is not the future");
  assert.ok(parseGrant({ tier: "premium", expiresAt: at(400).toISOString() }, NOW).error, "over a year");
  assert.equal(parseGrant({ tier: "premium", expiresAt: at(10).toISOString() }, NOW).value.expiresAt.getTime(), at(10).getTime());
});

test("parseGrant: the note is trimmed and capped", () => {
  assert.equal(parseGrant({ tier: "plus", days: 7, note: "  alpha tester  " }, NOW).value.note, "alpha tester");
  assert.equal(parseGrant({ tier: "plus", days: 7, note: "x".repeat(900) }, NOW).value.note.length, 500);
  assert.equal(parseGrant({ tier: "plus", days: 7, note: "   " }, NOW).value.note, undefined);
});

test("parseExtend adds days to the current end, not to today", () => {
  assert.equal(parseExtend({ days: 30 }, at(5), NOW).value.expiresAt.getTime(), at(35).getTime());
  // An already-ended grant extends from now.
  assert.equal(parseExtend({ days: 7 }, at(-2), NOW).value.expiresAt.getTime(), at(7).getTime());
  assert.equal(parseExtend({ expiresAt: at(60).toISOString() }, at(5), NOW).value.expiresAt.getTime(), at(60).getTime());
  assert.ok(parseExtend({}, at(5), NOW).error);
  assert.ok(parseExtend({ days: 400 }, at(5), NOW).error);
});

test("grantActive / grantExpired", () => {
  assert.equal(grantActive({ tierGrant: { expiresAt: at(1) } }, NOW), true);
  assert.equal(grantExpired({ tierGrant: { expiresAt: at(1) } }, NOW), false);
  assert.equal(grantActive({ tierGrant: { expiresAt: at(-1) } }, NOW), false);
  assert.equal(grantExpired({ tierGrant: { expiresAt: at(-1) } }, NOW), true);
  assert.equal(grantExpired({ tierGrant: { expiresAt: NOW } }, NOW), true, "the end instant counts as ended");
  for (const user of [null, {}, { accountTier: "premium" }]) {
    assert.equal(grantActive(user, NOW), false);
    assert.equal(grantExpired(user, NOW), false);
  }
});

test("effectiveTier: an expired grant falls back to the tier from before it", () => {
  assert.equal(effectiveTier({ accountTier: "premium", tierGrant: { expiresAt: at(3), previousTier: "free" } }, NOW), "premium");
  assert.equal(effectiveTier({ accountTier: "premium", tierGrant: { expiresAt: at(-1), previousTier: "free" } }, NOW), "free");
  assert.equal(effectiveTier({ accountTier: "premium", tierGrant: { expiresAt: at(-1), previousTier: "plus" } }, NOW), "plus");
  assert.equal(effectiveTier({ accountTier: "premium", tierGrant: { expiresAt: at(-1) } }, NOW), "free");
  assert.equal(effectiveTier({ accountTier: "plus" }, NOW), "plus", "no grant: unchanged");
  assert.equal(effectiveTier({}, NOW), "free");
});

test("previousTierFor: re-granting keeps the original tier to restore", () => {
  assert.equal(previousTierFor({ accountTier: "free" }, NOW), "free");
  assert.equal(previousTierFor({ accountTier: "dev" }, NOW), "dev");
  assert.equal(previousTierFor({ accountTier: "premium", tierGrant: { expiresAt: at(3), previousTier: "free" } }, NOW), "free");
  assert.equal(previousTierFor({ accountTier: "premium", tierGrant: { expiresAt: at(-3), previousTier: "plus" } }, NOW), "plus");
});

test("grantUpdate sets the tier the existing clients read; endGrantUpdate restores it", () => {
  const update = grantUpdate({ tier: "premium", expiresAt: at(30), note: "n", adminId: "a1", previousTier: "free", now: NOW });
  assert.equal(update.$set.accountTier, "premium");
  assert.deepEqual(update.$set.tierGrant, { tier: "premium", expiresAt: at(30), grantedBy: "a1", grantedAt: NOW, note: "n", previousTier: "free" });

  const end = endGrantUpdate({ accountTier: "premium", tierGrant: { previousTier: "plus" } }, NOW);
  assert.deepEqual(end, { $set: { accountTier: "plus", tierUpdatedAt: NOW }, $unset: { tierGrant: 1 } });
  assert.equal(endGrantUpdate({ accountTier: "premium", tierGrant: {} }, NOW).$set.accountTier, "free");
});

test("remaining: rounds days up and never goes negative", () => {
  assert.deepEqual(remaining(at(2), NOW), { ms: 2 * DAY, days: 2 });
  assert.equal(remaining(new Date(NOW.getTime() + 60_000), NOW).days, 1);
  assert.deepEqual(remaining(at(-1), NOW), { ms: 0, days: 0 });
});

test("usernameSearch: partial, case-insensitive, regex characters literal", () => {
  assert.equal(usernameSearch("   "), null);
  assert.equal(usernameSearch(undefined), null);
  assert.deepEqual(usernameSearch(" Ali "), { $regex: "Ali", $options: "i" });
  assert.deepEqual(usernameSearch("a.b*(c)"), { $regex: "a\\.b\\*\\(c\\)", $options: "i" });
  const re = new RegExp(usernameSearch("a.b").$regex, "i");
  assert.equal(re.test("XA.BY"), true);
  assert.equal(re.test("axb"), false);
});
