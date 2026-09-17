import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ContentType, PollOption, Share, ShareFeedResult, ShareType } from "../types";
import { createPrefetcher } from "../utils/prefetch";

// How many shares a profile's Sharings grid previews. Lives here rather
// than in that component because the public profile fetches this page as
// part of its own bundle, and both sides must ask for the same amount.
export const SHARES_PREVIEW_LIMIT = 30;

export type CreateSharePayload =
  | { type: "analysis"; analysisData: any }
  | { type: "review"; reviewId: string }
  | { type: "recommendation"; contentId: string; contentType: ContentType; note?: string }
  | { type: "list"; listId: string }
  // "What should I watch next?" — 2 or 3 titles picked from the caller's
  // own Watchlist (re-verified server-side, never trusted as-is).
  | { type: "poll"; items: { contentId: string; contentType: ContentType }[] }
  | {
      type: "badge";
      badgeFamily:
        | "genre"
        | "volume"
        | "ratingCount"
        | "reviewCount"
        | "listCount"
        | "followers"
        | "influencer"
        | "podium"
        | "firstSync"
        | "highMatch"
        | "syncExplorer"
        | "founding"
        | "membership"
        | "streak"
        | "timeTraveler"
        | "eclecticTaste"
        | "dayOneViewer"
        | "hiddenGem"
        | "pollParticipant"
        | "halloweenViewer"
        | "newYearViewer";
      badgeKey: string;
      // Genre only: which of the 2 simultaneously-visible tiles (devotee
      // vs master) is being shared — every other family only ever shows
      // its current tier, so this stays omitted there and the server just
      // uses whatever tier is currently earned (unchanged behavior).
      badgeTier?: string;
    };

export async function createShare(payload: CreateSharePayload): Promise<Share> {
  const res = await API.post(API_ROUTES.SHARES.CREATE, payload);
  return res.data;
}

// "family:key:tier" strings for every badge the caller has ever shared —
// powers the Badges tab's Share/Shared button (BadgeDetailModal.tsx via
// ProfileBadgesTab.tsx), one bulk fetch instead of a per-tile check.
export async function getSharedBadges(): Promise<string[]> {
  const res = await API.get(API_ROUTES.SHARES.GET_SHARED_BADGES);
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
  limit = 20,
  // Profile's own Sharings tab category filter (ProfileSharingsTab.tsx) —
  // omitted or empty means unfiltered, same as every existing call site.
  types?: ShareType[]
): Promise<{ items: Share[]; total: number }> {
  const params: Record<string, any> = { page, limit };
  if (types && types.length > 0) params.types = types.join(",");
  const res = await API.get(API_ROUTES.SHARES.GET_USER_SHARES(userId), { params });
  const pagination = (res as any).pagination;
  return { items: res.data, total: pagination?.total ?? res.data.length };
}

// One share, in the same shape getUserShares' items come in — for the share
// page a "liked your share" notification opens.
export async function getShareById(shareId: string): Promise<Share> {
  const res = await API.get(API_ROUTES.SHARES.GET(shareId));
  return res.data;
}

// One share, started by a tap that's about to open it (a "liked your share"
// notification) and taken by the share page once it mounts.
export const sharePrefetch = createPrefetcher(getShareById);

export async function deleteShare(shareId: string): Promise<void> {
  await API.delete(API_ROUTES.SHARES.DELETE(shareId));
}

// "poll" shares only — one vote per user; voting again with a different
// optionIndex swaps the vote server-side rather than adding a second one.
export async function voteOnPoll(shareId: string, optionIndex: number): Promise<{ options: PollOption[]; userVoteIndex: number }> {
  const res = await API.post(API_ROUTES.SHARES.VOTE(shareId), { optionIndex });
  return res.data;
}
