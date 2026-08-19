import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ContentType, FeedResult, PopularThisWeekItem } from "../types";

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
