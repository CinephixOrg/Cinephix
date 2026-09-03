// backend/controllers/reviewController.js
import mongoose from "mongoose";
import Review from '../models/Review.js';
import Rating from '../models/Rating.js';
import User from '../models/User.js';

import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError, sendPaginated } from "../utils/response.js";

const getMovie = () => mongoose.connection.model("Movie");
const getSeries = () => mongoose.connection.model("Series");

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// getContentReviews/getFriendsReviews both operate on one fixed contentId,
// so a bulk map-based join is simpler than getPopularReviews' per-document
// $lookup aggregation (which needs the $lookup because contentId varies
// per row there).
const attachRatings = async (reviews, contentId) => {
  if (reviews.length === 0) return reviews;
  // review.user can be null if the populated user account was since
  // deleted, leaving an orphaned review — skip those rather than crashing.
  const userIds = reviews.filter((r) => r.user).map((r) => r.user._id);
  const ratings = userIds.length
    ? await Rating.find({ contentId, user: { $in: userIds } }).select('user value').lean()
    : [];
  const ratingMap = Object.fromEntries(ratings.map((r) => [r.user.toString(), r.value]));
  return reviews.map((r) => ({ ...r, rating: r.user ? ratingMap[r.user._id.toString()] ?? null : null }));
};

const withLikeMeta = (reviews, userId) =>
  reviews.map((r) => {
    const likes = r.likes || [];
    return {
      ...r,
      likeCount: likes.length,
      hasLiked: userId ? likes.some((id) => id.toString() === userId) : false,
    };
  });

