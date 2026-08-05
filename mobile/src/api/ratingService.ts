import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ContentType, Rating } from "../types";

export async function getMyRating(contentId: string): Promise<Rating | null> {
  const res = await API.get(API_ROUTES.RATINGS.GET_MY_RATING(contentId));
  return res.data;
}

// POST /api/ratings is an upsert (findOneAndUpdate) — one call handles both
// creating a new rating and updating an existing one.
export async function rateContent(
  contentId: string,
  contentType: ContentType,
  value: number
): Promise<Rating> {
  const res = await API.post(API_ROUTES.RATINGS.CREATE_OR_UPDATE, {
    contentId,
    contentType,
    value,
  });
  return res.data;
}
