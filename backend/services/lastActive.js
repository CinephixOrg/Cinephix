import User from "../models/User.js";
import { lastActiveDue } from "../utils/lastActive.js";

// Records User.lastActiveAt from authMiddleware, throttled per user
// (utils/lastActive.js) and never awaited: a request doesn't wait on it, and
// a failed write only means a slightly older "last active".
//
// This server's own last write per user is remembered as well as the
// document's value, because the auth middleware caches user documents for a
// few seconds and a burst of requests would otherwise all see the old time.

const lastWritten = new Map(); // userId -> ms
const MAX_TRACKED = 50_000;

/** Marks this user active now, if they weren't marked recently. Resolves nothing; returns whether it wrote. */
export function touchLastActive(user, now = new Date()) {
  if (!user?._id) return false;
  const id = String(user._id);
  const stored = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
  if (!lastActiveDue(Math.max(lastWritten.get(id) ?? 0, stored), now)) return false;

  lastWritten.set(id, now.getTime());
  if (lastWritten.size > MAX_TRACKED) lastWritten.delete(lastWritten.keys().next().value);
  user.lastActiveAt = now;
  // timestamps: false — being active isn't an edit to the account.
  User.updateOne({ _id: user._id }, { $set: { lastActiveAt: now } }, { timestamps: false }).catch((error) =>
    console.error("lastActiveAt update failed:", error?.message || error)
  );
  return true;
}

/** For tests: forget every recorded write. */
export function resetLastActiveTracking() {
  lastWritten.clear();
}
