import { getMatchWithUser, type MatchFilters } from "./matchService";
import { createLruCache } from "../utils/cache";
import type { MatchWithUserResult } from "../types";

// Same weighted-match filters the Sync page defaults to, so the number the
// profile shows is the number that page would show for the same pair.
export const SYNC_SCORE_FILTERS: MatchFilters = {
  type: "movie",
  genres: [],
  useCount: true,
  useAvgRating: true,
};

const scores = createLruCache<MatchWithUserResult>(24);
// One in-flight request per user, so the profile's prefetch and the card's
// own fetch share a single round trip rather than racing each other.
const inFlight = new Map<string, Promise<MatchWithUserResult>>();

export function getCachedSyncScore(userId: string): MatchWithUserResult | undefined {
  return scores.get(userId);
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
export function prefetchSyncScore(userId: string): Promise<MatchWithUserResult> {
  const existing = inFlight.get(userId);
  if (existing) return existing;

  const request = getMatchWithUser(userId, SYNC_SCORE_FILTERS).then((result) => {
    scores.set(userId, result);
    return result;
  });

  inFlight.set(userId, request);
  request.catch(() => {}).finally(() => inFlight.delete(userId));
  return request;
}
