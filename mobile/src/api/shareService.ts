import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ContentType, Share, ShareFeedResult } from "../types";

export type CreateSharePayload =
  | { type: "analysis"; analysisData: any }
  | { type: "review"; reviewId: string }
  | { type: "recommendation"; contentId: string; contentType: ContentType; note?: string }
  | { type: "list"; listId: string };

export async function createShare(payload: CreateSharePayload): Promise<Share> {
  const res = await API.post(API_ROUTES.SHARES.CREATE, payload);
  return res.data;
}

// No sort/type params — the backend blends recency, likes, and following
// into one ranking (see getShareFeed's own comment in shareController.js).
// `scope` is the one exception, a lightweight re-add of an "All"/"Friends"
// toggle: "following" hard-filters to just the people the caller follows,
// still ranked by the same blended score within that subset — not a
// second ranking mode, just which posts are eligible.
export async function getShareFeed(page = 1, limit = 20, scope: "all" | "following" = "all"): Promise<ShareFeedResult> {
  const res = await API.get(API_ROUTES.SHARES.GET_FEED, { params: { page, limit, scope } });
  return res.data;
}

export async function toggleShareLike(shareId: string): Promise<{ likeCount: number; liked: boolean }> {
  const res = await API.post(API_ROUTES.SHARES.LIKE(shareId));
  return res.data;
}

// Fire-and-forget from ShareCard on mount — idempotent server-side, safe to
// call again if the card re-mounts while scrolling.
export async function registerShareView(shareId: string): Promise<{ viewCount: number }> {
  const res = await API.post(API_ROUTES.SHARES.VIEW(shareId));
  return res.data;
}

// Response goes through sendPaginated — the response interceptor unwraps
// res.data to the plain Share[] array and stashes pagination separately,
// same pattern getUserRatings already relies on.
export async function getUserShares(
  userId: string,
  page = 1,
  limit = 20
): Promise<{ items: Share[]; total: number }> {
  const res = await API.get(API_ROUTES.SHARES.GET_USER_SHARES(userId), { params: { page, limit } });
  const pagination = (res as any).pagination;
  return { items: res.data, total: pagination?.total ?? res.data.length };
}

export async function deleteShare(shareId: string): Promise<void> {
  await API.delete(API_ROUTES.SHARES.DELETE(shareId));
}
