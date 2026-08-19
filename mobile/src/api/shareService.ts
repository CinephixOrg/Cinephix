import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ContentType, Share, ShareFeedResult } from "../types";

export type CreateSharePayload =
  | { type: "analysis"; analysisData: any }
  | { type: "review"; reviewId: string }
  | { type: "recommendation"; contentId: string; contentType: ContentType; note?: string };

export async function createShare(payload: CreateSharePayload): Promise<Share> {
  const res = await API.post(API_ROUTES.SHARES.CREATE, payload);
  return res.data;
}

export async function getShareFeed(
  sort: "recent" | "popular" | "network" = "recent",
  type?: "analysis" | "review" | "recommendation",
  page = 1,
  limit = 20
): Promise<ShareFeedResult> {
  const res = await API.get(API_ROUTES.SHARES.GET_FEED, { params: { sort, type, page, limit } });
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
