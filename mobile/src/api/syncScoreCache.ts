import { getMatchWithUser, type MatchFilters } from "./matchService";
import { createLruCache } from "../utils/cache";
import type { ContentType, MatchWithUserResult } from "../types";

// Same weighted-match filters the Sync page defaults to, so the number the
// profile shows is the number that page would show for the same pair.
// `type` is just the default for whichever caller doesn't pass one — every
// real caller now does (SyncScoreCard.tsx's own movie/series prop, driven
// by the CineGraph tab's own sub-tab switcher), see below.
export const SYNC_SCORE_FILTERS: MatchFilters = {
  type: "movie",
  genres: [],
  useCount: true,
  useAvgRating: true,
};

// Keyed by (userId, type) now, not userId alone — a real bug fix: the movie
// score and the series score for the same pair are genuinely different
// numbers (different CineGraph, different ratings), and a single
// userId-only cache/in-flight-map entry meant switching the CineGraph tab's
// own Movies/Series toggle kept showing whichever type happened to be
// fetched first (always "movie", from the eager profile-open prefetch
// below) instead of recomputing for the newly-selected type.
const scores = createLruCache<MatchWithUserResult>(24);
// One in-flight request per (user, type), so the profile's prefetch and the
// card's own fetch share a single round trip rather than racing each other.
const inFlight = new Map<string, Promise<MatchWithUserResult>>();

function cacheKey(userId: string, type: ContentType): string {
  return `${userId}:${type}`;
}

export function getCachedSyncScore(userId: string, type: ContentType = "movie"): MatchWithUserResult | undefined {
  return scores.get(cacheKey(userId, type));
}

// Kicked off the moment a profile is opened rather than when its CineGraph
// tab is tapped.
//
// The score is a real computation over both users' ratings, and starting it
// only once the user reaches the tab meant they sat watching a spinner for
// the whole round trip. Started at profile-open it resolves while they're
// still on Sharings, so the tab has its number in the first frame. Nothing
// awaits this — a profile the user never opens that tab on simply paid for
// one background request.
//
// `type` defaults to "movie" — the profile-open call site (publicProfileCache.ts)
// never knows which sub-tab the viewer will land on or switch to, and
// "movie" is the CineGraph tab's own default sub-tab, so this still warms
// the common case. Switching to Series pays one real round trip the first
// time, same as any other cache miss.
export function prefetchSyncScore(userId: string, type: ContentType = "movie"): Promise<MatchWithUserResult> {
  const key = cacheKey(userId, type);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const request = getMatchWithUser(userId, { ...SYNC_SCORE_FILTERS, type }).then((result) => {
    scores.set(key, result);
    return result;
  });

  inFlight.set(key, request);
  request.catch(() => {}).finally(() => inFlight.delete(key));
  return request;
}