// Bulk-fetches movie/series title+poster for a set of already-aggregated
// review docs (each already carrying `likeCount`/`rating`/a populated
// `user`) and shapes the final {_id,user,text,createdAt,likeCount,hasLiked,
// rating,content} response item — shared by getPopularReviews and
// getReviewsFeed, both of which run the same aggregation shape up to this
// point and only differ in their $match/$sort/$skip stages before it.
// Was two separate `.find()`s (movies, series) — folded into one aggregation
// seeded from the already-fetched `reviews`' distinct content refs via
// Mongo's `$documents` stage, joined against both `movies`/`series` by id
// (plain equality $lookup, not correlated — see activityController.js's
// getNetworkActivity for why that distinction matters at volume) and
// picking whichever matched. `$documents` needs a database-level
// {aggregate:1} command, which Model.aggregate() can't issue (always
// collection-scoped), hence the raw driver's db.aggregate() rather than a
// Model call. Review.contentId is a plain String while movies/series `_id`
// is a real ObjectId (Mongoose defaults `_id` to ObjectId even under
// `strict:false`) — the $convert step bridges that; a malformed id just
// fails to match rather than throwing.
async function hydrateReviewResults(reviews, userId) {
  if (reviews.length === 0) return [];
  const contentDocs = [
    ...new Map(reviews.map((r) => [`${r.contentType}:${r.contentId}`, { contentId: r.contentId, contentType: r.contentType }])).values(),
  ];

  const hydratedContent = await mongoose.connection.db
    .aggregate([
      { $documents: contentDocs },
      { $addFields: { _cidOid: { $convert: { input: "$contentId", to: "objectId", onError: null, onNull: null } } } },
      {
        $lookup: {
          from: "movies",
          localField: "_cidOid",
          foreignField: "_id",
          pipeline: [{ $project: { title: 1, name: 1, poster_path: 1 } }],
          as: "_movieMatch",
        },
      },
      {
        $lookup: {
          from: "series",
          localField: "_cidOid",
          foreignField: "_id",
          pipeline: [{ $project: { title: 1, name: 1, poster_path: 1 } }],
          as: "_seriesMatch",
        },
      },
      {
        $addFields: {
          _item: { $cond: [{ $eq: ["$contentType", "movie"] }, { $arrayElemAt: ["$_movieMatch", 0] }, { $arrayElemAt: ["$_seriesMatch", 0] }] },
        },
      },
      { $match: { _item: { $ne: null } } },
      { $project: { _id: 0, contentId: 1, contentType: 1, item: "$_item" } },
    ])
    .toArray();

  const contentMap = Object.fromEntries(hydratedContent.map((h) => [`${h.contentType}:${h.contentId}`, h.item]));

  return reviews.reduce((acc, r) => {
    const item = contentMap[`${r.contentType}:${r.contentId}`];
    if (!item) return acc;
    acc.push({
      _id: r._id,
      user: r.user,
      text: r.text,
      createdAt: r.createdAt,
      likeCount: r.likeCount,
      hasLiked: r.likes?.some((id) => id.toString() === userId),
      rating: r.rating ?? null,
      content: {
        id: r.contentId,
        title: item.title || item.name,
        poster_path: item.poster_path,
        type: r.contentType,
      },
    });
    return acc;
  }, []);
}

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
  const result = withLikeMeta(await attachRatings(reviews, contentId), userId);

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

  sendSuccess(res, withLikeMeta(await attachRatings(reviews, contentId), userId), "Friends reviews fetched");
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
    review.likeEvents = review.likeEvents.filter((e) => e.user.toString() !== userId.toString());
  } else {
    review.likes.push(userId);
    review.likeEvents.push({ user: userId, likedAt: new Date() });
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
  const type = ["movie", "series"].includes(req.query.type) ? req.query.type : null;
  const q = req.query.q?.trim();

  // Review.contentId points at a separate movies/series collection, so it
  // can't be $lookup'd within this aggregation the way `user`/`ratings` are
  // above — same two-step bulk map-join style already used elsewhere in
  // this file (attachRatings, getReviewsFromFriends): resolve matching
  // content IDs first, then filter reviews by contentId.
  let contentIdFilter = null;
  if (q) {
    const regex = { $regex: escapeRegex(q), $options: "i" };
    const [matchedMovies, matchedSeries] = await Promise.all([
      type === "series" ? [] : getMovie().find({ title: regex }).select("_id").limit(200).lean(),
      type === "movie" ? [] : getSeries().find({ name: regex }).select("_id").limit(200).lean(),
    ]);
    contentIdFilter = [...matchedMovies, ...matchedSeries].map((d) => d._id.toString());
    if (contentIdFilter.length === 0) return sendSuccess(res, [], "No popular reviews yet");
  }

  const reviews = await Review.aggregate([
    ...(type ? [{ $match: { contentType: type } }] : []),
    ...(contentIdFilter ? [{ $match: { contentId: { $in: contentIdFilter } } }] : []),
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
    {
      $lookup: {
        from: "ratings",
        let: { reviewUser: "$user._id", reviewContentId: "$contentId" },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ["$user", "$$reviewUser"] }, { $eq: ["$contentId", "$$reviewContentId"] }] } } },
          { $project: { value: 1 } },
        ],
        as: "ratingDoc",
      },
    },
    { $addFields: { rating: { $ifNull: [{ $arrayElemAt: ["$ratingDoc.value", 0] }, null] } } },
  ]);

  if (reviews.length === 0) return sendSuccess(res, [], "No popular reviews yet");

  const result = await hydrateReviewResults(reviews, userId);

  sendSuccess(res, result, "Popular reviews fetched");
});

/**
 * @route  GET /api/reviews/feed?page=&limit=
 * @access Private
 * Discover's Reviews tab feed — a single paginated query replacing what
 * used to be two separate, non-paginated calls (getPopularReviews +
 * getReviewsFromFriends) merged client-side. Friends' reviews surface
 * first (ranked by their own popularity), then everyone else's, also by
 * popularity — expressed as one sort key (`isFriend` computed in the
 * aggregation itself) rather than two independently-paginated queries,
 * so a single page is always correctly ordered and never repeats an item
 * across pages.
 */
