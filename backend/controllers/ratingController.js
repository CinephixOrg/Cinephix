// backend/controllers/ratingController.js
import Rating from "../models/Rating.js";
import User from "../models/User.js";
import ActivityLog from "../models/ActivityLog.js";

import { conn } from "../db/connections.js";
import { createMovieModel } from "../models/Movie.js";
import { createSeriesModel } from "../models/Series.js";

// New imports for consistent responses and error handling
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { refreshUserCineGraph } from "../utils/cineGraph.js";
import { RATING_COUNT_TIERS, crossedActivityTier, bumpStreak } from "./badgeController.js";

const Movie = createMovieModel(conn);
const Series = createSeriesModel(conn);

/* ---------- ADD / UPDATE RATING ---------- */

export const addOrUpdateRating = asyncHandler(async (req, res) => {
  const { contentId, contentType, value } = req.body;
  const userId = req.user.id;

  // Validation
  if (!contentId || !contentType || value === undefined) {
    return sendError(res, 'contentId, contentType, and value are required', 400);
  }

  if (!['movie', 'series'].includes(contentType)) {
    return sendError(res, 'contentType must be "movie" or "series"', 400);
  }

  if (typeof value !== 'number' || value < 1 || value > 10) {
    return sendError(res, 'Rating value must be between 1 and 10', 400);
  }

  const existingRating = await Rating.findOne({ user: userId, contentId });

  const exists = contentType === "movie" ? await Movie.exists({ _id: contentId }) : await Series.exists({ _id: contentId });
  if (!exists) return sendError(res, contentType === "movie" ? "Movie not found" : "Series not found", 404);

  const newRating = await Rating.findOneAndUpdate(
    { user: userId, contentId },
    { contentType, value },
    { upsert: true, new: true, runValidators: true }
  ).lean();

  // Recomputed rather than adjusted: see utils/cineGraph.js.
  await refreshUserCineGraph(userId);

  // Rating-count badge crossing — this is the one legitimate place to
  // detect it: unlike genre/volume badges (which count Watched-List
  // membership and moved to userWatchlistRoute.js's add handler for that
  // reason), a rating-count badge counts real Rating documents, and this
  // IS the endpoint that creates them. Only a genuinely NEW rating (never
  // an edit of an existing one) can move the count, same "did this
  // specific action just cross a threshold" question crossedThresholdTier/
  // crossedVolumeTier already answer for their own families.
  let newlyEarnedBadges = [];
  // Streak — unconditional, unlike the rating-count check right below:
  // even editing an already-existing rating is real evidence the user
  // showed up today, which is all a daily-presence streak cares about
  // (see bumpStreak's own doc comment in badgeController.js).
  const streakBadge = await bumpStreak(userId);
  if (streakBadge) newlyEarnedBadges.push(streakBadge);

  if (!existingRating) {
    const ratingCount = await Rating.countDocuments({ user: userId });
    const crossedTier = crossedActivityTier(ratingCount, RATING_COUNT_TIERS);
    if (crossedTier) {
      const threshold = RATING_COUNT_TIERS.find((t) => t.tier === crossedTier).threshold;
      newlyEarnedBadges.push({ family: "ratingCount", key: "ratings", count: ratingCount, tier: crossedTier, threshold });
    }

    await ActivityLog.create({
      userId,
      actionType: 'RATE',
      details: `Rated ${contentType} ${value}/10`,
      payload: {
         addedRatingIds: [newRating._id],
         updatedCineGraph: true
      }
    });
  }

  sendSuccess(res, { ...newRating, newlyEarnedBadges }, 'Rating saved successfully', 200);
});

/* ---------- GET MY RATING ---------- */

export const getMyRating = asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const userId = req.user.id;

  if (!contentId) {
    return sendError(res, 'contentId is required', 400);
  }

  const rating = await Rating.findOne({ user: userId, contentId }).lean();

  if (!rating) {
    return sendSuccess(res, null, 'No rating found', 200);
  }

  sendSuccess(res, rating, 'Rating fetched', 200);
});

/* ---------- GET ALL RATINGS FOR CONTENT ---------- */

export const getAllRatingsForContent = asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  if (!contentId) {
    return sendError(res, 'contentId is required', 400);
  }

  const ratings = await Rating.find({ contentId }).select('value').lean();

  // Return just the values for the rating distribution
  const ratingValues = ratings.map(r => r.value);

  sendSuccess(res, ratingValues, 'Content ratings fetched', 200);
});
