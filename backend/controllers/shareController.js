import mongoose from "mongoose";
import Share from "../models/Share.js";
import Review from "../models/Review.js";
import Rating from "../models/Rating.js";
import User from "../models/User.js";
import CustomList from "../models/CustomList.js";
import { hydratePreviewItems } from "../utils/listPreview.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError, sendPaginated } from "../utils/response.js";

const getMovie = () => mongoose.connection.model("Movie");
const getSeries = () => mongoose.connection.model("Series");

const MAX_LIMIT = 50;
// How many viewer avatars a share card actually shows. Also the number the
// query reads back — see getUserShares.
const TOP_VIEWERS_COUNT = 5;

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

  if (type === "list") {
    const { listId } = req.body;
    if (!listId) return sendError(res, "listId is required", 400);
    const list = await CustomList.findOne({ _id: listId, owner: userId, isPublic: true }).lean();
    if (!list) return sendError(res, "List not found", 404);

    // Bigger limit than the default 5 — this box stacks however many
    // posters actually fit the post's real width (PosterCascade's
    // fitToWidth on the mobile side), not a fixed small preview count.
    const [hydrated] = await hydratePreviewItems([list], 20);
    const share = await Share.create({
      user: userId,
      type: "list",
      listId: list._id,
      listData: {
        name: list.name,
        description: list.description,
        itemCount: list.items.length,
        previewItems: hydrated.previewItems,
      },
    });
    return sendSuccess(res, share, "Shared to Medya", 201);
  }

  return sendError(res, 'type must be "analysis", "review", "recommendation", or "list"', 400);
});

// A like is worth ~20h of recency, following the author ~53h — real enough
// to matter, not enough to bury every brand-new post from someone you
// don't follow. Replaces the old separate Sort (Recent/Popular/Network) +
// Type filter UI: recency/engagement/network are blended into one ranking
// instead of being exposed as manual controls the user has to pick between
// (same "remove the control, let the page organize itself" call already
// made for Discover's own tab bar earlier this session), and per-type
// filtering was dropped entirely since every post already carries its own
// icon/color badge (ShareCard.tsx's typeMeta) for visual scanning, plus
// dedicated full-browse pages already exist for Reviews/Lists specifically
// (/home/reviews, /home/lists-discover).
const FEED_LIKE_WEIGHT = 3;
const FEED_NETWORK_BOOST = 8;
const FEED_DECAY_PER_HOUR = 0.15;

