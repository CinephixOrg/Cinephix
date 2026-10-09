// The admin dashboard's "Recent signups" view: who joined, how, and whether
// they've started using the app. Pure, so it's tested without a database
// (recentSignups.test.js); controllers/recentSignupsController.js runs it.
//
// Nothing sensitive leaves the server: a row is built from an allowlist of
// fields, passwords and tokens are only ever reduced to booleans in the
// query itself, and emails are masked (an admin reveals one on purpose,
// through its own endpoint).

export const RANGE_DAYS = [1, 7, 30];
export const MAX_DAYS = 365;
export const SIGNUP_METHODS = ["email", "google"];

const DAY_MS = 24 * 60 * 60 * 1000;
// Real time zones run from UTC-12 to UTC+14.
const MAX_OFFSET_MINUTES = 14 * 60;

const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/**
 * The browser's Date#getTimezoneOffset() (minutes, positive west of UTC),
 * so "today" and the daily chart follow the admin's own calendar day.
 */
export function parseTzOffset(value) {
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || Math.abs(minutes) > MAX_OFFSET_MINUTES) return 0;
  return minutes;
}

/** Mongo's timezone string for that offset: -180 → "+03:00". */
export function tzString(offsetMinutes) {
  const east = -offsetMinutes;
  const sign = east >= 0 ? "+" : "-";
  const abs = Math.abs(east);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** Midnight of the local day `now` falls in, `daysBack` days earlier, as a UTC Date. */
export function startOfLocalDay(now, offsetMinutes, daysBack = 0) {
  const local = new Date(now.getTime() - offsetMinutes * 60 * 1000);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - daysBack * DAY_MS;
  return new Date(midnight + offsetMinutes * 60 * 1000);
}

/**
 * GET /api/admin/users/recent's query: { days, method, verified, q, page,
 * limit, tz }. `days` 1 means today (since local midnight), 7 and 30 the
 * calendar days including today. Returns { value } or { error }.
 */
export function parseRecentQuery(query = {}, now = new Date()) {
  const days = query.days === undefined || query.days === "" ? 30 : Number(query.days);
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) return { error: `days must be a whole number from 1 to ${MAX_DAYS}` };

  const method = text(query.method, 10) || undefined;
  if (method && !SIGNUP_METHODS.includes(method)) return { error: "method must be email or google" };

  const verified = query.verified === "true" || query.verified === true;
  const q = text(query.q, 50) || undefined;
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 25));
  const tzOffset = parseTzOffset(query.tz);
  const since = startOfLocalDay(now, tzOffset, days - 1);

  return { value: { days, since, method, verified, q, page, limit, skip: (page - 1) * limit, tzOffset } };
}

/** The $match for those options. Uses the createdAt index. */
export function recentFilter({ since, method, verified, q }) {
  const filter = { createdAt: { $gte: since } };
  // A Google signup has no password; an email signup has one (and may have
  // linked Google later, which doesn't make it a Google signup).
  if (method === "google") filter.password = { $in: [null] };
  if (method === "email") filter.password = { $nin: [null] };
  if (verified) filter.isEmailVerified = true;
  if (q) filter.username = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  return filter;
}

/**
 * The fields the list query keeps, computed in the database: counts instead
 * of arrays, and booleans instead of the password, Google id and push tokens
 * themselves, so none of those is ever read out.
 */
export const RECENT_PROJECTION = {
  username: 1,
  email: 1,
  profile_pic_url: 1,
  createdAt: 1,
  isEmailVerified: 1,
  accountTier: 1,
  tierGrant: 1,
  isSuspended: 1,
  isAdmin: 1,
  lastStreakDate: 1,
  hasPassword: { $gt: ["$password", null] },
  hasGoogle: { $gt: ["$googleId", null] },
  followingCount: { $size: { $ifNull: ["$following", []] } },
  followersCount: { $size: { $ifNull: ["$followers", []] } },
  watchlistCount: { $size: { $ifNull: ["$watchlist", []] } },
  pushTokenCount: { $size: { $ifNull: ["$pushTokens", []] } },
  lastAppOpenAt: { $max: { $ifNull: ["$pushTokens.lastSeenAt", []] } },
};

/** "f***@gmail.com". Anything not shaped like an email is hidden entirely. */
export function maskEmail(email) {
  if (typeof email !== "string") return null;
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

/** How the account was created. */
export function signupMethod(doc) {
  return doc.hasPassword ? "email" : doc.hasGoogle ? "google" : "email";
}

/**
 * One row for the dashboard, from a projected user document plus the
 * per-user counts looked up separately. Only these fields, whatever the
 * document holds.
 */
export function toSignupRow(doc, { ratings = 0, communities = 0, online = false, now = new Date() } = {}) {
  const grantEnd = doc.tierGrant?.expiresAt ? new Date(doc.tierGrant.expiresAt) : null;
  const grantRunning = Boolean(grantEnd && grantEnd > now);
  const lastAppOpen = doc.lastAppOpenAt ? new Date(doc.lastAppOpenAt) : null;
  return {
    _id: doc._id,
    username: doc.username,
    profile_pic_url: doc.profile_pic_url || "",
    emailMasked: maskEmail(doc.email),
    createdAt: doc.createdAt,
    signupMethod: signupMethod(doc),
    googleLinked: Boolean(doc.hasGoogle),
    emailVerified: Boolean(doc.isEmailVerified),
    accountTier: grantEnd && !grantRunning ? doc.tierGrant.previousTier || "free" : doc.accountTier || "free",
    tierGrantExpiresAt: grantRunning ? grantEnd : null,
    isSuspended: Boolean(doc.isSuspended),
    isAdmin: Boolean(doc.isAdmin),
    activity: {
      onlineNow: Boolean(online),
      lastAppOpenAt: lastAppOpen,
      lastStreakDate: doc.lastStreakDate ?? null,
      ratings,
      following: doc.followingCount ?? 0,
      followers: doc.followersCount ?? 0,
      watchlist: doc.watchlistCount ?? 0,
      communities,
      hasPushToken: (doc.pushTokenCount ?? 0) > 0,
    },
  };
}

/**
 * The chart's series: one { date: "YYYY-MM-DD", count } per local day from
 * `days - 1` days ago through today, zero where nobody signed up.
 */
export function dailySeries(buckets, now, days, offsetMinutes) {
  const byDate = new Map(buckets.map((b) => [b._id, b.count]));
  const series = [];
  for (let back = days - 1; back >= 0; back--) {
    const local = new Date(startOfLocalDay(now, offsetMinutes, back).getTime() - offsetMinutes * 60 * 1000);
    const date = local.toISOString().slice(0, 10);
    series.push({ date, count: byDate.get(date) ?? 0 });
  }
  return series;
}
