import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ContentType, NewlyEarnedBadge, Rating } from "../types";

export async function getMyRating(contentId: string): Promise<Rating | null> {
  const res = await API.get(API_ROUTES.RATINGS.GET_MY_RATING(contentId));
  return res.data;
}

// POST /api/ratings is an upsert (findOneAndUpdate) — one call handles both
// creating a new rating and updating an existing one.
// Public endpoint (no auth) — every individual rating value for a piece of
// content, raw 1-10 ints, used to build the rating distribution chart.
export async function getAllRatingsForContent(contentId: string): Promise<number[]> {
  const res = await API.get(API_ROUTES.RATINGS.GET_ALL_FOR_CONTENT(contentId));
  return res.data;
}

// Bulk fetch of every rating this user has ever given — used to annotate
// the Watched List grid with each item's personal rating for the
// Rated/Not Rated/Highest/Lowest Rating filters, distinct from
// getAllRatingsForContent's per-content "everyone's ratings" shape.
export async function getUserRatings(
  userId: string
): Promise<{ contentId: string; contentType: ContentType; value: number; createdAt: string }[]> {
  const res = await API.get(API_ROUTES.RATINGS.GET_USER_RATINGS(userId));
  return res.data;
}

// `newlyEarnedBadges` is spread alongside the rating's own fields (not a
// wrapper object) — only ever non-empty for the ratingCount activity badge
// (genre/volume count Watched-List membership, not ratings, so THEY report
// through addToWatchlist() instead; see NewlyEarnedBadge's own doc comment
// in types/index.ts for the full "which badge lives on which endpoint"
// reasoning).
export async function rateContent(
  contentId: string,
  contentType: ContentType,
  value: number
): Promise<Rating & { newlyEarnedBadges: NewlyEarnedBadge[] }> {
  const res = await API.post(API_ROUTES.RATINGS.CREATE_OR_UPDATE, {
    contentId,
    contentType,
    value,
  });
  return res.data;
}
