import { getMovies, getSeries } from "./contentService";
import { createLruCache } from "../utils/cache";
import { searchKey, type RecommendQuery } from "../utils/recommend";
import type { Movie, Series } from "../types";

// The Recommend screen's title searches, remembered for a few minutes: going
// back to a search (deleting a letter, toggling a filter off, reopening the
// screen) shows its results at once instead of a spinner.

const FRESH_MS = 5 * 60_000;
const PAGE_SIZE = 20;

type Titles = (Movie | Series)[];

const results = createLruCache<{ items: Titles; at: number }>(40);

/** The results this search had last time, while still fresh. */
export function cachedSearch(query: RecommendQuery): Titles | undefined {
  const hit = results.get(searchKey(query));
  return hit && Date.now() - hit.at < FRESH_MS ? hit.items : undefined;
}

export async function searchTitles(query: RecommendQuery): Promise<Titles> {
  const filters = { years: query.years, genres: query.genres };
  const title = query.query.trim() || undefined;
  const { items } =
    query.type === "movie" ? await getMovies(1, PAGE_SIZE, title, filters) : await getSeries(1, PAGE_SIZE, title, filters);
  results.set(searchKey(query), { items, at: Date.now() });
  return items;
}