export const getReviewsFeed = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(parseInt(req.query.limit) || 15, 30);

  // authMiddleware already fetched the caller's full document (and
  // coalesces concurrent lookups for the same request burst) — reusing
  // `req.user.following` instead of re-fetching it here removes one more
  // redundant round trip.
  const followingIds = req.user.following || [];

  const [reviews, total] = await Promise.all([
    Review.aggregate([
      {
        $addFields: {
          likeCount: { $size: { $ifNull: ["$likes", []] } },
          isFriend: { $in: ["$user", followingIds] },
        },
      },
      { $sort: { isFriend: -1, likeCount: -1, createdAt: -1 } },
      { $skip: (page - 1) * limit },
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
      {
        $lookup: {
          from: "ratings",
          let: { reviewUser: "$user._id", reviewContentId: "$contentId" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$user", "$$reviewUser"] }, { $eq: ["$contentId", "$$reviewContentId"] }] } } },
            { $project: { value: 1 } },
          ],
          as: "ratingDoc",
        },
      },
      { $addFields: { rating: { $ifNull: [{ $arrayElemAt: ["$ratingDoc.value", 0] }, null] } } },
    ]),
    Review.countDocuments({}),
  ]);

  const hydrated = await hydrateReviewResults(reviews, userId);
  // hydrateReviewResults can drop entries whose content lookup failed
  // (orphaned contentId) — reattach isFriend by _id rather than assuming
  // index alignment with the pre-hydration `reviews` array.
  const friendIds = new Set(reviews.filter((r) => r.isFriend).map((r) => r._id.toString()));
  const items = hydrated.map((r) => ({ ...r, fromFriend: friendIds.has(r._id.toString()) }));

  sendSuccess(res, { items, page, hasMore: page * limit < total }, "Reviews feed fetched");
});

/**
 * @route  GET /api/reviews/friends
 * @access Private
 * Global "reviews from people you follow" feed (most recent), for the
 * Home page's Reviews tab — distinct from getFriendsReviews above, which is
 * scoped to a single piece of content on the Content Detail page.
 */
export const getReviewsFromFriends = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const limit = Math.min(parseInt(req.query.limit) || 10, 30);
  const type = ["movie", "series"].includes(req.query.type) ? req.query.type : null;

  const currentUser = await User.findById(userId).select("following").lean();
  const followingIds = currentUser?.following || [];

  if (followingIds.length === 0) {
    return sendSuccess(res, [], "No friends reviews yet");
  }

  const query = { user: { $in: followingIds } };
  if (type) query.contentType = type;

  let reviews = await Review.find(query)
    .populate("user", "username profile_pic_url")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  if (reviews.length === 0) return sendSuccess(res, [], "No friends reviews yet");

  const movieIds = reviews.filter((r) => r.contentType === "movie").map((r) => r.contentId);
  const seriesIds = reviews.filter((r) => r.contentType === "series").map((r) => r.contentId);
  const reviewUserIds = reviews.map((r) => r.user._id);

  const [movies, seriesList, ratings] = await Promise.all([
    movieIds.length ? getMovie().find({ _id: { $in: movieIds } }).select("_id title name poster_path").lean() : [],
    seriesIds.length ? getSeries().find({ _id: { $in: seriesIds } }).select("_id title name poster_path").lean() : [],
    Rating.find({ user: { $in: reviewUserIds }, contentId: { $in: [...movieIds, ...seriesIds] } })
      .select("user contentId value")
      .lean(),
  ]);

  const movieMap = Object.fromEntries(movies.map((m) => [m._id.toString(), m]));
  const seriesMap = Object.fromEntries(seriesList.map((s) => [s._id.toString(), s]));
  const ratingMap = Object.fromEntries(
    ratings.map((r) => [`${r.user.toString()}:${r.contentId}`, r.value])
  );

  const result = reviews.reduce((acc, r) => {
    const item = r.contentType === "movie" ? movieMap[r.contentId] : seriesMap[r.contentId];
    if (!item) return acc;
    acc.push({
      _id: r._id,
      user: r.user,
      text: r.text,
      createdAt: r.createdAt,
      likeCount: r.likes?.length || 0,
      hasLiked: r.likes?.some((id) => id.toString() === userId),
      rating: ratingMap[`${r.user._id.toString()}:${r.contentId}`] ?? null,
      content: {
        id: r.contentId,
        title: item.title || item.name,
        poster_path: item.poster_path,
        type: r.contentType,
      },
    });
    return acc;
  }, []);

  sendSuccess(res, result, "Friends reviews fetched");
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
