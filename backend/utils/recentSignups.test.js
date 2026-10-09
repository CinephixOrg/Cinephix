import test from "node:test";
import assert from "node:assert/strict";
import {
  dailySeries,
  maskEmail,
  parseRecentQuery,
  parseTzOffset,
  recentFilter,
  startOfLocalDay,
  toSignupRow,
  tzString,
} from "./recentSignups.js";

// 2026-10-09 01:30 in Istanbul (UTC+3): still the 8th in UTC.
const NOW = new Date("2026-10-08T22:30:00Z");
const ISTANBUL = -180; // Date#getTimezoneOffset() there

test("time zones: offsets, Mongo strings, local midnight", () => {
  assert.equal(parseTzOffset("-180"), -180);
  for (const bad of ["abc", "1.5", "9999", undefined]) assert.equal(parseTzOffset(bad), 0);
  assert.equal(tzString(-180), "+03:00");
  assert.equal(tzString(0), "+00:00");
  assert.equal(tzString(300), "-05:00");
  assert.equal(tzString(-330), "+05:30");
  // Istanbul's 9 October starts at 21:00 UTC on the 8th.
  assert.equal(startOfLocalDay(NOW, ISTANBUL).toISOString(), "2026-10-08T21:00:00.000Z");
  assert.equal(startOfLocalDay(NOW, 0).toISOString(), "2026-10-08T00:00:00.000Z");
  assert.equal(startOfLocalDay(NOW, ISTANBUL, 6).toISOString(), "2026-10-02T21:00:00.000Z");
});

test("parseRecentQuery: date ranges are whole local days including today", () => {
  assert.equal(parseRecentQuery({ days: "1", tz: "-180" }, NOW).value.since.toISOString(), "2026-10-08T21:00:00.000Z");
  assert.equal(parseRecentQuery({ days: "7", tz: "-180" }, NOW).value.since.toISOString(), "2026-10-02T21:00:00.000Z");
  assert.equal(parseRecentQuery({ tz: "-180" }, NOW).value.days, 30, "30 days by default");
  for (const days of ["0", "-1", "1.5", "abc", "366"]) assert.ok(parseRecentQuery({ days }, NOW).error, days);
});

test("parseRecentQuery: pagination, method, verified, search", () => {
  const { value } = parseRecentQuery({ page: "3", limit: "10", method: "google", verified: "true", q: "  ali " }, NOW);
  assert.equal(value.page, 3);
  assert.equal(value.limit, 10);
  assert.equal(value.skip, 20);
  assert.equal(value.method, "google");
  assert.equal(value.verified, true);
  assert.equal(value.q, "ali");
  assert.equal(parseRecentQuery({ limit: "5000" }, NOW).value.limit, 100, "capped");
  assert.equal(parseRecentQuery({ page: "-2" }, NOW).value.page, 1);
  assert.ok(parseRecentQuery({ method: "facebook" }, NOW).error);
  assert.equal(parseRecentQuery({ verified: "false" }, NOW).value.verified, false);
});

test("recentFilter", () => {
  const since = new Date("2026-10-01T00:00:00Z");
  assert.deepEqual(recentFilter({ since }), { createdAt: { $gte: since } });
  assert.deepEqual(recentFilter({ since, method: "google" }).password, { $in: [null] });
  assert.deepEqual(recentFilter({ since, method: "email" }).password, { $nin: [null] });
  assert.equal(recentFilter({ since, verified: true }).isEmailVerified, true);
  assert.deepEqual(recentFilter({ since, q: "a.b" }).username, { $regex: "a\\.b", $options: "i" });
});

test("maskEmail", () => {
  assert.equal(maskEmail("furkan@gmail.com"), "f***@gmail.com");
  assert.equal(maskEmail("a@b.co"), "a***@b.co");
  assert.equal(maskEmail("no-at-sign"), "***");
  assert.equal(maskEmail("@x.com"), "***");
  assert.equal(maskEmail(undefined), null);
});

test("toSignupRow: allowlisted fields only, email masked, nothing secret", () => {
  const doc = {
    _id: "u1",
    username: "ali",
    email: "ali.veli@example.com",
    password: "$2a$10$hash",
    googleId: "1234567890",
    emailVerificationCode: "482913",
    passwordResetCode: "777777",
    pushTokens: [{ token: "ExponentPushToken[abc]" }],
    blockedUsers: ["x"],
    hasPassword: true,
    hasGoogle: true,
    isEmailVerified: true,
    createdAt: new Date("2026-10-08T20:00:00Z"),
    accountTier: "free",
    followingCount: 3,
    followersCount: 1,
    watchlistCount: 12,
    pushTokenCount: 1,
    lastAppOpenAt: new Date("2026-10-08T21:30:00Z"),
  };
  const row = toSignupRow(doc, { ratings: 7, communities: 2, online: true, now: NOW });
  assert.deepEqual(Object.keys(row).sort(), [
    "_id", "accountTier", "activity", "createdAt", "emailMasked", "emailVerified", "googleLinked",
    "isAdmin", "isSuspended", "profile_pic_url", "signupMethod", "tierGrantExpiresAt", "username",
  ]);
  const json = JSON.stringify(row);
  for (const secret of ["ali.veli", "$2a$10$hash", "1234567890", "482913", "777777", "ExponentPushToken"]) {
    assert.ok(!json.includes(secret), `leaked ${secret}`);
  }
  assert.equal(row.emailMasked, "a***@example.com");
  assert.equal(row.signupMethod, "email", "linked Google later: still an email signup");
  assert.equal(row.googleLinked, true);
  assert.deepEqual(row.activity, {
    onlineNow: true,
    lastAppOpenAt: new Date("2026-10-08T21:30:00Z"),
    lastStreakDate: null,
    ratings: 7,
    following: 3,
    followers: 1,
    watchlist: 12,
    communities: 2,
    hasPushToken: true,
  });
});

test("toSignupRow: Google signups, and the effective tier with a grant", () => {
  assert.equal(toSignupRow({ hasGoogle: true, hasPassword: false }).signupMethod, "google");
  const running = toSignupRow({ accountTier: "premium", tierGrant: { expiresAt: new Date(NOW.getTime() + 86400000), previousTier: "free" } }, { now: NOW });
  assert.equal(running.accountTier, "premium");
  assert.ok(running.tierGrantExpiresAt);
  const ended = toSignupRow({ accountTier: "premium", tierGrant: { expiresAt: new Date(NOW.getTime() - 1000), previousTier: "free" } }, { now: NOW });
  assert.equal(ended.accountTier, "free");
  assert.equal(ended.tierGrantExpiresAt, null);
});

test("dailySeries: every local day, zeros filled, oldest first", () => {
  const series = dailySeries([{ _id: "2026-10-09", count: 4 }, { _id: "2026-10-07", count: 1 }], NOW, 3, ISTANBUL);
  assert.deepEqual(series, [
    { date: "2026-10-07", count: 1 },
    { date: "2026-10-08", count: 0 },
    { date: "2026-10-09", count: 4 },
  ]);
  assert.equal(dailySeries([], NOW, 30, ISTANBUL).length, 30);
});
