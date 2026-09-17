import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import i18next from "../i18n";
import type { LightweightContent } from "./contentService";
import type { ContentType, MatchAnalysis, MatchWithUserResult, SyncCandidatesResult, Connection, Pagination } from "../types";

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
// `source: "profile"` marks a call made from a public profile's Sync Score
// card ⓘ (SyncScoreCard.tsx) rather than the Sync page's own Analyze
// button — the backend enforces a separate, stricter Free/Plus/Premium
// gate only for that source (see analyzeMatchWithUser's own comment,
// backend/controllers/matchController.js). Omitted (the default) for
// every other caller, which stays exactly as it always was.
export async function analyzeMatchWithUser(
  targetUserId: string,
  filters: MatchFilters,
  source?: "profile"
): Promise<MatchAnalysis> {
  const res = await API.post(API_ROUTES.MATCH.ANALYZE(targetUserId), {
    ...filters,
    language: i18next.language,
    ...(source ? { source } : {}),
  });
  return res.data;
}

// analyzeMatchWithUser's own call is a real LLM round-trip (a genuine few
// seconds, not a client-side bug — see the backend's own analyzeMatchWithUser
// controller, which calls a real Gemini/Groq/OpenRouter/OpenAI provider with
// no caching of its own). The one real lever on the client side: prefetch it
// *before* the user actually asks for it, so the common case (tapping the
// #1-ranked match, the one already centered in the results cloud) doesn't
// have to wait out the full round-trip after the tap. This module-level
// cache — keyed by exactly the inputs the backend's own response depends on
// — is what makes that safe to do: a prefetch and a later real request for
// the same (user, filters, language) share the same in-flight/resolved
// promise instead of firing two separate LLM calls (wasteful, and the
// second one could easily return a *different* generated analysis, since
// nothing here is deterministic).
const analysisCache = new Map<string, Promise<MatchAnalysis>>();
function analysisCacheKey(targetUserId: string, filters: MatchFilters) {
  return `${targetUserId}:${JSON.stringify(filters)}:${i18next.language}`;
}

// Used by both the results cloud's own prefetch (fire-and-forget, for the
// top candidate) and MatchAnalysisPanel's real fetch (awaited) — whichever
// calls first for a given candidate actually makes the request; whichever
// calls second (almost always MatchAnalysisPanel, once the user taps) just
// joins the same promise. A failed attempt is evicted rather than cached,
// so a real retry (e.g. the panel's own effect re-running) gets a fresh
// LLM call instead of being stuck replaying the same rejection.
// `source` is NOT part of the cache key — the generated analysis itself is
// identical either way (source only changes which quota gets checked on a
// genuine network call), so a candidate already fetched via the Sync
// page's own flow is free to reuse from a profile visit too, and vice
// versa, with no second LLM call and no second quota deduction.
export function prefetchMatchAnalysis(targetUserId: string, filters: MatchFilters, source?: "profile"): Promise<MatchAnalysis> {
  const key = analysisCacheKey(targetUserId, filters);
  let cached = analysisCache.get(key);
  if (!cached) {
    cached = analyzeMatchWithUser(targetUserId, filters, source);
    analysisCache.set(key, cached);
    cached.catch(() => analysisCache.delete(key));
  }
  return cached;
}

// Fired once when the analysis panel's Shared Genres card mounts, with every
// one of the candidate's sharedGenres at once — the expensive part (both
// users' high ratings + the batched Movie/Series fetch) is genre-independent,
// so batching avoids a network round trip per genre tap.
export async function getSharedGenreContent(
  targetUserId: string,
  type: ContentType,
  genres: string[]
): Promise<Record<string, LightweightContent[]>> {
  const res = await API.post(API_ROUTES.MATCH.SHARED_GENRE_CONTENT(targetUserId), { type, genres });
  return res.data;
}

// Both users' own rating (if any) for an arbitrary set of content ids — no
// threshold or mutual-rating requirement, unlike getSharedGenreContent above.
// Used by the Favorites card's detail box, where a favorited title may be
// rated by one side, both, or neither.
// People BOTH the requester and targetUserId follow — not either side's raw
// followers/following (userService.ts's getFollowing/getFollowers). Powers
// the Social Overlap card's avatar grid; same paginated envelope shape as
// those two, so it's consumed the same way.
export async function getMutualConnections(
  targetUserId: string,
  page = 1,
  limit = 20
): Promise<{ items: Connection[]; pagination?: Pagination }> {
  const res = await API.get(API_ROUTES.MATCH.MUTUAL_CONNECTIONS(targetUserId), { params: { page, limit } });
  return { items: res.data, pagination: (res as any).pagination };
}

export async function getContentRatings(
  targetUserId: string,
  type: ContentType,
  ids: string[]
): Promise<Record<string, { myRating?: number; targetRating?: number }>> {
  if (ids.length === 0) return {};
  const res = await API.post(API_ROUTES.MATCH.CONTENT_RATINGS(targetUserId), { type, ids });
  return res.data;
}

// Titles both sides rated within the last 30 days — the Activity card's own
// poster feed, the actual overlap computeMatchBreakdown's trendingAlignment
// sub-score is a ratio *of*, made visible. Sorted server-side by whichever
// side rated it more recently.
export async function getRecentSharedActivity(targetUserId: string, type: ContentType): Promise<LightweightContent[]> {
  const res = await API.post(API_ROUTES.MATCH.RECENT_ACTIVITY(targetUserId), { type });
  return res.data;
}

// GET /match/sync/candidates — Free (and any tier without filter access) has its
// filters silently overridden server-side regardless of what's sent here, so
// passing filters is harmless for Free too; only Pro/Premium's request
// actually changes the result.
export async function getSyncCandidates(filters?: MatchFilters): Promise<SyncCandidatesResult> {
  const res = await API.get(API_ROUTES.MATCH.SYNC_CANDIDATES, {
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
