import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { Movie, Series, Pagination } from "../types";

export interface ListResult<T> {
  items: T[];
  pagination?: Pagination;
}

// Both browse and search go through the list endpoints (title/query params)
// rather than the separate /search endpoints, which project a different
// response shape (posterUrl/releaseYear vs poster_path/release_date) — using
// one shape everywhere keeps the screens simple.
export async function getMovies(
  page = 1,
  limit = 18,
  title?: string
): Promise<ListResult<Movie>> {
  const res = await API.get(API_ROUTES.MOVIES.GET_ALL, {
    params: { page, limit, ...(title ? { title } : {}) },
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
  query?: string
): Promise<ListResult<Series>> {
  const res = await API.get(API_ROUTES.SERIES.GET_ALL, {
    params: { page, limit, ...(query ? { query } : {}) },
  });
  return { items: res.data, pagination: (res as any).pagination };
}

export async function getSeriesById(id: string): Promise<Series> {
  const res = await API.get(API_ROUTES.SERIES.GET_BY_ID(id));
  return res.data;
}
