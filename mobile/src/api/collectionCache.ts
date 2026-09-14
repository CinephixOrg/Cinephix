import { getWatchlist, removeFromWatchlist } from "./watchlistService";
import { getToWatchList, removeFromToWatchList } from "./toWatchService";
import { getMoviesBulk, getSeriesBulk, type LightweightContent } from "./contentService";
import { getUserRatings } from "./ratingService";
import type { ContentType, WatchlistItem } from "../types";
import type { CollectionEntry } from "../utils/collectionQuery";

// App-wide caches behind the Watched List and the Watchlist.
//
// Both screens used to fetch their list and then request every title
// individually — one round trip per movie or series, repeated on every visit,
// behind a loading skeleton. Each cache replaces that with:
//
//   * two bulk requests (movies, series) instead of one per title, and only
//     for titles not already cached — posters and titles never change, so a
//     revisit typically needs no content requests at all. The content cache
//     is shared, so a title on both lists is fetched once;
//   * stale-while-revalidate: a revisit renders the cached list on the first
//     frame and quietly refreshes underneath;
//   * one shared in-flight request, so a focus and a pull-to-refresh racing
//     each other cost a single round trip;
//   * optimistic removal that survives a refresh landing mid-undo.

interface ContentInfo {
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  popularity: number;
}

// A revisit within this window skips the refresh entirely. Anything that
// changes a list from elsewhere calls invalidate() instead of waiting it out.
const FRESH_MS = 5_000;

const contentCache = new Map<string, ContentInfo>();

const keyOf = (type: ContentType, id: string) => `${type}:${id}`;

function toInfo(doc: LightweightContent, type: ContentType): ContentInfo {
  const title = type === "movie" ? doc.title ?? doc.name : doc.name ?? doc.title;
  return {
    title: title ?? "",
    posterPath: doc.poster_path ?? null,
    releaseDate: (type === "movie" ? doc.release_date : doc.first_air_date) ?? null,
    popularity: typeof doc.popularity === "number" ? doc.popularity : 0,
  };
}

/**
 * Fetches, in at most two bulk requests, whichever of these titles isn't in
 * the shared content cache yet. Shared with the public profile's list sheets
 * (publicCollectionCache.ts).
 */
export async function ensureContent(list: { itemId: string; itemType: ContentType }[]): Promise<void> {
  const missingMovies: string[] = [];
  const missingSeries: string[] = [];
  for (const item of list) {
    const id = String(item.itemId);
    if (contentCache.has(keyOf(item.itemType, id))) continue;
    if (item.itemType === "movie") missingMovies.push(id);
    else if (item.itemType === "series") missingSeries.push(id);
  }
  if (missingMovies.length === 0 && missingSeries.length === 0) return;

  const [movies, series] = await Promise.all([getMoviesBulk(missingMovies), getSeriesBulk(missingSeries)]);
  for (const doc of movies) contentCache.set(keyOf("movie", String(doc._id)), toInfo(doc, "movie"));
  for (const doc of series) contentCache.set(keyOf("series", String(doc._id)), toInfo(doc, "series"));
}

/** A renderable entry built from cached content, or null when the title isn't in the catalogue. */
export function entryFor(id: string, type: ContentType, order: number, rating: number | null): CollectionEntry | null {
  const info = contentCache.get(keyOf(type, id));
  if (!info) return null;
  return {
    id,
    type,
    title: info.title,
    posterPath: info.posterPath,
    releaseDate: info.releaseDate,
    popularity: info.popularity,
    rating,
    order,
  };
}

// Cheap equality for the refresh path, so an unchanged list keeps its
// identity and the screen doesn't rebuild its search index for nothing.
export function sameEntries(a: CollectionEntry[], b: CollectionEntry[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.type !== y.type ||
      x.order !== y.order ||
      x.rating !== y.rating ||
      x.title !== y.title ||
      x.posterPath !== y.posterPath
    ) {
      return false;
    }
  }
  return true;
}

export interface CollectionCache {
  subscribe(listener: (next: CollectionEntry[]) => void): () => void;
  /** The cached list for this user, or null if nothing has loaded yet. */
  getCached(userId: string): CollectionEntry[] | null;
  isFresh(): boolean;
  /** Marks the list as changed elsewhere, so the next visit refreshes. */
  invalidate(): void;
  /**
   * Fetches the list, reusing cached content, and notifies subscribers.
   * Always hits the network — callers decide whether to wait on it.
   */
  load(userId: string): Promise<CollectionEntry[]>;
  /** Removes a title from the visible list without telling the server yet. */
  hide(entry: CollectionEntry): void;
  /** Puts a hidden title back in its original position. */
  restore(entry: CollectionEntry): void;
  /**
   * Sends the delete for a hidden title. On failure the title is restored and
   * the error rethrown for the caller to report.
   */
  commitRemoval(entry: CollectionEntry): Promise<void>;
}

