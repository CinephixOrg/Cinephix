import mongoose from "mongoose";
import User from "../models/User.js";
import FootprintEvent from "../models/FootprintEvent.js";
import { retractFollow } from "./notifications.js";

// Blocking: who each person can't see, and changing it.
//
// A block is recorded on the blocker (User.blockedUsers) but works both
// ways — the two people become invisible to each other. So the set of people
// hidden from someone is everyone they blocked plus everyone who blocked
// them. It's needed on nearly every request, so it's cached per user for a
// short while and dropped for both people the moment a block changes.

const CACHE_MS = 60_000;
const cache = new Map(); // userId -> { hidden: Set<string>, blockedByMe: Set<string>, at }

/** Forgets the cached hidden sets of these users (both sides of a block). */
export function invalidateHidden(...userIds) {
  for (const id of userIds) cache.delete(String(id));
}

/**
 * The user's block sets, as Sets of id strings: `hidden` is everyone hidden
 * from them (both directions); `blockedByMe` is the part they chose, which
 * they can still open to undo (a profile shows "You blocked this user").
 *
 * Read fresh from the database (not from the request's user document, which
 * the auth middleware caches for a few seconds and could predate a block
 * that just happened): one query returns this user, with their own block
 * list, together with everyone whose block list includes them.
 */
export async function blockSets(userId) {
  const key = String(userId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit;

  const rows = await User.find({ $or: [{ _id: userId }, { blockedUsers: userId }] })
    .select("_id blockedUsers")
    .lean();
  const entry = { hidden: hiddenFromRows(key, rows), blockedByMe: blockedByMeFromRows(key, rows), at: Date.now() };
  cache.set(key, entry);
  // Keeps the cache bounded on a long-running server.
  if (cache.size > 10_000) cache.delete(cache.keys().next().value);
  return entry;
}

/** Everyone hidden from this user, as a Set of id strings. */
export async function hiddenUserIds(userId) {
  return (await blockSets(userId)).hidden;
}

/**
 * The hidden set from that query's rows: the user's own row contributes the
 * people they blocked; every other row is someone who blocked them.
 */
export function hiddenFromRows(userId, rows) {
  const key = String(userId);
  const ids = new Set();
  for (const row of rows) {
    if (String(row._id) === key) for (const id of row.blockedUsers ?? []) ids.add(String(id));
    else ids.add(String(row._id));
  }
  ids.delete(key);
  return ids;
}

/** Just the people this user blocked themselves, from the same rows. */
export function blockedByMeFromRows(userId, rows) {
  const key = String(userId);
  const own = rows.find((row) => String(row._id) === key);
  const ids = new Set((own?.blockedUsers ?? []).map(String));
  ids.delete(key);
  return ids;
}

/** Whether either of the two has blocked the other. */
export async function eitherBlocked(a, b) {
  if (!a || !b || String(a) === String(b)) return false;
  return Boolean(
    await User.exists({
      $or: [
        { _id: a, blockedUsers: b },
        { _id: b, blockedUsers: a },
      ],
    })
  );
}

/**
 * Blocks `targetId` for `blocker`. Also ends any follow between them in
 * either direction (with its notification and activity record), since a
 * follow means seeing each other's content.
 */
export async function blockUser(blocker, targetId) {
  const blockerId = blocker._id;
  const target = new mongoose.Types.ObjectId(String(targetId));
  await Promise.all([
    User.updateOne({ _id: blockerId }, { $addToSet: { blockedUsers: target }, $pull: { following: target, followers: target } }),
    User.updateOne({ _id: target }, { $pull: { following: blockerId, followers: blockerId } }),
    FootprintEvent.deleteMany({
      type: "followed",
      $or: [
        { user: blockerId, targetUser: target },
        { user: target, targetUser: blockerId },
      ],
    }),
    retractFollow({ recipientId: target, senderId: blockerId }),
    retractFollow({ recipientId: blockerId, senderId: target }),
  ]);
  invalidateHidden(blockerId, target);
}

export async function unblockUser(blocker, targetId) {
  await User.updateOne({ _id: blocker._id }, { $pull: { blockedUsers: new mongoose.Types.ObjectId(String(targetId)) } });
  invalidateHidden(blocker._id, targetId);
}
