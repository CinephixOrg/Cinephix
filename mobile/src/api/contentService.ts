import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ContentType, Movie, Series, Pagination, FeedUserRef, ActivityContent } from "../types";

export interface ListResult<T> {
  items: T[];
  pagination?: Pagination;
}

export interface ContentFilters {
  years?: string[];
  genres?: number[];
  hasPoster?: "yes" | "no";
}

// Both browse and search go through the list endpoints (title/query params)
// rather than the separate /search endpoints, which project a different
// response shape (posterUrl/releaseYear vs poster_path/release_date) — using
// one shape everywhere keeps the screens simple.
export async function getMovies(
  page = 1,
  limit = 18,
  title?: string,
  filters?: ContentFilters
): Promise<ListResult<Movie>> {
  const res = await API.get(API_ROUTES.MOVIES.GET_ALL, {
    params: {
      page,
      limit,
      ...(title ? { title } : {}),
      ...(filters?.years?.length ? { years: filters.years.join(",") } : {}),
      ...(filters?.genres?.length ? { genres: filters.genres.join(",") } : {}),
      ...(filters?.hasPoster ? { hasPoster: filters.hasPoster } : {}),
    },
  });
  return { items: res.data, pagination: (res as any).pagination };
}

export async function getMovieById(id: string): Promise<Movie> {
  const res = await API.get(API_ROUTES.MOVIES.GET_BY_ID(id));
  return res.data;
}

export async function getSeries(
  page = 1,
  limit = 18,
  query?: string,
  filters?: ContentFilters
): Promise<ListResult<Series>> {
  const res = await API.get(API_ROUTES.SERIES.GET_ALL, {
    params: {
      page,
      limit,
      ...(query ? { query } : {}),
      ...(filters?.years?.length ? { years: filters.years.join(",") } : {}),
      ...(filters?.genres?.length ? { genres: filters.genres.join(",") } : {}),
      ...(filters?.hasPoster ? { hasPoster: filters.hasPoster } : {}),
    },
  });
  return { items: res.data, pagination: (res as any).pagination };
}

export async function getSeriesById(id: string): Promise<Series> {
  const res = await API.get(API_ROUTES.SERIES.GET_BY_ID(id));
  return res.data;
}

export interface ContentStats {
  reviewCount: number;
  watchedCount: number;
  favoriteCount: number;
  listCount: number;
}

export async function getContentStats(type: ContentType, id: string): Promise<ContentStats> {
  const res = await API.get(API_ROUTES.CONTENT.GET_STATS(type, id));
  return res.data;
}

export interface WatchedByFriend {
  _id: string;
  username: string;
  profile_pic_url?: string;
  rating: number | null;
}

export async function getWatchedByFriends(type: ContentType, id: string): Promise<WatchedByFriend[]> {
  const res = await API.get(API_ROUTES.CONTENT.GET_WATCHED_BY_FRIENDS(type, id));
  return res.data.users;
}

// Content Detail's "Watched" stat button target — everyone (not just
// friends), newest add first. Shaped so the mobile side can build a real
// ActivityEvent (`type:"watchlist_added"`) per item — `content` comes back
// once, not per row, since every item on this page shares the same one —
// and reuse ActivityRow.tsx as-is, per direct ask.
export interface WatchedByItem {
  actor: FeedUserRef;
  createdAt: string;
}
export interface WatchedByResult {
  content: ActivityContent;
  items: WatchedByItem[];
  page: number;
  hasMore: boolean;
}
export async function getWatchedBy(type: ContentType, id: string, page = 1, limit = 20): Promise<WatchedByResult> {
  const res = await API.get(API_ROUTES.CONTENT.GET_WATCHED_BY(type, id), { params: { page, limit } });
  return res.data;
}

// Content Detail's "Favorites" stat button target — everyone who has this
// favorited. No per-user timestamp exists for favorites (still a plain
// ObjectId array on User, unlike watchlist), so unlike watched-by there's
// no `createdAt` to sort by or show — just who.
export interface FavoritedByItem {
  _id: string;
  username: string;
  profile_pic_url?: string;
}
export interface FavoritedByResult {
  items: FavoritedByItem[];
  page: number;
  hasMore: boolean;
}
export async function getFavoritedBy(type: ContentType, id: string, page = 1, limit = 20): Promise<FavoritedByResult> {
  const res = await API.get(API_ROUTES.CONTENT.GET_FAVORITED_BY(type, id), { params: { page, limit } });
  return res.data;
}

export interface LightweightContent {
  _id: string;
  title?: string;
  name?: string;
  poster_path?: string | null;
  vote_average?: number;
  // Present only on getSharedGenreContent's response — each side's own
  // rating for this title, unused/undefined from every other caller.
  myRating?: number;
  targetRating?: number;
  // Present on the /bulk?lightweight=true response (movieRoute.js/seriesRoute.js
  // already .select() it) — used by MatchSharedFavorites to derive which
  // genre a "same genre, different title" match shares client-side.
  genre_ids?: number[];
  // Present only on getRecentSharedActivity's response — an ISO date
  // string, whichever side rated it more recently, used to sort the
  // Activity card's feed by "most recently landed on" first.
  mostRecentAt?: string;
}

// lightweight:true trims the response to just what a poster thumbnail needs
// (server-side .select(), not a client-side pick) — cheap enough to call for
// a small "shared favorites" row without a dedicated summary endpoint.
export async function getMoviesBulk(ids: string[]): Promise<LightweightContent[]> {
  if (ids.length === 0) return [];
  const res = await API.post(API_ROUTES.MOVIES.BULK, { ids, lightweight: true });
  return res.data;
}

export async function getSeriesBulk(ids: string[]): Promise<LightweightContent[]> {
  if (ids.length === 0) return [];
  const res = await API.post(API_ROUTES.SERIES.BULK, { ids, lightweight: true });
  return res.data;
}
