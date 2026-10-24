import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { blockSets } from "../services/blockService.js";
import { suspensionActive } from "../utils/moderationActions.js";

// Every authenticated request looks its caller up here, and the mobile app
// routinely fires a burst of ~5-9 independent requests the instant a tab
// mounts (each rail/section fetching in parallel) — without this, every one
// of those redundantly re-fetches the exact same user document from the DB
// at almost the same instant, each paying its own full round trip. This
// coalesces concurrent lookups for the same id into one shared in-flight
// promise, so a burst like that pays for one round trip instead of N.
// Direct measurement against this app's own Atlas cluster: every single DB
// round trip costs ~300ms regardless of query complexity (cross-region
// network latency, not a query-plan problem — confirmed via a raw ping).
// A profile screen's own tab switches routinely fire 3-4 SEQUENTIAL
// requests a few hundred ms apart (not concurrent enough for the in-flight
// dedup above to catch), each independently re-paying that same 300ms tax
// just to re-verify the same still-logged-in user — direct ask to speed
// this up, and this fixed cost sits in front of literally every
// authenticated endpoint in the app, making it the single highest-leverage
// place to cut it.
//
// USER_CACHE_TTL_MS is a real, deliberate staleness window, not an
// oversight: within it, a just-changed field on `req.user` (e.g. a tier
// upgrade) can be briefly invisible to a DIFFERENT request for the same
// user. Kept short (3s) and judged an acceptable trade here specifically
// because nothing in this codebase relies on a same-request read-after-
// write of `req.user` — every mutation endpoint returns its own freshly
// written value directly in its response rather than re-deriving it from
// a later `req.user`, and the mobile client updates its own local
// AuthContext straight from those same mutation responses, never from
// waiting on a subsequent profile refetch.
const USER_CACHE_TTL_MS = 3000;
const userCache = new Map(); // id -> { user, cachedAt }
const pendingUserLookups = new Map();
function findUserById(id) {
  const cached = userCache.get(id);
  if (cached && Date.now() - cached.cachedAt < USER_CACHE_TTL_MS) {
    return Promise.resolve(cached.user);
  }
  let pending = pendingUserLookups.get(id);
  if (!pending) {
    pending = User.findById(id)
      .then((user) => {
        if (user) userCache.set(id, { user, cachedAt: Date.now() });
        return user;
      })
      .finally(() => pendingUserLookups.delete(id));
    pendingUserLookups.set(id, pending);
  }
  return pending;
}

/** What a suspended person is told: until when, or that it has no end. */
function suspensionMessage(until) {
  if (!until) return "Your account has been suspended.";
  const when = new Date(until).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `Your account is suspended until ${when}.`;
}

/** Clears a temporary suspension that has run out, and the cached copy of it. */
async function liftExpiredSuspension(userId) {
  await User.updateOne(
    { _id: userId },
    { $set: { isSuspended: false }, $unset: { suspendedUntil: 1, suspendedAt: 1, suspendedBy: 1, suspensionReason: 1 } }
  );
  invalidateUserCache(userId);
}

/** Forgets a cached user, so a change to their account applies immediately. */
export function invalidateUserCache(id) {
  userCache.delete(String(id));
}

export default async function authMiddleware(req, res, next) {
  try {
    // Authorization header: "Bearer <token>"
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization required" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Token not found" });

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) return res.status(401).json({ message: "Invalid token" });

    // The user, and everyone hidden from them by a block (in parallel —
    // both only need the id), for services/blockService.js's filtering.
    const [user, blocks] = await Promise.all([findUserById(decoded.id), blockSets(decoded.id)]);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Changing your password bumps User.tokenVersion, which invalidates
    // every token issued before that — ?? 0 on both sides so a token
    // signed before this field existed (no tokenVersion in its payload)
    // still matches an account that's never changed its password since
    // (tokenVersion still 0), rather than mass-logging-out every existing
    // session the moment this shipped.
    if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ message: "Session expired, please log in again", code: "token_revoked" });
    }
    // A suspended account keeps its token but loses the app: every
    // authenticated request is refused, and 401 is what makes the client
    // sign itself out rather than retry (mobile/src/api/client.ts).
    //
    // A temporary suspension lifts itself here, on the first request after
    // it runs out — no scheduled job, and the account is clean in the
    // database rather than only looking unsuspended.
    if (user.isSuspended) {
      if (suspensionActive(user)) {
        return res.status(401).json({
          message: suspensionMessage(user.suspendedUntil),
          code: "account_suspended",
          suspendedUntil: user.suspendedUntil ?? null,
        });
      }
      await liftExpiredSuspension(user._id);
      user.isSuspended = false;
      user.suspendedUntil = undefined;
    }

    // Attach user to request
    req.user = user;
    req.hiddenUsers = blocks.hidden;
    req.blockedByMe = blocks.blockedByMe;

    next();
  } catch (err) {
    return res.status(401).json({ message: "Token verification failed" });
  }
}

// Like authMiddleware but never blocks — attaches req.user if token is valid.
// Used on routes that return extra data for authenticated users (e.g. isMember).
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded?.id) {
        const [user, blocks] = await Promise.all([findUserById(decoded.id), blockSets(decoded.id)]);
        // Same tokenVersion check as authMiddleware above — a revoked
        // token should attach no user here either, not fall back to
        // "anonymous" on a route that otherwise treats that as fine.
        if (user && !user.isSuspended && (decoded.tokenVersion ?? 0) === (user.tokenVersion ?? 0)) {
          req.user = user;
          req.hiddenUsers = blocks.hidden;
          req.blockedByMe = blocks.blockedByMe;
        }
      }
    }
  } catch {
    // Invalid token — proceed without user attached
  }
  next();
};
