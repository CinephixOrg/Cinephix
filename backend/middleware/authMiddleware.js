import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Every authenticated request looks its caller up here, and the mobile app
// routinely fires a burst of ~5-9 independent requests the instant a tab
// mounts (each rail/section fetching in parallel) — without this, every one
// of those redundantly re-fetches the exact same user document from the DB
// at almost the same instant, each paying its own full round trip. This
// coalesces concurrent lookups for the same id into one shared in-flight
// promise, so a burst like that pays for one round trip instead of N. Not a
// TTL cache — no staleness risk: the pending promise is only handed to
// requests that arrive *while it's still in flight*, and is removed the
// moment it settles, so anything after that gets a fully fresh lookup.
// Safe to share the resulting document across concurrent requests since no
// controller mutates `req.user` in place (verified: only ever read, real
// writes go through `.save()` on a separately-fetched document).
const pendingUserLookups = new Map();
function findUserById(id) {
  let pending = pendingUserLookups.get(id);
  if (!pending) {
    pending = User.findById(id).finally(() => pendingUserLookups.delete(id));
    pendingUserLookups.set(id, pending);
  }
  return pending;
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

    // Find user by ID
    const user = await findUserById(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Attach user to request
    req.user = user;

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
        const user = await findUserById(decoded.id);
        if (user) req.user = user;
      }
    }
  } catch {
    // Invalid token — proceed without user attached
  }
  next();
};
