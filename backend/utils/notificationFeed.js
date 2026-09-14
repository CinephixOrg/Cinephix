// Query parsing and page shaping for GET /api/notifications.
//
// Pure, so the paging rules are unit-tested (notificationFeed.test.js).

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

const OBJECT_ID = /^[0-9a-f]{24}$/i;

const toInt = (value, fallback) => {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : fallback;
};

const isTrue = (value) => value === "1" || value === "true";

/**
 * Two paging modes:
 *
 *   cursor (?cursor=1, then &before=<id>) — the app. Newest first by _id, and
 *     each page continues strictly before the last id already received, so
 *     deleting notifications while scrolling can't make the next page skip or
 *     repeat any.
 *   page (?page=N) — the web client, which pages with numbered buttons.
 *
 * Both accept &unread=1 and a limit, capped so a request can't ask for the
 * whole collection at once.
 */
export function parseFeedQuery(query = {}) {
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, toInt(query.limit, DEFAULT_PAGE_SIZE)));
  const before = typeof query.before === "string" && OBJECT_ID.test(query.before) ? query.before : null;
  return {
    limit,
    before,
    cursor: isTrue(query.cursor) || before !== null,
    unreadOnly: isTrue(query.unread),
    page: Math.max(1, toInt(query.page, 1)),
  };
}

export function buildFeedFilter(userId, { before = null, unreadOnly = false } = {}) {
  const filter = { user: userId };
  if (unreadOnly) filter.read = false;
  if (before) filter._id = { $lt: before };
  return filter;
}

/**
 * Shapes one cursor page from up to `limit + 1` documents fetched newest
 * first, with `sender` populated.
 *
 * A notification whose sender account no longer exists comes back with a
 * null sender — there's no one to show or open, and the app used to crash
 * reading its username — so it's dropped. The cursor still advances past it,
 * so a run of such rows can't stall paging.
 */
export function shapeCursorPage(docs, limit) {
  const page = docs.slice(0, limit);
  return {
    items: page.filter((doc) => doc.sender),
    hasMore: docs.length > limit,
    nextCursor: page.length > 0 ? String(page[page.length - 1]._id) : null,
  };
}
