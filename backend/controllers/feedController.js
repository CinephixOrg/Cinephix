// backend/controllers/feedController.js
import mongoose from "mongoose";
import User from "../models/User.js";
import Rating from "../models/Rating.js";
import Review from "../models/Review.js";
import Notification from "../models/Notification.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess } from "../utils/response.js";

// ── helpers ──────────────────────────────────────────────────────
const getMovie = () => mongoose.connection.model("Movie");
const getSeries = () => mongoose.connection.model("Series");


const ITEMS_PER_SOURCE = 60;
const MAX_LIMIT = 50;

export const getFeed = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, MAX_LIMIT);

  const currentUser = await User.findById(userId).select("following").lean();
  const followingIds = currentUser?.following || [];

  if (followingIds.length === 0) {
    return sendSuccess(res, { items: [], page, hasMore: false }, "Feed fetched");
  }

  const [ratings, reviews, followNotifs, followedUsers] = await Promise.all([
    Rating.find({ user: { $in: followingIds } })
      .sort({ createdAt: -1 })
      .limit(ITEMS_PER_SOURCE)
      .populate("user", "username profile_pic_url")
      .lean(),
    Review.find({ user: { $in: followingIds } })
      .sort({ createdAt: -1 })
      .limit(ITEMS_PER_SOURCE)
      .populate("user", "username profile_pic_url")
      .lean(),
    Notification.find({ sender: { $in: followingIds }, type: "follow" })
      .sort({ createdAt: -1 })
      .limit(ITEMS_PER_SOURCE)
      .populate("sender", "username profile_pic_url")
      .populate("user", "username profile_pic_url")
      .lean(),
    User.find({ _id: { $in: followingIds } })
      .select("username profile_pic_url watchlist")
      .lean(),
  ]);

  // Flatten watchlist additions into activity events
  const watchlistEvents = followedUsers.flatMap((u) =>
    (u.watchlist || []).map((item) => ({
      type: "watchlisted",
      user: { _id: u._id, username: u.username, profile_pic_url: u.profile_pic_url },
      contentId: item.itemId.toString(),
      contentType: item.itemType,
      createdAt: item.addedAt,
    }))
  );

  // Collect unique content IDs for bulk lookup
  const movieIds = new Set();
  const seriesIds = new Set();
  for (const r of [...ratings, ...reviews, ...watchlistEvents]) {
    if (r.contentType === "movie") movieIds.add(r.contentId);
    else seriesIds.add(r.contentId);
  }

  const [movies, seriesList] = await Promise.all([
    movieIds.size
      ? getMovie().find({ _id: { $in: [...movieIds] } }).select("_id title name poster_path").lean()
      : [],
    seriesIds.size
      ? getSeries().find({ _id: { $in: [...seriesIds] } }).select("_id title name poster_path").lean()
      : [],
  ]);

  const movieMap = Object.fromEntries(movies.map((m) => [m._id.toString(), m]));
  const seriesMap = Object.fromEntries(seriesList.map((s) => [s._id.toString(), s]));

  const resolveContent = (contentId, contentType) => {
    const item = contentType === "movie" ? movieMap[contentId] : seriesMap[contentId];
    if (!item) return null;
    return {
      id: contentId,
      title: item.title || item.name,
      poster_path: item.poster_path,
      type: contentType,
    };
  };

  const feedItems = [];

  for (const r of ratings) {
    const content = resolveContent(r.contentId, r.contentType);
    if (!content) continue;
    feedItems.push({ type: "rated", user: r.user, content, value: r.value, createdAt: r.createdAt });
  }

  for (const r of reviews) {
    const content = resolveContent(r.contentId, r.contentType);
    if (!content) continue;
    feedItems.push({
      type: "reviewed",
      user: r.user,
      content,
      excerpt: r.text?.substring(0, 150),
      createdAt: r.createdAt,
    });
  }

  for (const n of followNotifs) {
    if (!n.sender) continue;
    feedItems.push({
      type: "followed",
      user: n.sender,
      targetUser: n.user,
      createdAt: n.createdAt,
    });
  }

  for (const e of watchlistEvents) {
    const content = resolveContent(e.contentId, e.contentType);
    if (!content) continue;
    feedItems.push({ type: "watchlisted", user: e.user, content, createdAt: e.createdAt });
  }

  feedItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const start = (page - 1) * limit;
  const paginatedItems = feedItems.slice(start, start + limit);

  sendSuccess(
    res,
    { items: paginatedItems, page, hasMore: start + limit < feedItems.length },
    "Feed fetched"
  );
});

