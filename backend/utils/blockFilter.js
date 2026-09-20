// What "blocked people are invisible" means for a response body, as pure
// functions (tested in blockFilter.test.js without a server or database).
//
// The rule: in any list anywhere in a response, an entry that is a hidden
// person, or was made by one, is left out. Entries are never edited, and a
// single object that isn't in a list is never removed — an endpoint that
// returns one thing (a profile, a list, a post) decides for itself, since
// "not found" is its call, not a filter's.

// Fields that name who made or owns an entry, across this API's shapes:
// reviews/ratings/shares (user), lists (owner), messages and notifications
// (sender), activity (actor), inbox rows (otherUser), comments (author),
// leaderboard and candidate rows (user), activity about someone (targetUser).
// Deliberately not a community's lastMessageSenderId: the community itself
// isn't the blocked person's (the inbox blanks that preview instead).
export const AUTHOR_KEYS = ["user", "owner", "sender", "actor", "author", "otherUser", "targetUser"];

/** The id behind a raw id, an ObjectId, or a populated document; otherwise null. */
export function idOf(value) {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    // An ObjectId (bson) stringifies to its hex; a populated doc has _id.
    if (value._bsontype === "ObjectId" || value._bsontype === "ObjectID") return value.toString();
    if (value._id != null) return idOf(value._id);
  }
  return null;
}

/** Whether a list entry is a hidden person, or belongs to one. */
export function isHiddenEntry(entry, hidden) {
  if (!entry || typeof entry !== "object" || hidden.size === 0) return false;
  // A person themselves: search results, followers, members, likers.
  if (typeof entry.username === "string" && hidden.has(idOf(entry._id) ?? "")) return true;
  for (const key of AUTHOR_KEYS) {
    if (!(key in entry)) continue;
    const id = idOf(entry[key]);
    if (id && hidden.has(id)) return true;
  }
  return false;
}

/**
 * The value with every hidden entry removed from every list inside it, at
 * any depth. Returns the same value when there's nothing to hide, and only
 * copies the parts that changed.
 */
export function stripHidden(value, hidden) {
  if (!hidden || hidden.size === 0) return value;
  return strip(value, hidden, new WeakSet());
}

function strip(value, hidden, seen) {
  if (value === null || typeof value !== "object") return value;
  // Ids and dates are leaves, and cycles (rare in JSON, possible in lean docs) end here.
  if (value instanceof Date || value._bsontype || seen.has(value)) return value;
  seen.add(value);

  if (Array.isArray(value)) {
    let changed = false;
    const out = [];
    for (const item of value) {
      if (isHiddenEntry(item, hidden)) {
        changed = true;
        continue;
      }
      const next = strip(item, hidden, seen);
      if (next !== item) changed = true;
      out.push(next);
    }
    return changed ? out : value;
  }

  let copy = null;
  for (const key of Object.keys(value)) {
    const item = value[key];
    const next = strip(item, hidden, seen);
    if (next !== item) {
      copy ??= { ...value };
      copy[key] = next;
    }
  }
  return copy ?? value;
}
