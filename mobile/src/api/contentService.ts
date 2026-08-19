import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ContentType, Movie, Series, Pagination } from "../types";

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
