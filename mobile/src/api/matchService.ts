import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import i18next from "../i18n";
import type {
  ContentType,
  MatchAnalysis,
  MatchWithUserResult,
  RejectedMatchEntry,
  SwipeDecision,
  SwipeQueueResult,
  SwipeResult,
} from "../types";

export interface MatchFilters {
  type: ContentType;
  genres: string[];
  useCount: boolean;
  useAvgRating: boolean;
}

export async function getMatchWithUser(
  targetUserId: string,
  filters: MatchFilters
): Promise<MatchWithUserResult> {
  const res = await API.post(API_ROUTES.MATCH.WITH_USER(targetUserId), filters);
  return res.data;
}

// filters should be the exact same filters the caller's getMatchWithUser
// call used — the backend computes the same weighted score both endpoints
// return, but only if given the same inputs, so passing a different/partial
// filter set here would reintroduce the "two different scores" bug this was
// built to fix.
export async function analyzeMatchWithUser(
  targetUserId: string,
  filters: MatchFilters
): Promise<MatchAnalysis> {
  const res = await API.post(API_ROUTES.MATCH.ANALYZE(targetUserId), {
    ...filters,
    language: i18next.language,
  });
  return res.data;
}

// GET /match/swipe/queue — Free (and any tier without filter access) has its
// filters silently overridden server-side regardless of what's sent here, so
// passing filters is harmless for Free too; only Pro/Premium's request
// actually changes the result.
export async function getSwipeQueue(filters?: MatchFilters): Promise<SwipeQueueResult> {
  const res = await API.get(API_ROUTES.MATCH.SWIPE_QUEUE, {
    params: filters
      ? {
          type: filters.type,
          genres: filters.genres,
          useCount: filters.useCount,
          useAvgRating: filters.useAvgRating,
        }
      : undefined,
  });
  return res.data;
}

export async function swipeMatch(
  targetUserId: string,
  contentType: ContentType,
  decision: SwipeDecision,
  matchPercentage: number
): Promise<SwipeResult> {
  const res = await API.post(API_ROUTES.MATCH.SWIPE, {
    targetUserId,
    contentType,
    decision,
    matchPercentage,
  });
  return res.data;
}

// Pro/Premium/Dev only — the backend returns an empty array for Free rather
// than an error, same convention as getProfileAnalysisHistory.
export async function getRejectedMatches(): Promise<RejectedMatchEntry[]> {
  const res = await API.get(API_ROUTES.MATCH.SWIPE_REJECTED);
  return res.data;
}
