import { getMyActivity } from "./activityService";
import { createLruCache } from "../utils/cache";
import { activityQueryKey, type ActivityFilters } from "../utils/personalActivity";
import type { PersonalActivityItem } from "../types";

// The Activity page's feeds, one per filter combination, so switching back
// to a range or type you've looked at shows it on the first frame and only
// refreshes underneath. Requests for the same page of the same feed share
// one round trip.
//
// Your own history, so everything is dropped when the signed-in user changes.

export const ACTIVITY_PAGE_SIZE = 20;
// A revisit within this long doesn't refresh at all.
export const ACTIVITY_FRESH_MS = 5_000;

export interface ActivityFeed {
  items: PersonalActivityItem[];
  /** How many pages `items` holds. */
  page: number;
  hasMore: boolean;
  fetchedAt: number;
}

const feeds = createLruCache<ActivityFeed>(16);
const inFlight = new Map<string, Promise<{ items: PersonalActivityItem[]; hasMore: boolean }>>();
let ownerId: string | null = null;

/** Call with the signed-in user's id before reading; a different user starts from nothing. */
export function setActivityOwner(userId: string | null | undefined) {
  const next = userId ?? null;
  if (next === ownerId) return;
  ownerId = next;
  feeds.clear();
  inFlight.clear();
}

export function cachedActivity(filters: ActivityFilters): ActivityFeed | undefined {
  return feeds.get(activityQueryKey(filters));
}

export function rememberActivity(filters: ActivityFilters, feed: ActivityFeed) {
  feeds.set(activityQueryKey(filters), feed);
}

export function fetchActivityPage(filters: ActivityFilters, page: number) {
  const key = `${activityQueryKey(filters)}#${page}`;
  let request = inFlight.get(key);
  if (!request) {
    const owner = ownerId;
    request = getMyActivity(filters, page, ACTIVITY_PAGE_SIZE)
      .then(({ items, hasMore }) => ({ items, hasMore }))
      .finally(() => {
        if (inFlight.get(key) === request && owner === ownerId) inFlight.delete(key);
      });
    inFlight.set(key, request);
  }
  return request;
}

/** Loads a feed's first page into the cache ahead of time, unless it's already there. */
export function prefetchActivity(filters: ActivityFilters) {
  if (feeds.get(activityQueryKey(filters))) return;
  const owner = ownerId;
  fetchActivityPage(filters, 1)
    .then(({ items, hasMore }) => {
      if (owner !== ownerId || feeds.get(activityQueryKey(filters))) return;
      rememberActivity(filters, { items, page: 1, hasMore, fetchedAt: Date.now() });
    })
    .catch(() => {});
}

/** Drops every cached feed — e.g. after a block, which changes who appears in them. */
export function clearActivityCache() {
  feeds.clear();
  inFlight.clear();
}