export const getTopPicks = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const limit = Math.min(parseInt(req.query.limit) || 10, 20);

  const currentUser = await User.findById(userId).select("following").lean();
  const followingIds = currentUser?.following || [];

  if (followingIds.length === 0) {
    return sendSuccess(res, [], "No top picks yet");
  }

  // Fetch all ratings from people the user follows
  const ratings = await Rating.find({ user: { $in: followingIds } })
    .populate("user", "username profile_pic_url")
    .lean();

  // Aggregate by content: sum ratings, collect raters
  const contentMap = {};
  for (const r of ratings) {
    const key = `${r.contentType}:${r.contentId}`;
    if (!contentMap[key]) {
      contentMap[key] = { contentId: r.contentId, contentType: r.contentType, total: 0, count: 0, raters: [] };
    }
    contentMap[key].total += r.value;
    contentMap[key].count += 1;
    contentMap[key].raters.push(r.user);
  }

  // Require at least 2 raters (or 1 if the network is very small)
  const minRaters = followingIds.length >= 3 ? 2 : 1;

  const candidates = Object.values(contentMap)
    .filter((c) => c.count >= minRaters)
    .map((c) => ({ ...c, avgRating: c.total / c.count }))
    .sort((a, b) => b.avgRating - a.avgRating || b.count - a.count)
    .slice(0, limit);

  if (candidates.length === 0) {
    return sendSuccess(res, [], "No top picks yet");
  }

  // Bulk-fetch content details
  const movieIds = candidates.filter((c) => c.contentType === "movie").map((c) => c.contentId);
  const seriesIds = candidates.filter((c) => c.contentType === "series").map((c) => c.contentId);

  const [movies, seriesList] = await Promise.all([
    movieIds.length ? getMovie().find({ _id: { $in: movieIds } }).select("_id title name poster_path").lean() : [],
    seriesIds.length ? getSeries().find({ _id: { $in: seriesIds } }).select("_id title name poster_path").lean() : [],
  ]);

  const movieMap = Object.fromEntries(movies.map((m) => [m._id.toString(), m]));
  const seriesMap = Object.fromEntries(seriesList.map((s) => [s._id.toString(), s]));

  const result = candidates.reduce((acc, c) => {
    const item = c.contentType === "movie" ? movieMap[c.contentId] : seriesMap[c.contentId];
    if (!item) return acc;
    acc.push({
      content: {
        id: c.contentId,
        title: item.title || item.name,
        poster_path: item.poster_path,
        type: c.contentType,
      },
      avgRating: Math.round(c.avgRating * 10) / 10,
      raterCount: c.count,
      topRaters: c.raters.slice(0, 3),
    });
    return acc;
  }, []);

  sendSuccess(res, result, "Top picks fetched");
});

// ── GET /api/feed/recommendations ──────────────────────────────────
// Genre-based recommendations derived from the user's CineGraph.
// Algorithm:
//   1. Score each genre: count × avgRating → take top 5
//   2. Find unwatched content in those genres sorted by vote_average
//   3. Fall back to globally popular content if CineGraph is empty
export const getRecommendations = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 40);
  const contentType = req.query.type || "all"; // "movie" | "series" | "all"

  const user = await User.findById(req.user._id)
    .select("watchlist toWatchList movieCineGraph seriesCineGraph")
    .lean();

  // IDs the user has already watched or queued — exclude from results
  const watchedIds = [
    ...(user.watchlist || []).map((w) => w.itemId.toString()),
    ...(user.toWatchList || []).map((w) => w.itemId.toString()),
  ];

  // Build genre scores: { genreId → score }
  const genreScore = {};
  const addGenres = (cineGraph) => {
    if (!cineGraph) return;
    const entries = cineGraph instanceof Map ? cineGraph.entries() : Object.entries(cineGraph);
    for (const [gid, stats] of entries) {
      const score = (stats.count || 0) * (stats.avgRating || 5);
      genreScore[gid] = (genreScore[gid] || 0) + score;
    }
  };
  if (contentType !== "series") addGenres(user.movieCineGraph);
  if (contentType !== "movie") addGenres(user.seriesCineGraph);

  const topGenreIds = Object.entries(genreScore)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => Number(id));

  const hasGenres = topGenreIds.length > 0;

  const baseQuery = {
    _id: { $nin: watchedIds },
    poster_path: { $exists: true, $ne: null, $ne: "" },
    vote_count: { $gte: 50 },
    vote_average: { $gte: 5.5 },
  };

  const genreQuery = hasGenres ? { ...baseQuery, genre_ids: { $in: topGenreIds } } : baseQuery;

  const fetchContent = async (model, query) =>
    model
      .find(query)
      .select("_id title name poster_path genre_ids vote_average release_date first_air_date")
      .sort({ vote_average: -1, vote_count: -1 })
      .limit(limit)
      .lean();

  let movies = [];
  let series = [];

  if (contentType !== "series") {
    movies = await fetchContent(getMovie(), genreQuery);
  }
  if (contentType !== "movie") {
    series = await fetchContent(getSeries(), genreQuery);
  }

  // Interleave movies and series
  const results = [];
  const maxLen = Math.max(movies.length, series.length);
  for (let i = 0; i < maxLen && results.length < limit; i++) {
    if (movies[i]) results.push({ ...movies[i], contentType: "movie" });
    if (series[i] && results.length < limit) results.push({ ...series[i], contentType: "series" });
  }

  sendSuccess(res, { recommendations: results, topGenreIds, hasPersonalization: hasGenres }, "Recommendations fetched");
});
