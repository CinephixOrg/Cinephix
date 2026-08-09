import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ContentType, MatchAnalysis, MatchResult } from "../types";
import type { ListResult } from "./contentService";

export interface MatchFilters {
  type: ContentType;
  genres: string[];
  useCount: boolean;
  useAvgRating: boolean;
}

// POST /match takes page/limit in the JSON body (not query params) and
// returns the standard {data, pagination} envelope, already unwrapped by
// client.ts's interceptor.
export async function findMatches(
  filters: MatchFilters,
  page = 1,
  limit = 15
): Promise<ListResult<MatchResult>> {
  const res = await API.post(API_ROUTES.MATCH.FIND, {
    ...filters,
    hybridMode: true,
    page,
    limit,
  });
  return { items: res.data, pagination: (res as any).pagination };
}

export async function analyzeMatchWithUser(
  targetUserId: string,
  type: ContentType
): Promise<MatchAnalysis> {
  const res = await API.post(API_ROUTES.MATCH.ANALYZE(targetUserId), { type });
  return res.data;
}
