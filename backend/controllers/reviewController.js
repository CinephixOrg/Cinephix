// backend/controllers/reviewController.js
import mongoose from "mongoose";
import Review from '../models/Review.js';
import User from '../models/User.js';

import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError, sendPaginated } from "../utils/response.js";

const getMovie = () => mongoose.connection.model("Movie");
const getSeries = () => mongoose.connection.model("Series");

const withLikeMeta = (reviews, userId) =>
  reviews.map((r) => {
    const likes = r.likes || [];
    return {
      ...r,
      likeCount: likes.length,
      hasLiked: userId ? likes.some((id) => id.toString() === userId) : false,
    };
  });

/**
 * @route  GET /api/reviews/content/:contentId
 * @access Public (optionalAuth — includes hasLiked if logged in)
 * @query  sort: "recent" (default) | "popular"
 */
export const getContentReviews = asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { page = 1, limit = 50, sort = "recent" } = req.query;
  const skip = (page - 1) * limit;
  const userId = req.user?._id?.toString();

  if (!contentId) return sendError(res, 'contentId is required', 400);

  const sortQuery = sort === "popular" ? {} : { createdAt: -1 };

  let reviews = await Review.find({ contentId })
    .populate('user', 'username profile_pic_url')
    .sort(sortQuery)
    .limit(parseInt(limit))
    .skip(skip)
    .lean();

  if (sort === "popular") {
    reviews = reviews.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
  }

  const total = await Review.countDocuments({ contentId });
  const result = withLikeMeta(reviews, userId);

  sendPaginated(res, result, total, parseInt(page), parseInt(limit), 'Reviews fetched');
});

/**
 * @route  GET /api/reviews/content/:contentId/friends
 * @access Private
 */
export const getFriendsReviews = asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const userId = req.user._id.toString();

  const currentUser = await User.findById(userId).select("following").lean();
  const followingIds = currentUser?.following || [];

  if (followingIds.length === 0) {
    return sendSuccess(res, [], "No friends reviews");
  }

  const reviews = await Review.find({ contentId, user: { $in: followingIds } })
    .populate('user', 'username profile_pic_url')
    .sort({ createdAt: -1 })
    .lean();

  sendSuccess(res, withLikeMeta(reviews, userId), "Friends reviews fetched");
});

/**
 * @route  POST /api/reviews/:reviewId/like
 * @access Private
 */
export const toggleReviewLike = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user._id;

  const review = await Review.findById(reviewId);
  if (!review) return sendError(res, 'Review not found', 404);

  const alreadyLiked = review.likes.some((id) => id.toString() === userId.toString());
  if (alreadyLiked) {
    review.likes.pull(userId);
  } else {
    review.likes.push(userId);
  }
  await review.save();

  sendSuccess(res, { likeCount: review.likes.length, hasLiked: !alreadyLiked }, "Like toggled");
});

/**
 * @route  GET /api/reviews/popular
 * @access Private
 * Returns the most liked reviews globally, with content info, for the homepage.
 */
export const getPopularReviews = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 30);
  const userId = req.user._id.toString();

  const reviews = await Review.aggregate([
    { $addFields: { likeCount: { $size: { $ifNull: ["$likes", []] } } } },
    { $sort: { likeCount: -1, createdAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
        pipeline: [{ $project: { username: 1, profile_pic_url: 1 } }],
      },
    },
    { $unwind: "$user" },
  ]);

  if (reviews.length === 0) return sendSuccess(res, [], "No popular reviews yet");

  // Bulk-fetch content titles and posters
  const movieIds = reviews.filter((r) => r.contentType === "movie").map((r) => r.contentId);
  const seriesIds = reviews.filter((r) => r.contentType === "series").map((r) => r.contentId);

  const [movies, seriesList] = await Promise.all([
    movieIds.length ? getMovie().find({ _id: { $in: movieIds } }).select("_id title name poster_path").lean() : [],
    seriesIds.length ? getSeries().find({ _id: { $in: seriesIds } }).select("_id title name poster_path").lean() : [],
  ]);

  const movieMap = Object.fromEntries(movies.map((m) => [m._id.toString(), m]));
  const seriesMap = Object.fromEntries(seriesList.map((s) => [s._id.toString(), s]));

  const result = reviews.reduce((acc, r) => {
    const item = r.contentType === "movie" ? movieMap[r.contentId] : seriesMap[r.contentId];
    if (!item) return acc;
    acc.push({
      _id: r._id,
      user: r.user,
      text: r.text,
      createdAt: r.createdAt,
      likeCount: r.likeCount,
      hasLiked: r.likes?.some((id) => id.toString() === userId),
      content: {
        id: r.contentId,
        title: item.title || item.name,
        poster_path: item.poster_path,
        type: r.contentType,
      },
    });
    return acc;
  }, []);

  sendSuccess(res, result, "Popular reviews fetched");
});

/**
 * @route  POST /api/reviews
 * @access Private
 */
export const addOrUpdateReview = asyncHandler(async (req, res) => {
  const { contentId, contentType, text } = req.body;
  const userId = req.user.id;

  if (!contentId || !contentType || !text) {
    return sendError(res, 'contentId, contentType, and text are required', 400);
  }
  if (!['movie', 'series'].includes(contentType)) {
    return sendError(res, 'contentType must be "movie" or "series"', 400);
  }
  if (typeof text !== 'string' || text.trim().length === 0) {
    return sendError(res, 'Review text cannot be empty', 400);
  }
  if (text.length > 2000) {
    return sendError(res, 'Review text cannot exceed 2000 characters', 400);
  }

  const existingReview = await Review.findOne({ user: userId, contentId });

  const review = await Review.findOneAndUpdate(
    { user: userId, contentId },
    { contentType, text: text.trim(), user: userId },
    { new: true, upsert: true, runValidators: true }
  ).populate('user', 'username profile_pic_url');

  const statusCode = existingReview ? 200 : 201;
  const result = review.toObject();
  result.likeCount = result.likes?.length || 0;
  result.hasLiked = false;
  sendSuccess(res, result, 'Review saved successfully', statusCode);
});

/**
 * @route  DELETE /api/reviews/:reviewId
 * @access Private
 */
export const deleteMyReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user.id;

  if (!reviewId) return sendError(res, 'reviewId is required', 400);
  if (!reviewId.match(/^[0-9a-fA-F]{24}$/)) return sendError(res, 'Invalid review ID', 400);

  const review = await Review.findById(reviewId);
  if (!review) return sendError(res, 'Review not found', 404);
  if (review.user.toString() !== userId) {
    return sendError(res, 'You do not have permission to delete this review', 403);
  }

  await Review.deleteOne({ _id: reviewId });
  sendSuccess(res, null, 'Review deleted successfully');
});
