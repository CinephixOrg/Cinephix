import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { AccountTier, ContentType, FeedResult, PopularThisWeekItem, LeaderboardResult, PeopleLeaderboardResult, ActivityFeedResult, PodiumPlacement } from "../types";

export interface RecommendationItem {
  _id: string;
  title?: string;
  name?: string;
  poster_path?: string | null;
  contentType: ContentType;
}
export interface RecommendationResult {
  recommendations: RecommendationItem[];
  topGenreIds: number[];
  hasPersonalization: boolean;
}

// Same shape as RecommendationItem plus the real date the rail is sorted
// by — feedController.js's getNewReleases sorts movies/series together by
// release_date/first_air_date, newest first, with no personalization or
// already-watched exclusion (a plain catalog browse, not a recommendation).
export interface NewReleaseItem {
  _id: string;
  title?: string;
  name?: string;
  poster_path?: string | null;
  contentType: ContentType;
  release_date?: string;
  first_air_date?: string;
}

export interface CurrentlyWatchingFeedItem {
  user: { _id: string; username: string; profile_pic_url?: string; accountTier?: AccountTier };
  contentId: string;
  contentType: ContentType;
  title: string;
  posterUrl?: string | null;
  startedAt: string;
}

export async function getPopularThisWeek(limit = 20, type?: ContentType): Promise<PopularThisWeekItem[]> {
  const res = await API.get(API_ROUTES.FEED.POPULAR_THIS_WEEK, { params: { limit, type } });
  return res.data;
}

export async function getPopularWithFriends(limit = 20, type?: ContentType): Promise<PopularThisWeekItem[]> {
  const res = await API.get(API_ROUTES.FEED.POPULAR_WITH_FRIENDS, { params: { limit, type } });
  return res.data;
}

export async function getFeed(page = 1, limit = 20, contentType?: ContentType): Promise<FeedResult> {
  const res = await API.get(API_ROUTES.FEED.GET_FEED, { params: { page, limit, contentType } });
  return res.data;
}

// Discover's "What to Watch" rail — a genre-affinity pick off the caller's
// own CineGraph (already built from their ratings), excluding anything
// already watched/queued. This endpoint (feedController.js's
// getRecommendations) already existed server-side but had no mobile call
// site until now.
export async function getRecommendations(limit = 20, type?: ContentType): Promise<RecommendationResult> {
  const res = await API.get(API_ROUTES.FEED.RECOMMENDATIONS, { params: { limit, type } });
  return res.data;
}

// Discover's "New Releases" rail — real release_date/first_air_date within
// the last 90 days, newest first, direct ask.
export async function getNewReleases(limit = 20, type?: ContentType): Promise<{ items: NewReleaseItem[] }> {
  const res = await API.get(API_ROUTES.FEED.NEW_RELEASES, { params: { limit, type } });
  return res.data;
}

// Shares' "Currently Watching" section — who's actively watching what
// right now (feedController.js's getCurrentlyWatchingFeed, a 4-hour TTL
// window). `scope` is the direct-ask All/Friends mode toggle, not two
// separate endpoints.
export async function getCurrentlyWatchingFeed(
  scope: "all" | "friends",
  limit = 20
): Promise<{ items: CurrentlyWatchingFeedItem[] }> {
  const res = await API.get(API_ROUTES.FEED.CURRENTLY_WATCHING, { params: { scope, limit } });
  return res.data;
}

export async function getLeaderboard(type?: ContentType): Promise<LeaderboardResult> {
  const res = await API.get(API_ROUTES.FEED.LEADERBOARD, { params: { type } });
  return res.data;
}

export async function getPeopleLeaderboard(type?: ContentType): Promise<PeopleLeaderboardResult> {
  const res = await API.get(API_ROUTES.FEED.PEOPLE_LEADERBOARD, { params: { type } });
  return res.data;
}

export async function getMyPodiumPlacements(): Promise<{ placements: PodiumPlacement[] }> {
  const res = await API.get(API_ROUTES.FEED.MY_PODIUM_PLACEMENTS);
  return res.data;
}

export async function getNetworkActivity(page = 1, limit = 10, category?: string): Promise<ActivityFeedResult> {
  const res = await API.get(API_ROUTES.FEED.ACTIVITY, { params: { page, limit, category } });
  return res.data;
}
