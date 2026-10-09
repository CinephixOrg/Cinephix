import User from "../models/User.js";
import TierGrantLog from "../models/TierGrantLog.js";
import { invalidateUserCache } from "../middleware/authMiddleware.js";
import { endGrantUpdate, grantExpired, tierAfterGrant } from "../utils/tierGrants.js";

// Admin-granted tiers against the database: ending a grant that has run out,
// and the audit log. The rules themselves are in utils/tierGrants.js; the
// admin endpoints are in controllers/tierGrantController.js.
//
// A grant ends in two ways, whichever comes first: on the person's next
// authenticated request or login (expireTierGrantIfDue, like a temporary
// suspension lifting itself), or in the hourly sweep (expireDueTierGrants),
// so someone who stops opening the app stops looking Premium to others too.

/** Records one grant change. An audit write failing never undoes the change itself. */
export async function logTierGrant(entry) {
  try {
    await TierGrantLog.create(entry);
  } catch (error) {
    console.error("Tier grant audit log failed:", error?.message || error);
  }
}

/**
 * Ends this account's grant if it has run out: accountTier goes back to the
 * tier from before it. `user` (a document or a plain object) is updated in
 * place, so the caller can go on using it. Resolves true when it ended one.
 */
export async function expireTierGrantIfDue(user, now = new Date()) {
  if (!grantExpired(user, now)) return false;
  const grant = user.tierGrant;
  const tierAfter = tierAfterGrant(user);
  // Only the grant that was read: one re-granted meanwhile stays.
  const result = await User.updateOne({ _id: user._id, "tierGrant.expiresAt": grant.expiresAt }, endGrantUpdate(user, now));
  invalidateUserCache(user._id);
  if (result.modifiedCount > 0) {
    await logTierGrant({
      action: "expire",
      user: user._id,
      username: user.username,
      tier: grant.tier,
      tierBefore: user.accountTier,
      tierAfter,
      expiresAtBefore: grant.expiresAt,
    });
  }
  user.accountTier = tierAfter;
  user.tierGrant = undefined;
  return result.modifiedCount > 0;
}

/** The hourly sweep: ends every grant that has run out. Resolves with how many. */
export async function expireDueTierGrants(now = new Date()) {
  const due = await User.find({ "tierGrant.expiresAt": { $lte: now } })
    .select("_id username accountTier tierGrant")
    .lean();
  let ended = 0;
  for (const user of due) {
    if (await expireTierGrantIfDue(user, now)) ended++;
  }
  return ended;
}
