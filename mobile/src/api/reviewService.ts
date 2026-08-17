import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ContentType, PopularReview, Review } from "../types";
import type { ListResult } from "./contentService";

export async function getContentReviews(
  contentId: string,
  opts: { sort?: "recent" | "popular"; page?: number; limit?: number } = {}
): Promise<ListResult<Review>> {
  const { sort = "recent", page = 1, limit = 50 } = opts;
  const res = await API.get(API_ROUTES.REVIEWS.GET_FOR_CONTENT(contentId), {
    params: { sort, page, limit },
  });
  return { items: res.data, pagination: (res as any).pagination };
}

// No pagination on this endpoint at all — backend returns everything.
export async function getFriendsReviews(contentId: string): Promise<Review[]> {
  const res = await API.get(API_ROUTES.REVIEWS.GET_FRIENDS_FOR_CONTENT(contentId));
  return res.data;
}

export async function getPopularReviews(limit = 10, type?: ContentType, q?: string): Promise<PopularReview[]> {
  const res = await API.get(API_ROUTES.REVIEWS.GET_POPULAR, { params: { limit, type, q } });
  return res.data;
}

// Global "reviews from people you follow" feed (Home page Reviews tab) —
// distinct from getFriendsReviews above, which is scoped to one piece of
// content on the Content Detail page.
export async function getReviewsFromFriends(limit = 10, type?: ContentType): Promise<PopularReview[]> {
  const res = await API.get(API_ROUTES.REVIEWS.GET_FRIENDS_FEED, { params: { limit, type } });
  return res.data;
}

// POST /reviews upserts — same call for both create and edit, no separate
// update endpoint exists on the backend.
export async function saveReview(
  contentId: string,
  contentType: ContentType,
  text: string
): Promise<Review> {
  const res = await API.post(API_ROUTES.REVIEWS.CREATE_OR_UPDATE, { contentId, contentType, text });
  return res.data;
}

export async function deleteReview(reviewId: string): Promise<void> {
  await API.delete(API_ROUTES.REVIEWS.DELETE(reviewId));
}

export async function toggleReviewLike(reviewId: string): Promise<{ likeCount: number; hasLiked: boolean }> {
  const res = await API.post(API_ROUTES.REVIEWS.TOGGLE_LIKE(reviewId));
  return res.data;
}
