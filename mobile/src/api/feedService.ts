import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ContentType, FeedResult, PopularThisWeekItem, LeaderboardResult, PeopleLeaderboardResult, ActivityFeedResult, PodiumPlacement } from "../types";

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