// ── GET /api/shares/feed?page=&limit=&scope= ── scope defaults to "all"
// (the blended ranking above); "following" restricts to just the shares
// of people the caller follows, still ranked by the same score within
// that subset — a lightweight re-add of a "Friends" view, requested
// directly by the user after the broader Sort/Type filter UI was removed
// (see FEED_LIKE_WEIGHT's own comment above). Not the old removed
// "Network" sort mode brought back wholesale — that also changed the
// *ranking formula* itself; this is purely a hard filter on top of the
// exact same one ranking everyone else sees, so "All" and "Friends" never
// disagree on relative order, only on which posts are eligible at all.
// Following nobody legitimately returns an empty feed here, unlike the
// "all" scope's own following-agnostic fallback — that's the whole point
// of asking for just your friends' posts.
export const getShareFeed = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, MAX_LIMIT);
  const scope = req.query.scope === "following" ? "following" : "all";

  const currentUser = await User.findById(userId).select("following").lean();
  const followingIds = currentUser?.following || [];
  const now = new Date();
  const scopeMatch = scope === "following" ? [{ $match: { user: { $in: followingIds } } }] : [];
  const scopeCountQuery = scope === "following" ? { user: { $in: followingIds } } : {};

  const [items, total] = await Promise.all([
    Share.aggregate([
      ...scopeMatch,
      {
        $addFields: {
          isFollowed: { $in: ["$user", followingIds] },
          ageHours: { $divide: [{ $subtract: [now, "$createdAt"] }, 1000 * 60 * 60] },
        },
      },
      {
        $addFields: {
          score: {
            $subtract: [
              { $add: [{ $multiply: ["$likeCount", FEED_LIKE_WEIGHT] }, { $cond: ["$isFollowed", FEED_NETWORK_BOOST, 0] }] },
              { $multiply: ["$ageHours", FEED_DECAY_PER_HOUR] },
            ],
          },
        },
      },
      { $sort: { score: -1, createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $lookup: { from: "users", localField: "user", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $lookup: { from: "users", localField: "views", foreignField: "_id", as: "viewUsers" } },
      {
        $addFields: {
          liked: { $in: [new mongoose.Types.ObjectId(userId), "$likes"] },
          topViewers: { $slice: ["$viewUsers", 5] },
        },
      },
      {
        $project: {
          type: 1,
          analysisData: 1,
          reviewText: 1,
          reviewRating: 1,
          note: 1,
          contentId: 1,
          contentType: 1,
          contentData: 1,
          listId: 1,
          listData: 1,
          likeCount: 1,
          viewCount: 1,
          createdAt: 1,
          updatedAt: 1,
          liked: 1,
          "user._id": 1,
          "user.username": 1,
          "user.profile_pic_url": 1,
          "user.accountTier": 1,
          "topViewers._id": 1,
          "topViewers.username": 1,
          "topViewers.profile_pic_url": 1,
        },
      },
    ]),
    Share.countDocuments(scopeCountQuery),
  ]);

  sendSuccess(res, { items, page, hasMore: page * limit < total }, "Share feed fetched");
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

  // A "list" share is a snapshot post ABOUT a real CustomList, not its own
  // independent thing to like — liking the post should mean liking the
  // list, so the list's own `likes` (already the signal /lists/popular
  // ranks on) actually reflects engagement that happened via the feed, not
  // just via visiting the list detail page directly. Keeps the list's
  // like state as a mirror of this user's share-like state (set, not
  // re-toggle) so it can't drift out of sync on repeated toggles.
  if (share.type === "list" && share.listId) {
    const list = await CustomList.findById(share.listId).select("likes");
    if (list) {
      const listHasLiked = list.likes.some((id) => id.toString() === userId.toString());
      if (liked && !listHasLiked) {
        list.likes.push(userId);
        await list.save();
      } else if (!liked && listHasLiked) {
        list.likes.pull(userId);
        await list.save();
      }
    }
  }

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

    // Same reasoning as toggleShareLike above — a view of a "list" share is
    // a real view of the underlying list, so it should count toward the
    // list's own `views` counter (the same one /lists/:id increments when
    // someone visits the list directly), not just the share's own count.
    if (share.type === "list" && share.listId) {
      await CustomList.updateOne({ _id: share.listId }, { $inc: { views: 1 } });
    }
  }

  sendSuccess(res, { viewCount: share.viewCount }, "View registered");
});

// ── GET /api/shares/user/:userId?page=&limit= ──
export const getUserShares = asyncHandler(async (req, res) => {
  const targetUserId = req.params.userId === "me" ? req.user.id : req.params.userId;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, MAX_LIMIT);

  const requesterId = req.user.id;
  const query = { user: targetUserId };
  const [items, total] = await Promise.all([
    Share.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      // Only the handful of viewers actually rendered are read back. This
      // used to populate the FULL views array of every share on the page —
      // one User document per person who ever opened it — and then throw
      // all but the first five away, which on a well-viewed share meant
      // fetching hundreds of documents to display five avatars.
      .slice("views", TOP_VIEWERS_COUNT)
      // Likewise: `likes` is only read to answer "did I like this?", so ask
      // the database that question instead of hauling the whole array back.
      // likeCount is denormalized on the document, so the count is unaffected.
      .slice("likes", 0)
      // accountTier included here so Profile's own shares grid can drive
      // TierAvatarFrame — getShareFeed above uses a $lookup-based
      // aggregation instead of populate() and already selects
      // "user.accountTier" itself (see that function).
      .populate("user", "username profile_pic_url accountTier")
      .populate("views", "username profile_pic_url")
      .lean(),
    Share.countDocuments(query),
  ]);

  // One id-only query for the whole page, rather than a potentially huge
  // likes array attached to every share on it.
  const likedIds = new Set(
    (
      await Share.find({ _id: { $in: items.map((s) => s._id) }, likes: requesterId })
        .select("_id")
        .lean()
    ).map((s) => s._id.toString())
  );

  const withMeta = items.map((s) => ({
    ...s,
    liked: likedIds.has(s._id.toString()),
    // Also capped here: the $slice above is an optimization, and this
    // keeps the response shape identical regardless of whether it applied.
    topViewers: (s.views || []).slice(0, TOP_VIEWERS_COUNT),
    likes: undefined,
    views: undefined,
  }));

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
