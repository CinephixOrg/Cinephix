// The Recommend screen's rules: when to search, how a search is cached, and
// what a picked title sends along with the recommendation.
//
// Pure and React-free so it runs under `node --test` (recommend.test.mts).

import type { ContentType, Movie, Series } from "../types";

export interface RecommendQuery {
  type: ContentType;
  query: string;
  years: string[];
  genres: number[];
}

export const DEFAULT_RECOMMEND_QUERY: RecommendQuery = { type: "movie", query: "", years: [], genres: [] };

/** A search runs once there's text or a filter to search by — an empty screen asks for neither. */
export function shouldSearch(query: RecommendQuery): boolean {
  return query.query.trim().length > 0 || query.years.length > 0 || query.genres.length > 0;
}

/** Everything that changes a search's results, in a stable order, so equal searches share a cache entry. */
export function searchKey(query: RecommendQuery): string {
  const years = [...query.years].sort().join(",");
  const genres = [...query.genres].sort((a, b) => a - b).join(",");
  return `${query.type}|${query.query.trim().toLowerCase()}|${years}|${genres}`;
}

/** The filter button's badge: Series (Movies is the default), each year and each genre. */
export function recommendFilterCount(query: RecommendQuery): number {
  return (query.type === "series" ? 1 : 0) + query.years.length + query.genres.length;
}

export function toggleIn<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

export interface PickedContent {
  contentType: ContentType;
  contentId: string;
  title: string;
  posterUrl?: string;
  genres: string[];
  releaseYear?: number;
  overview?: string;
  rating?: number;
}

export function titleOf(item: Movie | Series): string {
  return "title" in item ? item.title : item.name;
}

export function yearOf(item: Movie | Series): number | undefined {
  const date = "title" in item ? item.release_date : item.first_air_date;
  const year = date ? Number(date.slice(0, 4)) : NaN;
  return Number.isFinite(year) && year > 0 ? year : undefined;
}

/**
 * A search result as the recommendation carries it. Genre ids become names
 * (at most three) so the chat card can say what kind of title it is without
 * looking anything up.
 */
/** Up to three genre names for a title's genre ids, in the title's own order. */
export function genreNames(ids: readonly number[] | undefined, genreOptions: readonly { id: number; name: string }[]): string[] {
  const names = new Map(genreOptions.map((genre) => [genre.id, genre.name]));
  return (ids ?? [])
    .map((id) => names.get(id))
    .filter((name): name is string => Boolean(name))
    .slice(0, 3);
}

export function toPicked(
  item: Movie | Series,
  type: ContentType,
  genreOptions: readonly { id: number; name: string }[]
): PickedContent {
  const genres = genreNames(item.genre_ids, genreOptions);
  return {
    contentType: type,
    contentId: item._id,
    title: titleOf(item),
    posterUrl: item.poster_path || undefined,
    genres,
    releaseYear: yearOf(item),
    overview: item.overview || undefined,
    rating: typeof item.vote_average === "number" && item.vote_average > 0 ? item.vote_average : undefined,
  };
}

/** Rounded to one decimal, the way ratings read everywhere else ("8.4"). */
export function formatRating(rating: number | undefined): string | null {
  if (typeof rating !== "number" || !Number.isFinite(rating) || rating <= 0) return null;
  return (Math.round(rating * 10) / 10).toFixed(1);
}

/**
 * A title's page in the stack the chat is in: under a profile for a chat
 * opened from one (user/[id]/chat), in Socials otherwise. Opening it in the
 * other stack would switch tabs, and Back would no longer return to the chat.
 */
export function contentHref(pathname: string, type: string, id: string): string {
  const profile = /^\/user\/([^/]+)/.exec(pathname);
  return profile ? `/user/${profile[1]}/content/${type}/${id}` : `/socials/content/${type}/${id}`;
}