interface Options {
  fetchList: () => Promise<WatchlistItem[]>;
  removeItem: (id: string, type: ContentType) => Promise<unknown>;
  /** Merge the user's own ratings into the entries (Watched List only). */
  withRatings: boolean;
}

export function createCollectionCache({ fetchList, removeItem, withRatings }: Options): CollectionCache {
  const listeners = new Set<(entries: CollectionEntry[]) => void>();
  // Removed optimistically, delete not yet sent (or not yet confirmed). A
  // refresh that lands in that window must not bring these back.
  const pendingRemoval = new Set<string>();
  // When each confirmed delete landed. A refresh that started before then can
  // still carry the deleted title in its response, so for that refresh the
  // delete wins; the entry is dropped once a refresh starts after it.
  const confirmedRemoval = new Map<string, number>();

  let entries: CollectionEntry[] | null = null;
  let ownerId: string | null = null;
  let fetchedAt = 0;
  let stale = true;
  let inFlight: Promise<CollectionEntry[]> | null = null;

  const emit = () => {
    if (!entries) return;
    for (const listener of listeners) listener(entries);
  };

  const reset = (userId: string) => {
    entries = null;
    ownerId = userId;
    fetchedAt = 0;
    stale = true;
    inFlight = null;
    pendingRemoval.clear();
    confirmedRemoval.clear();
  };

  const restore = (entry: CollectionEntry) => {
    pendingRemoval.delete(keyOf(entry.type, entry.id));
    confirmedRemoval.delete(keyOf(entry.type, entry.id));
    if (!entries || entries.some((e) => e.id === entry.id && e.type === entry.type)) return;
    entries = [...entries, entry].sort((a, b) => a.order - b.order);
    emit();
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getCached: (userId) => (ownerId === userId ? entries : null),

    isFresh: () => !stale && Date.now() - fetchedAt < FRESH_MS,

    invalidate() {
      stale = true;
    },

    load(userId) {
      if (ownerId !== userId) reset(userId);
      if (inFlight) return inFlight;

      const request = (async () => {
        const startedAt = Date.now();
        // Ratings failing shouldn't blank the list — keep whatever ratings the
        // current entries already carry instead.
        const [list, ratings] = await Promise.all([
          fetchList(),
          withRatings ? getUserRatings(userId).catch(() => null) : Promise.resolve(null),
        ]);

        await ensureContent(list);

        // The account changed while this was in flight; its result belongs to
        // nobody now.
        if (ownerId !== userId) return entries ?? [];

        const ratingByKey = ratings
          ? new Map(ratings.map((r) => [keyOf(r.contentType, String(r.contentId)), r.value]))
          : null;
        const previousRating = new Map((entries ?? []).map((e) => [keyOf(e.type, e.id), e.rating]));

        const next: CollectionEntry[] = [];
        list.forEach((item, index) => {
          const id = String(item.itemId);
          const key = keyOf(item.itemType, id);
          if (pendingRemoval.has(key)) return;
          const confirmedAt = confirmedRemoval.get(key);
          if (confirmedAt !== undefined) {
            if (confirmedAt >= startedAt) return;
            confirmedRemoval.delete(key);
          }
          const rating = !withRatings ? null : ratingByKey ? ratingByKey.get(key) ?? null : previousRating.get(key) ?? null;
          // Null when the title is missing from the catalogue (deleted upstream).
          const entry = entryFor(id, item.itemType, index, rating);
          if (entry) next.push(entry);
        });

        fetchedAt = Date.now();
        stale = false;
        if (!entries || !sameEntries(entries, next)) {
          entries = next;
          emit();
        }
        return entries;
      })();

      inFlight = request;
      request
        .catch(() => {})
        .finally(() => {
          if (inFlight === request) inFlight = null;
        });
      return request;
    },

    hide(entry) {
      pendingRemoval.add(keyOf(entry.type, entry.id));
      if (!entries) return;
      entries = entries.filter((e) => !(e.id === entry.id && e.type === entry.type));
      emit();
    },

    restore,

    async commitRemoval(entry) {
      try {
        await removeItem(entry.id, entry.type);
        const key = keyOf(entry.type, entry.id);
        confirmedRemoval.set(key, Date.now());
        pendingRemoval.delete(key);
      } catch (error) {
        restore(entry);
        throw error;
      }
    },
  };
}

/** The Watched List. Removing a title there also deletes its rating server-side. */
export const watchedCache = createCollectionCache({
  fetchList: getWatchlist,
  removeItem: removeFromWatchlist,
  withRatings: true,
});

/** The Watchlist (the to-watch queue). */
export const toWatchCache = createCollectionCache({
  fetchList: getToWatchList,
  removeItem: removeFromToWatchList,
  withRatings: false,
});
