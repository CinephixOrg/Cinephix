import { getPublicCollection } from "./userService";
import { ensureContent, entryFor, sameEntries } from "./collectionCache";
import { createLruCache } from "../utils/cache";
import type { CollectionEntry } from "../utils/collectionQuery";

// Cache behind the public profile's Watched List / Watchlist pages.
//
// Same approach as the personal lists (collectionCache.ts): the server sends
// ids, and titles and posters come from the shared content cache — two bulk
// requests at most, and none for titles already seen anywhere in the app.
// Stale-while-revalidate, one in-flight request per list, and an unchanged
// list keeps its identity so an open page doesn't rebuild its search index.

export type PublicCollectionKind = "watched" | "watchlist";

export interface PublicCollection {
  entries: CollectionEntry[];
  fetchedAt: number;
}

// Someone else's list changes rarely while you look at it; revisiting within
// this window shows the cached copy without asking the server again.
const FRESH_MS = 30_000;

const cache = createLruCache<PublicCollection>(16);
const inFlight = new Map<string, Promise<PublicCollection>>();

const keyOf = (userId: string, kind: PublicCollectionKind) => `${userId}:${kind}`;

export function getCachedPublicCollection(userId: string, kind: PublicCollectionKind): PublicCollection | undefined {
  return cache.get(keyOf(userId, kind));
}

export function isPublicCollectionFresh(collection: PublicCollection | undefined): boolean {
  return !!collection && Date.now() - collection.fetchedAt < FRESH_MS;
}

/** Always hits the network (shared while in flight); callers decide whether to wait. */
export function loadPublicCollection(userId: string, kind: PublicCollectionKind): Promise<PublicCollection> {
  const key = keyOf(userId, kind);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const request = (async () => {
    const { items } = await getPublicCollection(userId, kind);
    await ensureContent(items);

    const entries: CollectionEntry[] = [];
    items.forEach((item, index) => {
      const entry = entryFor(item.itemId, item.itemType, index, item.rating ?? null);
      if (entry) entries.push(entry);
    });

    const previous = cache.get(key);
    const unchanged = previous && sameEntries(previous.entries, entries);
    const next: PublicCollection = {
      entries: unchanged ? previous.entries : entries,
      fetchedAt: Date.now(),
    };
    cache.set(key, next);
    return next;
  })();

  inFlight.set(key, request);
  request.catch(() => {}).finally(() => inFlight.delete(key));
  return request;
}

/** Warms a list in the background unless a fresh copy is already cached. */
export function prefetchPublicCollection(userId: string, kind: PublicCollectionKind): void {
  if (isPublicCollectionFresh(getCachedPublicCollection(userId, kind))) return;
  loadPublicCollection(userId, kind).catch(() => {
    // Silent — the page retries when it opens.
  });
}

/** Drops both of a user's cached lists, so the next open loads them fresh. */
export function invalidatePublicCollections(userId: string): void {
  cache.delete(keyOf(userId, "watched"));
  cache.delete(keyOf(userId, "watchlist"));
}

/** All cached lists, e.g. on sign-out. */
export function clearPublicCollectionCache(): void {
  cache.clear();
  inFlight.clear();
}
