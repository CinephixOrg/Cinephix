import mongoose from "mongoose";
import Share from "../models/Share.js";
import Review from "../models/Review.js";
import Rating from "../models/Rating.js";
import User from "../models/User.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError, sendPaginated } from "../utils/response.js";

const getMovie = () => mongoose.connection.model("Movie");
const getSeries = () => mongoose.connection.model("Series");

const MAX_LIMIT = 50;

async function hydrateContentData(contentId, contentType) {
  const model = contentType === "movie" ? getMovie() : getSeries();
  const doc = await model.findById(contentId).select("title name poster_path release_date first_air_date").lean();
  if (!doc) return null;
  const date = contentType === "movie" ? doc.release_date : doc.first_air_date;
  return {
    title: doc.title || doc.name,
    posterUrl: doc.poster_path || null,
    releaseYear: date ? new Date(date).getFullYear() : undefined,
  };
}

// ── POST /api/shares ──
export const createShare = asyncHandler(async (req, res) => {
  const { type } = req.body;
  const userId = req.user.id;

  if (type === "analysis") {
    // Trusts client-supplied analysisData directly, same as the existing
    // DM analysis_share message flow already does (sendRichMessage's
    // analysisData is never server-verified either) — the mobile client's
    // ProfileAnalysis result has no persisted _id to look up (getProfileAnalysis
    // returns the raw generated content, not the created doc's id), so an
    // id-based lookup here isn't actually reachable from the real client.
    const { analysisData } = req.body;
    if (!analysisData || typeof analysisData !== "object") {
      return sendError(res, "analysisData is required", 400);
    }
    const share = await Share.create({ user: userId, type: "analysis", analysisData });
    return sendSuccess(res, share, "Shared to Medya", 201);
  }

  if (type === "review") {
    const { reviewId } = req.body;
    if (!reviewId) return sendError(res, "reviewId is required", 400);
    const review = await Review.findOne({ _id: reviewId, user: userId }).lean();
    if (!review) return sendError(res, "Review not found", 404);

    const [contentData, rating] = await Promise.all([
      hydrateContentData(review.contentId, review.contentType),
      Rating.findOne({ user: userId, contentId: review.contentId }).select("value").lean(),
    ]);
    if (!contentData) return sendError(res, "Content not found", 404);

    const share = await Share.create({
      user: userId,
      type: "review",
      reviewText: review.text,
      reviewRating: rating?.value ?? null,
      contentId: review.contentId,
      contentType: review.contentType,
      contentData,
    });
    return sendSuccess(res, share, "Shared to Medya", 201);
  }

  if (type === "recommendation") {
    const { contentId, contentType, note } = req.body;
    if (!contentId || !["movie", "series"].includes(contentType)) {
      return sendError(res, "contentId and a valid contentType are required", 400);
    }
    const contentData = await hydrateContentData(contentId, contentType);
    if (!contentData) return sendError(res, "Content not found", 404);

    const share = await Share.create({
      user: userId,
      type: "recommendation",
      contentId,
      contentType,
      contentData,
      note: note?.trim() || undefined,
    });
    return sendSuccess(res, share, "Shared to Medya", 201);
  }

  return sendError(res, 'type must be "analysis", "review", or "recommendation"', 400);
});

// ── GET /api/shares/feed?sort=recent|popular|network&type=&page=&limit= ──
export const getShareFeed = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, MAX_LIMIT);
  const sort = ["recent", "popular", "network"].includes(req.query.sort) ? req.query.sort : "recent";
  const type = ["analysis", "review", "recommendation"].includes(req.query.type) ? req.query.type : null;

  const query = {};
  if (type) query.type = type;

  if (sort === "network") {
    const currentUser = await User.findById(userId).select("following").lean();
    const followingIds = currentUser?.following || [];
    if (followingIds.length === 0) {
      return sendSuccess(res, { items: [], page, hasMore: false }, "Share feed fetched");
    }
    query.user = { $in: followingIds };
  }

  const sortSpec = sort === "popular" ? { likeCount: -1, createdAt: -1 } : { createdAt: -1 };

  const [items, total] = await Promise.all([
    Share.find(query)
      .sort(sortSpec)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("user", "username profile_pic_url")
      .populate("views", "username profile_pic_url")
      .lean(),
    Share.countDocuments(query),
  ]);

  const withMeta = items.map((s) => {
    const liked = (s.likes || []).some((id) => id.toString() === userId.toString());
    const topViewers = (s.views || []).slice(0, 3);
    return { ...s, liked, topViewers, likes: undefined, views: undefined };
  });

  sendSuccess(
    res,
    { items: withMeta, page, hasMore: page * limit < total },
    "Share feed fetched"
  );
});

// ── POST /api/shares/:id/like ── toggle the caller's own like on/off
export const toggleShareLike = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const share = await Share.findById(req.params.id);
  if (!share) return sendError(res, "Share not found", 404);

  const existingIndex = share.likes.findIndex((id) => id.toString() === userId.toString());
  let liked;

  if (existingIndex === -1) {
    share.likes.push(userId);
    share.likeCount += 1;
    liked = true;
  } else {
    share.likes.splice(existingIndex, 1);
    share.likeCount = Math.max(0, share.likeCount - 1);
    liked = false;
  }

  await share.save();
  sendSuccess(res, { likeCount: share.likeCount, liked }, "Like updated");
});

// ── POST /api/shares/:id/view ── idempotent: registers the caller as a
// unique viewer at most once, no-ops on repeat calls (e.g. the same card
// re-mounting while scrolling).
export const registerShareView = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const share = await Share.findById(req.params.id);
  if (!share) return sendError(res, "Share not found", 404);

  const alreadyViewed = share.views.some((id) => id.toString() === userId.toString());
  if (!alreadyViewed) {
    share.views.push(userId);
    share.viewCount += 1;
    await share.save();
  }

  sendSuccess(res, { viewCount: share.viewCount }, "View registered");
});

// ── GET /api/shares/user/:userId?page=&limit= ──
export const getUserShares = asyncHandler(async (req, res) => {
  const targetUserId = req.params.userId === "me" ? req.user.id : req.params.userId;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, MAX_LIMIT);

  const query = { user: targetUserId };
  const [items, total] = await Promise.all([
    Share.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      // accountTier included here only (not getShareFeed's populate above,
      // which also backs Home's SharesFeedSection/KesfetSection) — the
      // tiered avatar frame is Profile-tab-only for now.
      .populate("user", "username profile_pic_url accountTier")
      .populate("views", "username profile_pic_url")
      .lean(),
    Share.countDocuments(query),
  ]);

  const requesterId = req.user.id;
  const withMeta = items.map((s) => {
    const liked = (s.likes || []).some((id) => id.toString() === requesterId.toString());
    const topViewers = (s.views || []).slice(0, 3);
    return { ...s, liked, topViewers, likes: undefined, views: undefined };
  });

  sendPaginated(res, withMeta, total, page, limit, "User shares fetched");
});

// ── DELETE /api/shares/:id ── owner-only
export const deleteShare = asyncHandler(async (req, res) => {
  const share = await Share.findById(req.params.id);
  if (!share) return sendError(res, "Share not found", 404);
  if (share.user.toString() !== req.user.id.toString()) {
    return sendError(res, "Not authorized", 403);
  }
  await share.deleteOne();
  sendSuccess(res, null, "Share deleted");
});
