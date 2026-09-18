// The personal activity feed's rules: which activity types a filter covers,
// how a request is read, and how several time-sorted sources merge into one
// page. Pure, so it's tested without a database (activityFeed.test.js).

// Every type the feed can show, grouped the way the app's "Activity type"
// filter offers them. Order here is the menu's order.
export const ACTIVITY_CATEGORIES = {
  ratings: ["rated"],
  reviews: ["reviewed"],
  likes: ["review_liked"],
  list_likes: ["list_liked"],
  follows: ["followed"],
  lists: ["list_created"],
  watched: ["watchlist_added", "towatch_added"],
  favorites: ["favorited"],
  communities: ["group_joined"],
  shares: ["shared"],
  cinematch: ["match_analyzed", "profile_analyzed"],
};

export const ALL_ACTIVITY_TYPES = Object.values(ACTIVITY_CATEGORIES).flat();

const RANGE_DAYS = { week: 7, month: 30 };
export const MAX_ACTIVITY_LIMIT = 50;
// Deep pages would make every source fetch page×limit rows; nobody scrolls
// a personal history this far, and it keeps one request bounded.
export const MAX_ACTIVITY_PAGE = 25;

/**
 * Reads ?range=week|month|all, ?categories=ratings,likes,… (a comma list of
 * ACTIVITY_CATEGORIES keys; absent or empty means everything), ?page, ?limit.
 * Anything unrecognised falls back to the default rather than failing.
 */
export function parseActivityQuery(query = {}, now = new Date()) {
  const range = query.range === "month" || query.range === "all" ? query.range : "week";
  const cutoff = range === "all" ? null : new Date(now.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000);
  const page = Math.min(MAX_ACTIVITY_PAGE, Math.max(1, parseInt(query.page, 10) || 1));
  const limit = Math.min(MAX_ACTIVITY_LIMIT, Math.max(1, parseInt(query.limit, 10) || 10));

  const requested = String(query.categories ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter((key) => Object.prototype.hasOwnProperty.call(ACTIVITY_CATEGORIES, key));
  const types = new Set(requested.length > 0 ? requested.flatMap((key) => ACTIVITY_CATEGORIES[key]) : ALL_ACTIVITY_TYPES);

  return { range, cutoff, page, limit, types };
}

/** Newest first; equal times fall back to the key, so the order never shifts between requests. */
export function compareEvents(a, b) {
  const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  if (diff !== 0) return diff;
  return a.key < b.key ? 1 : a.key > b.key ? -1 : 0;
}

/**
 * One page from several sources, each already newest-first and fetched with
 * at most `cap` rows (cap = page × limit). If a source came back full, it may
 * have more beyond what was fetched, so there is more to load even when the
 * merged list happens to end exactly on this page.
 */
export function mergeActivityPage(sources, { page, limit, cap }) {
  const merged = sources.flatMap((source) => source.events).sort(compareEvents);
  const start = (page - 1) * limit;
  const items = merged.slice(start, start + limit);
  const truncated = sources.some((source) => source.events.length >= cap);
  return { items, hasMore: merged.length > start + limit || (truncated && merged.length >= start + limit) };
}

/**
 * Follows: the explicit follow log first, then older follows recovered from
 * follow notifications (sent before the log existed) — only people still
 * followed, one event per person, the log's time winning.
 */
export function mergeFollowEvents(logged, notified, stillFollowing) {
  const byTarget = new Map();
  for (const event of [...logged, ...notified]) {
    const target = String(event.targetId);
    if (!stillFollowing.has(target) || byTarget.has(target)) continue;
    byTarget.set(target, event);
  }
  return [...byTarget.values()].sort(compareEvents);
}
