// Time-limited Plus/Premium granted by an admin (for alpha testers: an
// ad-free app without paying). The rules here are pure, so they're tested
// without a database (tierGrants.test.js); services/tierGrants.js applies them.
//
// A grant sets accountTier itself, so every existing reader — the login
// response, /users/me, the server-side tier limits, the avatar frames other
// people see, and the mobile app's ad check — needs no change. The grant
// remembers the tier the account had before, which comes back when it ends.

/** What an admin may grant. */
export const GRANTABLE_TIERS = ["plus", "premium"];

/** What the dashboard offers; any other whole number of days up to MAX_DAYS works too. */
export const GRANT_DURATIONS_DAYS = [7, 30, 90];

/** A year, so a typo can't grant someone a decade. */
export const MAX_DAYS = 365;
export const MAX_NOTE = 500;

const DAY_MS = 24 * 60 * 60 * 1000;

const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/**
 * When a grant ends: `days` from `from`, or an explicit `expiresAt`. Exactly
 * one of the two. Returns { value: Date } or { error }; never throws.
 */
function parseEnd(body, from, now) {
  const hasDays = body.days !== undefined && body.days !== null && body.days !== "";
  const hasDate = body.expiresAt !== undefined && body.expiresAt !== null && body.expiresAt !== "";
  if (hasDays === hasDate) return { error: "Give either a number of days or an end date" };

  let end;
  if (hasDays) {
    const days = Number(body.days);
    if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) return { error: `Days must be a whole number from 1 to ${MAX_DAYS}` };
    end = new Date(from.getTime() + days * DAY_MS);
  } else {
    end = new Date(body.expiresAt);
    if (Number.isNaN(end.getTime())) return { error: "That end date isn't a valid date" };
  }
  if (end <= now) return { error: "The end date must be in the future" };
  if (end.getTime() - now.getTime() > MAX_DAYS * DAY_MS) return { error: `A grant can last at most ${MAX_DAYS} days` };
  return { value: end };
}

/** A new grant: { tier, days | expiresAt, note? }. */
export function parseGrant(body = {}, now = new Date()) {
  if (!GRANTABLE_TIERS.includes(body.tier)) return { error: "Tier must be plus or premium" };
  const end = parseEnd(body, now, now);
  if (end.error) return end;
  return { value: { tier: body.tier, expiresAt: end.value, note: text(body.note, MAX_NOTE) || undefined } };
}

/**
 * Extending an active grant: `days` are added to its current end (not to
 * today, so extending early doesn't lose the time already given), or a new
 * `expiresAt` replaces it. `note` replaces the note only when given.
 */
export function parseExtend(body = {}, currentExpiresAt, now = new Date()) {
  const from = currentExpiresAt && new Date(currentExpiresAt) > now ? new Date(currentExpiresAt) : now;
  const end = parseEnd(body, from, now);
  if (end.error) return end;
  const note = text(body.note, MAX_NOTE);
  return { value: { expiresAt: end.value, note: note || undefined } };
}

/** Whether the account has a grant that hasn't run out. */
export function grantActive(user, now = new Date()) {
  const end = user?.tierGrant?.expiresAt;
  return Boolean(end) && new Date(end) > now;
}

/** Whether the account has a grant that has run out but is still applied. */
export function grantExpired(user, now = new Date()) {
  const end = user?.tierGrant?.expiresAt;
  return Boolean(end) && new Date(end) <= now;
}

/** The tier to fall back to when a grant ends or is revoked. */
export function tierAfterGrant(user) {
  return user?.tierGrant?.previousTier || "free";
}

/** The tier the account really has right now, an expired grant already undone. */
export function effectiveTier(user, now = new Date()) {
  if (grantExpired(user, now)) return tierAfterGrant(user);
  return user?.accountTier || "free";
}

/**
 * The tier a new grant should restore at its end: what the account had
 * before any grant. Re-granting over an active grant keeps the original,
 * rather than "restoring" the granted tier.
 */
export function previousTierFor(user, now = new Date()) {
  if (user?.tierGrant?.previousTier && (grantActive(user, now) || grantExpired(user, now))) {
    return user.tierGrant.previousTier;
  }
  return user?.accountTier || "free";
}

/** The update that applies a grant. */
export function grantUpdate({ tier, expiresAt, note, adminId, previousTier, now = new Date() }) {
  return {
    $set: {
      accountTier: tier,
      tierUpdatedAt: now,
      tierGrant: { tier, expiresAt, grantedBy: adminId, grantedAt: now, note, previousTier },
    },
  };
}

/** The update that ends a grant, whether it ran out or was revoked. */
export function endGrantUpdate(user, now = new Date()) {
  return { $set: { accountTier: tierAfterGrant(user), tierUpdatedAt: now }, $unset: { tierGrant: 1 } };
}

/** Time left on a grant: milliseconds, and whole days rounded up, never negative. */
export function remaining(expiresAt, now = new Date()) {
  const ms = Math.max(0, new Date(expiresAt).getTime() - now.getTime());
  return { ms, days: Math.ceil(ms / DAY_MS) };
}

/** Matches usernames containing `query`, case-insensitively, with regex characters taken literally. */
export function usernameSearch(query) {
  const q = text(query, 50);
  if (!q) return null;
  return { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
}
