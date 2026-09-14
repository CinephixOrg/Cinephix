import {
  clearAllNotifications,
  deleteNotification,
  getNotificationPage,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notificationService";
import {
  appendPage,
  insertById,
  markAllReadIn,
  markReadById,
  mergeNewestPage,
  removeById,
} from "../utils/notificationFeed";
import type { Notification } from "../types";

// App-wide store behind the Notifications page.
//
//   * Stale-while-revalidate: reopening the page renders the cached list on
//     the first frame and refreshes underneath — no skeleton after the first
//     visit.
//   * Cursor pages with infinite scroll; one request per feed at a time.
//   * Two feeds, "all" and "unread", updated together by every action.
//   * Optimistic actions, rolled back if the server refuses.
//
// Plain module state with a subscribe function, read through
// useSyncExternalStore (useNotificationFeed), so a change re-renders only the
// screen that shows it.

export type FeedFilter = "all" | "unread";

export interface FeedState {
  items: Notification[];
  hasMore: boolean;
  /** Where the next page starts. */
  cursor: string | null;
}

const feeds: Record<FeedFilter, FeedState | null> = { all: null, unread: null };
const listeners = new Set<() => void>();
const refreshes = new Map<FeedFilter, Promise<number>>();
const loadsMore = new Map<FeedFilter, Promise<void>>();
let ownerId: string | null = null;

// A page can come back empty when every row in it belonged to a deleted
// account (the server drops those); keep going rather than stall the list.
const MAX_EMPTY_PAGES = 3;

const FILTERS: FeedFilter[] = ["all", "unread"];

function emit() {
  for (const listener of listeners) listener();
}

function update(filter: FeedFilter, next: FeedState | null) {
  if (feeds[filter] === next) return;
  feeds[filter] = next;
  emit();
}

/** Applies one change to both feeds and notifies once. */
function updateBoth(change: (state: FeedState, filter: FeedFilter) => FeedState) {
  let changed = false;
  for (const filter of FILTERS) {
    const state = feeds[filter];
    if (!state) continue;
    const next = change(state, filter);
    if (next !== state) {
      feeds[filter] = next;
      changed = true;
    }
  }
  if (changed) emit();
}

/** Forgets everything when the signed-in account changes. */
export function bindFeedOwner(userId: string) {
  if (ownerId === userId) return;
  ownerId = userId;
  feeds.all = null;
  feeds.unread = null;
  refreshes.clear();
  loadsMore.clear();
}

export function getFeed(filter: FeedFilter): FeedState | null {
  return feeds[filter];
}

export function subscribeFeeds(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Fetches the newest page and resolves with the total unread count. */
export function refreshFeed(filter: FeedFilter): Promise<number> {
  const existing = refreshes.get(filter);
  if (existing) return existing;

  const owner = ownerId;
  const request = getNotificationPage({ unreadOnly: filter === "unread" }).then((page) => {
    if (owner !== ownerId) return page.unreadCount;
    const current = feeds[filter];
    const items = current ? mergeNewestPage(current.items, page.items, page.hasMore) : page.items;
    // Older pages were kept below the fresh one: carry on from where they end.
    const keptOlder = current !== null && page.hasMore && items.length > page.items.length;
    update(filter, {
      items,
      hasMore: keptOlder ? current.hasMore : page.hasMore,
      cursor: keptOlder ? current.cursor : page.nextCursor,
    });
    return page.unreadCount;
  });

  refreshes.set(filter, request);
  request.catch(() => {}).finally(() => refreshes.delete(filter));
  return request;
}

export function loadMoreFeed(filter: FeedFilter): Promise<void> {
  const state = feeds[filter];
  if (!state || !state.hasMore || !state.cursor) return Promise.resolve();
  const existing = loadsMore.get(filter);
  if (existing) return existing;

  const owner = ownerId;
  const request = (async () => {
    let cursor: string | null = state.cursor;
    let hasMore = true;
    let older: Notification[] = [];
    for (let attempt = 0; attempt < MAX_EMPTY_PAGES && hasMore && older.length === 0; attempt++) {
      const page = await getNotificationPage({ before: cursor, unreadOnly: filter === "unread" });
      older = page.items;
      hasMore = page.hasMore;
      cursor = page.nextCursor ?? cursor;
    }
    const latest = feeds[filter];
    if (owner !== ownerId || !latest) return;
    update(filter, { items: appendPage(latest.items, older), hasMore, cursor });
  })();

  loadsMore.set(filter, request);
  request.catch(() => {}).finally(() => loadsMore.delete(filter));
  return request;
}

// ---- Actions ---------------------------------------------------------------------

/** Resolves once the server has it (or refused: low stakes, the next refresh corrects it). */
export function markRead(id: string): Promise<void> {
  updateBoth((state) => {
    const items = markReadById(state.items, id);
    return items === state.items ? state : { ...state, items };
  });
  return markNotificationRead(id).then(
    () => undefined,
    () => {
      // Low stakes: the read state corrects itself on the next refresh.
    }
  );
}

/** On the Unread feed, marking everything read leaves nothing to show. */
export async function markAllRead(): Promise<void> {
  updateBoth((state, filter) => {
    if (filter === "unread") return state.items.length === 0 && !state.hasMore ? state : { items: [], hasMore: false, cursor: null };
    const items = markAllReadIn(state.items);
    return items === state.items ? state : { ...state, items };
  });
  try {
    await markAllNotificationsRead();
  } catch (error) {
    // Put the real state back.
    await Promise.allSettled(FILTERS.map(refreshFeed));
    throw error;
  }
}

/** Removes a notification from the list without asking the server — for one it already deleted. */
export function dropNotification(id: string): void {
  updateBoth((state) => {
    const items = removeById(state.items, id);
    return items.length === state.items.length ? state : { ...state, items };
  });
}

/** Deletes a notification. Already gone on the server counts as success. */
export async function removeNotification(item: Notification): Promise<void> {
  const presentIn = FILTERS.filter((filter) => feeds[filter]?.items.some((existing) => existing._id === item._id));
  dropNotification(item._id);
  try {
    await deleteNotification(item._id);
  } catch (error: any) {
    if (error?.response?.status === 404) return;
    updateBoth((state, filter) => (presentIn.includes(filter) ? { ...state, items: insertById(state.items, item) } : state));
    throw error;
  }
}

export async function clearAll(): Promise<void> {
  updateBoth(() => ({ items: [], hasMore: false, cursor: null }));
  try {
    await clearAllNotifications();
  } catch (error) {
    await Promise.allSettled(FILTERS.map(refreshFeed));
    throw error;
  }
}
