import mongoose from "mongoose";
import User from "../models/User.js";
import Rating from "../models/Rating.js";
import Review from "../models/Review.js";
import CustomList from "../models/CustomList.js";
import Group from "../models/Group.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess } from "../utils/response.js";

const getMovie = () => mongoose.connection.model("Movie");
const getSeries = () => mongoose.connection.model("Series");

const MAX_LIMIT = 50;

// ── GET /api/users/me/activity?range=week|month&page=&limit= ──
// The caller's own activity across ratings, reviews, review likes,
// watchlist/to-watch adds, list creation, and group joins — modeled
// directly on feedController.js's getFeed, scoped to the caller instead
// of their following list.
export const getMyActivity = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(parseInt(req.query.limit) || 10, MAX_LIMIT);
  const range = req.query.range === "month" ? "month" : "week";

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (range === "month" ? 30 : 7));

  const [ratings, reviews, likedReviews, meDoc, lists, groups] = await Promise.all([
    Rating.find({ user: userId, createdAt: { $gte: cutoff } }).sort({ createdAt: -1 }).lean(),
    Review.find({ user: userId, createdAt: { $gte: cutoff } }).sort({ createdAt: -1 }).lean(),
    Review.find({ likeEvents: { $elemMatch: { user: userId, likedAt: { $gte: cutoff } } } })
      .select("contentId contentType likeEvents")
      .lean(),
    User.findById(userId).select("watchlist toWatchList").lean(),
    CustomList.find({ owner: userId, createdAt: { $gte: cutoff } })
      .select("name createdAt")
      .sort({ createdAt: -1 })
      .lean(),
    Group.find({ members: { $elemMatch: { user: userId, joinedAt: { $gte: cutoff } } } })
      .select("name slug coverImage members.$")
      .lean(),
  ]);

  const watchlistEvents = (meDoc?.watchlist || []).filter(
    (item) => item.addedAt && new Date(item.addedAt) >= cutoff
  );
  const toWatchEvents = (meDoc?.toWatchList || []).filter(
    (item) => item.addedAt && new Date(item.addedAt) >= cutoff
  );

  const movieIds = new Set();
  const seriesIds = new Set();
  const addId = (contentId, contentType) => {
    if (contentType === "movie") movieIds.add(contentId.toString());
    else seriesIds.add(contentId.toString());
  };
  for (const r of ratings) addId(r.contentId, r.contentType);
  for (const r of reviews) addId(r.contentId, r.contentType);
  for (const r of likedReviews) addId(r.contentId, r.contentType);
  for (const item of watchlistEvents) addId(item.itemId, item.itemType);
  for (const item of toWatchEvents) addId(item.itemId, item.itemType);

  const [movies, seriesList] = await Promise.all([
    movieIds.size ? getMovie().find({ _id: { $in: [...movieIds] } }).select("_id title name poster_path").lean() : [],
    seriesIds.size ? getSeries().find({ _id: { $in: [...seriesIds] } }).select("_id title name poster_path").lean() : [],
  ]);
  const movieMap = Object.fromEntries(movies.map((m) => [m._id.toString(), m]));
  const seriesMap = Object.fromEntries(seriesList.map((s) => [s._id.toString(), s]));

  const resolveContent = (contentId, contentType) => {
    const item = contentType === "movie" ? movieMap[contentId.toString()] : seriesMap[contentId.toString()];
    if (!item) return null;
    return { id: contentId.toString(), title: item.title || item.name, poster_path: item.poster_path, type: contentType };
  };

  const events = [];

  for (const r of ratings) {
    const content = resolveContent(r.contentId, r.contentType);
    if (!content) continue;
    events.push({ type: "rated", content, value: r.value, createdAt: r.createdAt });
  }

  for (const r of reviews) {
    const content = resolveContent(r.contentId, r.contentType);
    if (!content) continue;
    events.push({ type: "reviewed", content, excerpt: r.text?.substring(0, 150), createdAt: r.createdAt });
  }

  for (const r of likedReviews) {
    const content = resolveContent(r.contentId, r.contentType);
    if (!content) continue;
    const myEvent = r.likeEvents.find((e) => e.user.toString() === userId.toString() && new Date(e.likedAt) >= cutoff);
    if (!myEvent) continue;
    events.push({ type: "review_liked", content, createdAt: myEvent.likedAt });
  }

  for (const item of watchlistEvents) {
    const content = resolveContent(item.itemId, item.itemType);
    if (!content) continue;
    events.push({ type: "watchlist_added", content, createdAt: item.addedAt });
  }

  for (const item of toWatchEvents) {
    const content = resolveContent(item.itemId, item.itemType);
    if (!content) continue;
    events.push({ type: "towatch_added", content, createdAt: item.addedAt });
  }

  for (const l of lists) {
    events.push({ type: "list_created", listId: l._id.toString(), listName: l.name, createdAt: l.createdAt });
  }

  for (const g of groups) {
    const member = (g.members || [])[0];
    events.push({
      type: "group_joined",
      groupSlug: g.slug,
      groupName: g.name,
      groupCoverImage: g.coverImage,
      createdAt: member?.joinedAt || g.createdAt,
    });
  }

  events.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const start = (page - 1) * limit;
  const items = events.slice(start, start + limit);

  sendSuccess(res, { items, page, hasMore: start + limit < events.length }, "Activity fetched");
});
