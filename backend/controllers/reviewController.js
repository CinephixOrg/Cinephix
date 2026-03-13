// backend/controllers/reviewController.js
import Review from '../models/Review.js';
import User from '../models/User.js';

// New imports for consistent responses and error handling
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

/**
 * @desc   Belirli bir içeriğe ait tüm yorumları getirir
 * @route  GET /api/reviews/content/:contentId
 * @access Public (Herkes görebilir)
 */
export const getContentReviews = asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  if (!contentId) {
    return sendError(res, 'contentId is required', 400);
  }

  const reviews = await Review.find({ contentId })
    .populate('user', 'username profile_pic_url')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip)
    .lean();

  const total = await Review.countDocuments({ contentId });

  res.json({
    success: true,
    message: 'Reviews fetched',
    data: reviews,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / Math.max(parseInt(limit), 1))
    }
  });
});

/**
 * @desc   Yeni bir yorum ekler veya mevcut yorumu günceller
 * @route  POST /api/reviews
 * @access Private (Giriş Gerekli)
 * @body   { contentId: "...", contentType: "movie|series", text: "..." }
 */
export const addOrUpdateReview = asyncHandler(async (req, res) => {
  const { contentId, contentType, text } = req.body;
  const userId = req.user.id;

  // Validation
  if (!contentId || !contentType || !text) {
    return sendError(res, 'contentId, contentType, and text are required', 400);
  }

  if (!['movie', 'series'].includes(contentType)) {
    return sendError(res, 'contentType must be "movie" or "series"', 400);
  }

  if (typeof text !== 'string' || text.trim().length === 0) {
    return sendError(res, 'Review text cannot be empty', 400);
  }

  if (text.length > 5000) {
    return sendError(res, 'Review text cannot exceed 5000 characters', 400);
  }

  const review = await Review.findOneAndUpdate(
    { user: userId, contentId: contentId },
    { contentType: contentType, text: text.trim(), user: userId },
    { new: true, upsert: true, runValidators: true }
  ).populate('user', 'username profile_pic_url').lean();

  const statusCode = review.createdAt === review.updatedAt ? 201 : 200;
  sendSuccess(res, review, 'Review saved successfully', statusCode);
});

/**
 * @desc   Kullanıcının kendi yorumunu siler
 * @route  DELETE /api/reviews/:reviewId
 * @access Private (Giriş Gerekli)
 */
export const deleteMyReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user.id;

  if (!reviewId) {
    return sendError(res, 'reviewId is required', 400);
  }

  // Validate MongoDB ID
  if (!reviewId.match(/^[0-9a-fA-F]{24}$/)) {
    return sendError(res, 'Invalid review ID', 400);
  }

  const review = await Review.findById(reviewId);

  if (!review) {
    return sendError(res, 'Review not found', 404);
  }

  // Authorization check
  if (review.user.toString() !== userId) {
    return sendError(res, 'You do not have permission to delete this review', 403);
  }

  await Review.deleteOne({ _id: reviewId });

  sendSuccess(res, null, 'Review deleted successfully', 200);
});