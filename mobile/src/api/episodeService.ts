import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";

// A series' seasons and the signed-in user's watched episodes (TC-141,
// backend/routes/episodeRoute.js).

export interface SeasonInfo {
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
}

export interface EpisodeInfo {
  episode_number: number;
  name: string | null;
  air_date: string | null;
  runtime: number | null;
  aired: boolean;
}

export interface EpisodeRef {
  s: number;
  e: number;
}

export interface EpisodeProgress {
  eps: (EpisodeRef & { at?: string })[];
  all: EpisodeRef | null;
}

export interface EpisodeTracking {
  seasons: SeasonInfo[];
  lastAired: EpisodeRef | null;
  progress: EpisodeProgress;
  summary: { watched: number; aired: number; perSeason: Record<string, { watched: number; aired: number }> };
}

/** Seasons and progress, or null for a series TMDB doesn't know. */
export async function getEpisodeTracking(seriesId: string): Promise<EpisodeTracking | null> {
  const res = await API.get(API_ROUTES.EPISODES.GET(seriesId));
  return res.data;
}

export async function getSeasonEpisodes(seriesId: string, season: number): Promise<EpisodeInfo[]> {
  const res = await API.get(API_ROUTES.EPISODES.SEASON(seriesId, season));
  return res.data;
}

// The server reads, changes and writes a series' progress whole, so two
// changes to it in flight at once could lose one: each series' changes go
// one after another.
const queues = new Map<string, Promise<unknown>>();
function inOrder<T>(seriesId: string, run: () => Promise<T>): Promise<T> {
  const next = (queues.get(seriesId) ?? Promise.resolve()).catch(() => {}).then(run);
  queues.set(seriesId, next);
  return next;
}

/** One episode, or — without `episode` — a whole season. */
export function setEpisodesWatched(seriesId: string, season: number, episode: number | undefined, watched: boolean): Promise<EpisodeTracking> {
  return inOrder(seriesId, async () => (await API.put(API_ROUTES.EPISODES.WATCHED(seriesId), { season, episode, watched })).data);
}

/** Every episode aired so far, as past viewing (no date); or, unmarked, none. */
export function setAllEpisodesWatched(seriesId: string, watched: boolean): Promise<EpisodeTracking> {
  return inOrder(seriesId, async () => (await API.put(API_ROUTES.EPISODES.WATCHED_ALL(seriesId), { watched })).data);
}
