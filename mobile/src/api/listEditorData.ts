import { getMovies, getSeries } from "./contentService";
import { getListSuggestions } from "./listService";
import { createLruCache } from "../utils/cache";
import { interleave, yearOf, type DraftItem } from "../utils/listDraft";

// Search and suggestions for the list editor, cached so the screen never
// asks twice for the same thing: typing back to an earlier query, or the
// same three titles producing the same suggestions, answers from memory.
// Each has one in-flight request per key, so a slow response and a repeat
// of the same query share one round trip.

const SEARCH_LIMIT = 12;
const PER_KIND_LIMIT = 10;

type CatalogDoc = {
  _id: string;
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
};

const fromMovie = (doc: CatalogDoc): DraftItem => ({
  id: String(doc._id),
  type: "movie",
  title: doc.title ?? doc.name ?? "",
  posterPath: doc.poster_path ?? null,
  year: yearOf(doc.release_date),
});

const fromSeries = (doc: CatalogDoc): DraftItem => ({
  id: String(doc._id),
  type: "series",
  title: doc.name ?? doc.title ?? "",
  posterPath: doc.poster_path ?? null,
  year: yearOf(doc.first_air_date),
});

const normalizeQuery = (query: string) => query.trim().replace(/\s+/g, " ").toLowerCase();

const searchCache = createLruCache<DraftItem[]>(40);
const searchesInFlight = new Map<string, Promise<DraftItem[]>>();

export function getCachedSearch(query: string): DraftItem[] | undefined {
  return searchCache.get(normalizeQuery(query));
}

/** Movies and series matching a query, alternating so both kinds show near the top. */
export function searchTitles(query: string): Promise<DraftItem[]> {
  const key = normalizeQuery(query);
  if (!key) return Promise.resolve([]);
  const cached = searchCache.get(key);
  if (cached) return Promise.resolve(cached);
  const existing = searchesInFlight.get(key);
  if (existing) return existing;

  const request = Promise.all([getMovies(1, PER_KIND_LIMIT, query.trim()), getSeries(1, PER_KIND_LIMIT, query.trim())]).then(
    ([movies, series]) => {
      const results = interleave(
        (movies.items as unknown as CatalogDoc[]).map(fromMovie),
        (series.items as unknown as CatalogDoc[]).map(fromSeries),
        SEARCH_LIMIT
      );
      searchCache.set(key, results);
      return results;
    }
  );
  searchesInFlight.set(key, request);
  request.catch(() => {}).finally(() => searchesInFlight.delete(key));
  return request;
}

const suggestionsCache = createLruCache<DraftItem[]>(30);
const suggestionsInFlight = new Map<string, Promise<DraftItem[]>>();

export function getCachedSuggestions(seedsKey: string): DraftItem[] | undefined {
  return suggestionsCache.get(seedsKey);
}

/**
 * Suggestions drawn from `seeds`, cached by `seedsKey`. Titles already on the
 * list are excluded by the server when fetched; the screen also filters out
 * anything added since, so adding a suggestion never needs a refetch.
 */
export function loadSuggestions(seedsKey: string, seeds: DraftItem[], onList: DraftItem[]): Promise<DraftItem[]> {
  const cached = suggestionsCache.get(seedsKey);
  if (cached) return Promise.resolve(cached);
  const existing = suggestionsInFlight.get(seedsKey);
  if (existing) return existing;

  const toRef = (item: DraftItem) => ({ itemId: item.id, itemType: item.type });
  // Oldest to newest, the order the server reads seeds in.
  const request = getListSuggestions([...seeds].reverse().map(toRef), onList.map(toRef)).then((items) => {
    const suggestions = items.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      posterPath: item.poster_path,
      year: yearOf(item.releaseDate),
    }));
    suggestionsCache.set(seedsKey, suggestions);
    return suggestions;
  });
  suggestionsInFlight.set(seedsKey, request);
  request.catch(() => {}).finally(() => suggestionsInFlight.delete(seedsKey));
  return request;
}
