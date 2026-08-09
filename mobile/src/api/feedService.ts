import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { PopularThisWeekItem, RecommendationItem } from "../types";

export async function getPopularThisWeek(limit = 20): Promise<PopularThisWeekItem[]> {
  const res = await API.get(API_ROUTES.FEED.POPULAR_THIS_WEEK, { params: { limit } });
  return res.data;
}

export async function getRecommendations(limit = 20): Promise<{
  recommendations: RecommendationItem[];
  topGenreIds: number[];
  hasPersonalization: boolean;
}> {
  const res = await API.get(API_ROUTES.FEED.RECOMMENDATIONS, { params: { limit } });
  return res.data;
}
