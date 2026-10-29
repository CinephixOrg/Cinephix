import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ContentType, NewlyEarnedBadge, PopularReview, Review, ReviewsFeedResult } from "../types";
import type { ListResult } from "./contentService";

export async function getContentReviews(
  contentId: string,
  opts: { sort?: "recent" | "popular" | "liked_by_me"; page?: number; limit?: number } = {}
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

export type ReviewSort = "liked" | "newest" | "rating";

// Search's Reviews tab is the only caller — safe to shape this as a real
// paginated result (was a fixed "top N" with no way to reach anything past
// `limit`, same class of gap fixed on the Lists side, see
// getPopularListsPaginated). Distinct from getReviewsFeed (Discover's own
// paginated feed): that one has no q/type/sort/rating filtering at all, it's
// a plain isFriend+likeCount+createdAt ranking — the two aren't
// interchangeable.
export async function getPopularReviews(
  page = 1,
  limit = 10,
  type?: ContentType,
  q?: string,
  sort?: ReviewSort,
  minRating?: number | null,
  maxRating?: number | null,
  // Search's Reviews tab empty state — popular reviews restricted to
  // titles already on the viewer's own watched list (watchedOnly=true
  // short-circuits past the `q` text-search branch server-side, so q is
  // never meaningfully combined with this in practice).
  watchedOnly?: boolean
): Promise<ReviewsFeedResult> {
  const res = await API.get(API_ROUTES.REVIEWS.GET_POPULAR, {
    params: {
      page,
      limit,
      type,
      q,
      sort,
      minRating: minRating ?? undefined,
      maxRating: maxRating ?? undefined,
      watchedOnly: watchedOnly ?? undefined,
    },
  });
  return res.data;
}

// Global "reviews from people you follow" feed (Home page Reviews tab) —
// distinct from getFriendsReviews above, which is scoped to one piece of
// content on the Content Detail page.
export async function getReviewsFromFriends(limit = 10, type?: ContentType): Promise<PopularReview[]> {
  const res = await API.get(API_ROUTES.REVIEWS.GET_FRIENDS_FEED, { params: { limit, type } });
  return res.data;
}

// Discover's paginated Reviews tab feed — one merged, server-sorted query
// (friends' reviews first, then popular, see reviewController.js's
// getReviewsFeed) replacing a client-side merge of getPopularReviews +
// getReviewsFromFriends that couldn't paginate correctly.
export async function getReviewsFeed(page = 1, limit = 15, mode?: "all" | "friends" | "liked"): Promise<ReviewsFeedResult> {
  const res = await API.get(API_ROUTES.REVIEWS.GET_FEED, { params: { page, limit, mode } });
  return res.data;
}

// POST /reviews upserts — same call for both create and edit, no separate
// update endpoint exists on the backend. `newlyEarnedBadges` is spread
// alongside the review's own fields, only ever non-empty for the
// reviewCount activity badge (only a genuinely NEW review, never an edit,
// can cross a threshold).
export async function saveReview(
  contentId: string,
  contentType: ContentType,
  text: string
): Promise<Review & { newlyEarnedBadges: NewlyEarnedBadge[] }> {
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
