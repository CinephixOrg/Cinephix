// backend/controllers/feedController.js
import mongoose from "mongoose";
import User from "../models/User.js";
import Rating from "../models/Rating.js";
import Review from "../models/Review.js";
import Share from "../models/Share.js";
import Notification from "../models/Notification.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess } from "../utils/response.js";
import { MOVIE_GENRE_MAP, SERIES_GENRE_MAP } from "../utils/genreConstants.js";
import { computeAllUsersBadgeCounts, tierForCount } from "./badgeController.js";

// ── helpers ──────────────────────────────────────────────────────
const getMovie = () => mongoose.connection.model("Movie");
const getSeries = () => mongoose.connection.model("Series");

// Reverse of MOVIE_GENRE_MAP/SERIES_GENRE_MAP (id->name) — CineGraph
// entries (ratingController.js's updateCineGraph) are keyed by genre NAME,
// not the numeric TMDB id Movie/Series documents actually store in their
// own genre_ids array, so getRecommendations below needs to convert back.
// Built per content type since movie and series genre ids/names diverge
// for the same concept (e.g. movie "Action" is 28, series "Action &
// Adventure" is 10759) — a single shared name->id map would silently
// cross-contaminate the two.
const MOVIE_GENRE_NAME_TO_ID = Object.fromEntries(Object.entries(MOVIE_GENRE_MAP).map(([id, name]) => [name, Number(id)]));
const SERIES_GENRE_NAME_TO_ID = Object.fromEntries(Object.entries(SERIES_GENRE_MAP).map(([id, name]) => [name, Number(id)]));


const ITEMS_PER_SOURCE = 60;
const MAX_LIMIT = 50;

export const getFeed = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, MAX_LIMIT);
  const contentType = ["movie", "series"].includes(req.query.contentType) ? req.query.contentType : null;

  const currentUser = await User.findById(userId).select("following").lean();
  const followingIds = currentUser?.following || [];

  if (followingIds.length === 0) {
    return sendSuccess(res, { items: [], page, hasMore: false }, "Feed fetched");
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const ratingQuery = { user: { $in: followingIds }, createdAt: { $gte: sevenDaysAgo } };
  const reviewQuery = { user: { $in: followingIds }, createdAt: { $gte: sevenDaysAgo } };
  if (contentType) {
    ratingQuery.contentType = contentType;
    reviewQuery.contentType = contentType;
  }

  const [ratings, reviews, followNotifs, followedUsers] = await Promise.all([
    Rating.find(ratingQuery)
      .sort({ createdAt: -1 })
      .limit(ITEMS_PER_SOURCE)
      .populate("user", "username profile_pic_url")
      .lean(),
    Review.find(reviewQuery)
      .sort({ createdAt: -1 })
      .limit(ITEMS_PER_SOURCE)
      .populate("user", "username profile_pic_url")
      .lean(),
    // Follow events aren't content-specific, so a type-scoped feed excludes
    // them entirely rather than returning events with no movie/series.
    contentType
      ? []
      : Notification.find({ sender: { $in: followingIds }, type: "follow", createdAt: { $gte: sevenDaysAgo } })
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
    (u.watchlist || [])
      .filter(
        (item) =>
          item.addedAt &&
          new Date(item.addedAt) >= sevenDaysAgo &&
          (!contentType || item.itemType === contentType)
      )
      .map((item) => ({
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

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Fetch all ratings from people the user follows within the last 30 days
  const ratings = await Rating.find({
    user: { $in: followingIds },
    createdAt: { $gte: thirtyDaysAgo },
  })
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
// Shared by getPopularThisWeek and getPopularWithFriends — both rank
// watchlist/toWatchList adds within a time window, optionally scoped to a
// specific set of owning users, and attach up to 3 adder identities per item.
async function getPopularAdds({ matchUsers, type, limit, sinceDate }) {
  const buildPipeline = (field) => {
    const pipeline = [];
    if (matchUsers) pipeline.push({ $match: { _id: { $in: matchUsers } } });
    pipeline.push({ $unwind: `$${field}` });
    const dateMatch = { [`${field}.addedAt`]: { $gte: sinceDate } };
    const match = type ? { ...dateMatch, [`${field}.itemType`]: type } : dateMatch;
    pipeline.push({ $match: match });
    pipeline.push({
      $group: {
        _id: { itemId: `$${field}.itemId`, itemType: `$${field}.itemType` },
        count: { $sum: 1 },
        adderIds: { $push: "$_id" },
      },
    });
    return pipeline;
  };

  const [watchlistStats, toWatchStats] = await Promise.all([
    User.aggregate(buildPipeline("watchlist")),
    User.aggregate(buildPipeline("toWatchList")),
  ]);

  const countMap = {};
  for (const stat of [...watchlistStats, ...toWatchStats]) {
    const key = `${stat._id.itemType}:${stat._id.itemId}`;
    if (!countMap[key]) {
      countMap[key] = {
        itemId: stat._id.itemId.toString(),
        itemType: stat._id.itemType,
        count: 0,
        adderIds: [],
      };
    }
    countMap[key].count += stat.count;
    countMap[key].adderIds.push(...stat.adderIds);
  }

  const sorted = Object.values(countMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((c) => {
      // A user can have the same item in both `watchlist` and `toWatchList`
      // at once, so adderIds (merged from both pipelines above) can contain
      // the same user twice — dedupe before taking the top 3 for display.
      const uniqueAdderIds = [...new Map(c.adderIds.map((id) => [id.toString(), id])).values()];
      return { ...c, adderIds: uniqueAdderIds.slice(0, 3) };
    });

  if (sorted.length === 0) return [];

  const movieIds = sorted.filter((c) => c.itemType === "movie").map((c) => c.itemId);
  const seriesIds = sorted.filter((c) => c.itemType === "series").map((c) => c.itemId);
  const allAdderIds = [...new Set(sorted.flatMap((c) => c.adderIds.map((id) => id.toString())))];

  const [hydrated, adders, ratingStats] = await Promise.all([
    // Movies and series were two separate `.find()`s before — folded into
    // one aggregation seeded from `sorted` (already computed above) via
    // $documents, each item joined against both `movies` and `series` by id
    // (plain equality $lookup, not a correlated one — see
    // activityController.js's own getNetworkActivity for why that
    // distinction matters at volume) and picking whichever matched.
    // $documents needs a database-level {aggregate:1} command, not a
    // collection-scoped one, hence the raw driver's db.aggregate() rather
    // than a Model.aggregate() call. `itemId` is a String here (this
    // function's own JS-side dedupe/count step normalizes it via
    // `.toString()`) but `movies`/`series` `_id` is a real ObjectId
    // (Mongoose defaults `_id` to ObjectId even under `strict:false`) — the
    // $convert step bridges that; a malformed id just fails to match rather
    // than throwing.
    mongoose.connection.db
      .aggregate([
        { $documents: sorted.map((c) => ({ itemId: c.itemId, itemType: c.itemType })) },
        { $addFields: { _itemIdOid: { $convert: { input: "$itemId", to: "objectId", onError: null, onNull: null } } } },
        {
          $lookup: {
            from: "movies",
            localField: "_itemIdOid",
            foreignField: "_id",
            pipeline: [{ $project: { title: 1, name: 1, poster_path: 1, release_date: 1 } }],
            as: "_movieMatch",
          },
        },
        {
          $lookup: {
            from: "series",
            localField: "_itemIdOid",
            foreignField: "_id",
            pipeline: [{ $project: { title: 1, name: 1, poster_path: 1, first_air_date: 1 } }],
            as: "_seriesMatch",
          },
        },
        {
          $addFields: {
            _item: { $cond: [{ $eq: ["$itemType", "movie"] }, { $arrayElemAt: ["$_movieMatch", 0] }, { $arrayElemAt: ["$_seriesMatch", 0] }] },
          },
        },
        { $match: { _item: { $ne: null } } },
        { $project: { _id: 0, itemId: 1, itemType: 1, item: "$_item" } },
      ])
      .toArray(),
    allAdderIds.length ? User.find({ _id: { $in: allAdderIds } }).select("username profile_pic_url").lean() : [],
    // Bulk average — one aggregation for the whole rail rather than a
    // per-item lookup (getAllRatingsForContent's own per-content-page
    // pattern doesn't scale to a 20-40 item rail). Rating.value is 1-10;
    // stays that scale on the wire, same as everywhere else in this app —
    // StarRatingDisplay already halves it to a 5-star scale itself.
    [...movieIds, ...seriesIds].length
      ? Rating.aggregate([
          { $match: { contentId: { $in: [...movieIds, ...seriesIds] } } },
          { $group: { _id: "$contentId", avgRating: { $avg: "$value" }, ratingCount: { $sum: 1 } } },
        ])
      : [],
  ]);

  const itemMap = Object.fromEntries(hydrated.map((h) => [h.itemId, h.item]));
  const adderMap = Object.fromEntries(adders.map((u) => [u._id.toString(), u]));
  const ratingMap = Object.fromEntries(ratingStats.map((r) => [r._id, { avgRating: r.avgRating, ratingCount: r.ratingCount }]));

  return sorted.reduce((acc, c) => {
    const item = itemMap[c.itemId];
    if (!item) return acc;
    // Same release_date/first_air_date → releaseYear extraction shareController.js's
    // hydrateContentData already does for review/recommendation shares.
    const date = c.itemType === "movie" ? item.release_date : item.first_air_date;
    const rating = ratingMap[c.itemId];
    acc.push({
      content: {
        id: c.itemId,
        title: item.title || item.name,
        poster_path: item.poster_path,
        type: c.itemType,
        releaseYear: date ? new Date(date).getFullYear() : undefined,
        avgRating: rating?.avgRating,
        ratingCount: rating?.ratingCount,
      },
      addCount: c.count,
      topAdders: c.adderIds.map((id) => adderMap[id.toString()]).filter(Boolean),
    });
    return acc;
  }, []);
}

export const getPopularThisWeek = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 40);
  const type = ["movie", "series"].includes(req.query.type) ? req.query.type : null;
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const result = await getPopularAdds({ matchUsers: null, type, limit, sinceDate: oneWeekAgo });
  sendSuccess(res, result, "Popular this week fetched");
});

export const getPopularWithFriends = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 40);
  const type = ["movie", "series"].includes(req.query.type) ? req.query.type : null;
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // authMiddleware already fetched the caller's full document (and
  // coalesces concurrent lookups for the same request burst) — reusing
  // `req.user.following` instead of re-fetching it here removes one more
  // redundant round trip.
  const followingIds = req.user.following || [];

  if (followingIds.length === 0) {
    return sendSuccess(res, [], "No popular-with-friends content this week");
  }

  const result = await getPopularAdds({ matchUsers: followingIds, type, limit, sinceDate: oneWeekAgo });
  sendSuccess(res, result, "Popular with friends fetched");
});

// A single rated/favorited item can silently drop below the movie/series
// bulk-hydration step (orphaned contentId) — filters those out the same
// way getPopularAdds's own reduce does.
async function hydrateLeaderboardEntries(entries) {
  const movieIds = entries.filter((e) => e.itemType === "movie").map((e) => e.itemId);
  const seriesIds = entries.filter((e) => e.itemType === "series").map((e) => e.itemId);

  const [movies, seriesList] = await Promise.all([
    movieIds.length ? getMovie().find({ _id: { $in: movieIds } }).select("_id title name poster_path").lean() : [],
    seriesIds.length ? getSeries().find({ _id: { $in: seriesIds } }).select("_id title name poster_path").lean() : [],
  ]);
  const movieMap = Object.fromEntries(movies.map((m) => [m._id.toString(), m]));
  const seriesMap = Object.fromEntries(seriesList.map((s) => [s._id.toString(), s]));

  return entries.reduce((acc, e) => {
    const item = e.itemType === "movie" ? movieMap[e.itemId] : seriesMap[e.itemId];
    if (!item) return acc;
    acc.push({
      ...e,
      content: {
        id: e.itemId,
        title: item.title || item.name,
        poster_path: item.poster_path,
        type: e.itemType,
      },
    });
    return acc;
  }, []);
}

// A single vote (10/10 from one person) shouldn't be able to top the
// "highest rated" leaderboard over something 50 people rated 8/10 —
// requires at least this many Cinephix ratings to qualify.
const LEADERBOARD_MIN_RATING_COUNT = 3;
const LEADERBOARD_SIZE = 3;

// @route GET /api/feed/leaderboard
// Discover's 5-category content podium — all-time, content-only signals
// (complements the This-Week-scoped Trending rails above them on the same
// page). Most Favorited / Highest Rated / Most Recommended were the
// original 3; Most Watched (watchlist size, mirroring the people podium's
// own identical category below) and Most Reviewed (review count) were
// added later, per direct ask, once the 3-way Free/Plus/Premium visibility
// split (see LeaderboardPodium.tsx's own doc comment) made "5 is an
// optimal round number" a real design goal, not just an incidental count.
// All 5 default to combined movie+series rankings (matching how Friends'
// Choice already mixes types in one rail), but accept an optional
// ?type=movie|series to scope all 5 lists to one content type at once —
// the podium's own mode toggle, same "ignore anything not exactly
// movie/series" validation as getPopularWithFriends's own type param. Each
// list carries only its own metric (no cross-enrichment) — an earlier
// version showed both favorite count and rating on every card regardless
// of list, but the user's own follow-up simplified the podium back to one
// metric per page, so the heavier "fetch every rating ever given" query
// that cross-enrichment needed is gone too, not just unused on the client.
// Extracted from the getLeaderboard route handler so
// officialContentService's own "highlight" post generator can reuse the
// exact same ranking data (not a second, potentially-drifting copy) — same
// reasoning getPeopleThreePodiums below already documents for its own
// extraction.
export async function computeLeaderboard(type) {
  const [movieFavStats, seriesFavStats, ratingStats, recommendStats, watchedStats, reviewedStats] = await Promise.all([
    type && type !== "movie"
      ? []
      : User.aggregate([
          { $match: { favoriteMovies: { $exists: true, $ne: [] } } },
          { $unwind: "$favoriteMovies" },
          { $group: { _id: "$favoriteMovies", favoriteCount: { $sum: 1 } } },
        ]),
    type && type !== "series"
      ? []
      : User.aggregate([
          { $match: { favoriteSeries: { $exists: true, $ne: [] } } },
          { $unwind: "$favoriteSeries" },
          { $group: { _id: "$favoriteSeries", favoriteCount: { $sum: 1 } } },
        ]),
    Rating.aggregate([
      ...(type ? [{ $match: { contentType: type } }] : []),
      { $group: { _id: { itemId: "$contentId", itemType: "$contentType" }, avgRating: { $avg: "$value" }, ratingCount: { $sum: 1 } } },
      { $match: { ratingCount: { $gte: LEADERBOARD_MIN_RATING_COUNT } } },
      { $sort: { avgRating: -1 } },
      { $limit: LEADERBOARD_SIZE },
    ]),
    Share.aggregate([
      { $match: { type: "recommendation", ...(type ? { contentType: type } : {}) } },
      { $group: { _id: { itemId: "$contentId", itemType: "$contentType" }, recommendCount: { $sum: 1 } } },
      { $sort: { recommendCount: -1 } },
      { $limit: LEADERBOARD_SIZE },
    ]),
    // Same shape as getPeopleThreePodiums' own Most Watched below, just
    // grouped by content instead of by user — how many watchlists a title
    // sits in, all-time.
    User.aggregate([
      { $unwind: "$watchlist" },
      ...(type ? [{ $match: { "watchlist.itemType": type } }] : []),
      { $group: { _id: { itemId: "$watchlist.itemId", itemType: "$watchlist.itemType" }, watchedCount: { $sum: 1 } } },
      { $sort: { watchedCount: -1 } },
      { $limit: LEADERBOARD_SIZE },
    ]).allowDiskUse(true),
    // Content-side twin of getPeopleThreePodiums' own Most Reviewed —
    // review count per title instead of per reviewer.
    Review.aggregate([
      ...(type ? [{ $match: { contentType: type } }] : []),
      { $group: { _id: { itemId: "$contentId", itemType: "$contentType" }, reviewCount: { $sum: 1 } } },
      { $sort: { reviewCount: -1 } },
      { $limit: LEADERBOARD_SIZE },
    ]),
  ]);

  const mostFavoritedEntries = [
    ...movieFavStats.map((s) => ({ itemId: s._id.toString(), itemType: "movie", favoriteCount: s.favoriteCount })),
    ...seriesFavStats.map((s) => ({ itemId: s._id.toString(), itemType: "series", favoriteCount: s.favoriteCount })),
  ]
    .sort((a, b) => b.favoriteCount - a.favoriteCount)
    .slice(0, LEADERBOARD_SIZE);

  const highestRatedEntries = ratingStats.map((r) => ({
    itemId: r._id.itemId,
    itemType: r._id.itemType,
    avgRating: r.avgRating,
    ratingCount: r.ratingCount,
  }));

  const mostRecommendedEntries = recommendStats.map((r) => ({
    itemId: r._id.itemId,
    itemType: r._id.itemType,
    recommendCount: r.recommendCount,
  }));

  const mostWatchedEntries = watchedStats.map((w) => ({
    itemId: w._id.itemId,
    itemType: w._id.itemType,
    watchedCount: w.watchedCount,
  }));

  const mostReviewedEntries = reviewedStats.map((r) => ({
    itemId: r._id.itemId,
    itemType: r._id.itemType,
    reviewCount: r.reviewCount,
  }));

  const [mostFavorited, highestRated, mostRecommended, mostWatched, mostReviewed] = await Promise.all([
    hydrateLeaderboardEntries(mostFavoritedEntries),
    hydrateLeaderboardEntries(highestRatedEntries),
    hydrateLeaderboardEntries(mostRecommendedEntries),
    hydrateLeaderboardEntries(mostWatchedEntries),
    hydrateLeaderboardEntries(mostReviewedEntries),
  ]);

  return { mostFavorited, highestRated, mostRecommended, mostWatched, mostReviewed };
}

export const getLeaderboard = asyncHandler(async (req, res) => {
  const type = ["movie", "series"].includes(req.query.type) ? req.query.type : null;
  const result = await computeLeaderboard(type);
  sendSuccess(res, result, "Leaderboard fetched");
});

// A raw {_id, <metricKey>} aggregate result (Review/Share group-by-user
// output — everything here except followedRaw/watchedRaw above, which
// already project user fields directly) only carries the user's _id, not
// their identity — bulk-hydrate it in one lookup, same "bulk lookup, drop
// anything missing" shape used for every one of these lists. `metricKey`
// is copied onto the returned `user`-shaped entry alongside `user` itself.
async function hydratePeopleEntries(raw, metricKey) {
  const users = await User.find({ _id: { $in: raw.map((r) => r._id) } })
    .select("username profile_pic_url accountTier")
    .lean();
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));
  return raw
    .filter((r) => userMap.has(r._id.toString()))
    .map((r) => {
      const u = userMap.get(r._id.toString());
      return {
        user: { id: u._id.toString(), username: u.username, profile_pic_url: u.profile_pic_url, accountTier: u.accountTier },
        [metricKey]: r[metricKey],
      };
    });
}

// @route GET /api/feed/people-leaderboard
// Medya/Shares' own podium — ranks people, not content, so it lives on
// the social tab rather than Discover (Discover's podium above is
// deliberately content-only; a "top users" ranking doesn't help anyone
// find something to watch, which is Discover's whole point). Most
// Followed (social reach), Most Watched (consumption volume, from the
// `watchlist` field — the *already-watched* list, not `toWatchList`),
// Most Reviewed (contribution — a real, already-existing signal with
// built-in gaming resistance since a review takes real effort). Most Liked
// (total likes received across a user's own Shares — a "most popular
// poster" signal) and Top Recommenders (count of type:"recommendation"
// Shares sent — "most active recommender") were added later, per direct
// ask, once the 3-way Free/Plus/Premium visibility split (see
// PeoplePodium.tsx's own doc comment) made "5 is an optimal round number"
// a real design goal, not just an incidental count. Most Badges (total
// badge count across BOTH genre and volume families — see
// computeAllUsersBadgeCounts's own doc comment in badgeController.js for
// how one comparable number is derived from two differently-shaped badge
// systems) was added later still, once the badge feature itself existed.
// Only Most Watched has a movie/series dimension, so `?type=` only
// actually changes that one list — the other categories ignore it, same
// as how Most Favorited/Highest Rated already behave under
// `getLeaderboard`.
// Extracted so activityController.js's own "so-and-so made the podium"
// activity items (see its own doc comment) can check the *exact* same
// current top-3s this podium itself shows, rather than a second,
// potentially-drifting copy of this same ranking logic.
export async function getPeopleThreePodiums(type) {
  // The official Cinephix account (isOfficial:true) is deliberately excluded
  // from every single one of these 5 rankings — it auto-posts on a fixed
  // schedule and would otherwise game Most Reviewed/Most Recommended purely
  // by volume, and its follower count isn't a "most popular person" signal
  // in the sense this podium means. User.aggregate's own two pipelines
  // (followedRaw/watchedRaw) exclude it directly via `isOfficial`; Review/
  // Share are grouped by a raw `user` ObjectId with no such field on those
  // collections, so those three resolve the official account's own _id once
  // and exclude by id instead.
  const officialUser = await User.findOne({ isOfficial: true }).select("_id").lean();
  const officialUserId = officialUser?._id;
  const excludeOfficialAuthor = officialUserId ? [{ $match: { user: { $ne: officialUserId } } }] : [];

  // followerCount/watchedCount are computed per-request over every user
  // document (no index can back a $sort on either) — genuinely free at
  // this collection's current real size (live-checked: 97 users) but the
  // same "silently breaks past 100MB in-memory sort" risk as
  // getShareFeed's own identical situation above in shareController.js.
  // .allowDiskUse(true) added defensively for the same reason.
  // Most Badges' own raw fetch — unlike the other 4 people-rankings above,
  // there's no persisted field or single-field aggregate to $sort on (a
  // badge count is computed, not stored), so this pulls every non-official
  // user's own `watchlist` into memory once and hands it to
  // computeAllUsersBadgeCounts (badgeController.js), which batches the
  // Movie/Series genre_ids lookups across ALL of them in one pair of
  // queries rather than per-user. Same "genuinely free at this app's
  // current real size (97 users), watch for scale" caveat as the two
  // aggregates above.
  const badgeUsersRaw = await User.find({ isOfficial: { $ne: true } })
    .select("username profile_pic_url accountTier watchlist followers createdAt currentStreak lastStreakDate")
    .lean();

  const [followedRaw, watchedRaw, reviewedRaw, likedRaw, recommendersRaw] = await Promise.all([
    User.aggregate([
      { $match: { isOfficial: { $ne: true } } },
      { $project: { username: 1, profile_pic_url: 1, accountTier: 1, followerCount: { $size: { $ifNull: ["$followers", []] } } } },
      { $match: { followerCount: { $gte: 1 } } },
      { $sort: { followerCount: -1 } },
      { $limit: LEADERBOARD_SIZE },
    ]).allowDiskUse(true),
    User.aggregate([
      { $match: { isOfficial: { $ne: true } } },
      {
        $project: {
          username: 1,
          profile_pic_url: 1,
          accountTier: 1,
          watchedCount: type
            ? { $size: { $filter: { input: { $ifNull: ["$watchlist", []] }, cond: { $eq: ["$$this.itemType", type] } } } }
            : { $size: { $ifNull: ["$watchlist", []] } },
        },
      },
      { $match: { watchedCount: { $gte: 1 } } },
      { $sort: { watchedCount: -1 } },
      { $limit: LEADERBOARD_SIZE },
    ]).allowDiskUse(true),
    Review.aggregate([
      ...excludeOfficialAuthor,
      { $group: { _id: "$user", reviewCount: { $sum: 1 } } },
      { $sort: { reviewCount: -1 } },
      { $limit: LEADERBOARD_SIZE },
    ]).allowDiskUse(true),
    Share.aggregate([
      ...excludeOfficialAuthor,
      { $group: { _id: "$user", likeCount: { $sum: "$likeCount" } } },
      { $match: { likeCount: { $gte: 1 } } },
      { $sort: { likeCount: -1 } },
      { $limit: LEADERBOARD_SIZE },
    ]).allowDiskUse(true),
    Share.aggregate([
      { $match: { type: "recommendation" } },
      ...excludeOfficialAuthor,
      { $group: { _id: "$user", recommendCount: { $sum: 1 } } },
      { $sort: { recommendCount: -1 } },
      { $limit: LEADERBOARD_SIZE },
    ]).allowDiskUse(true),
  ]);

  const [mostReviewed, mostLiked, topRecommenders] = await Promise.all([
    hydratePeopleEntries(reviewedRaw, "reviewCount"),
    hydratePeopleEntries(likedRaw, "likeCount"),
    hydratePeopleEntries(recommendersRaw, "recommendCount"),
  ]);

  const mostFollowed = followedRaw.map((d) => ({
    user: { id: d._id.toString(), username: d.username, profile_pic_url: d.profile_pic_url, accountTier: d.accountTier },
    followerCount: d.followerCount,
  }));
  const mostWatched = watchedRaw.map((d) => ({
    user: { id: d._id.toString(), username: d.username, profile_pic_url: d.profile_pic_url, accountTier: d.accountTier },
    watchedCount: d.watchedCount,
  }));

  // Most Badges — no $sort-able field to aggregate on (a badge count is
  // computed, never stored), so this ranks the already-fetched
  // `badgeUsersRaw` set in memory instead of a 6th Mongo aggregate.
  const badgeCounts = await computeAllUsersBadgeCounts(badgeUsersRaw);
  const badgeCountById = new Map(badgeCounts.map((b) => [b._id.toString(), b.badgeCount]));
  const mostBadges = badgeUsersRaw
    .map((d) => ({
      user: { id: d._id.toString(), username: d.username, profile_pic_url: d.profile_pic_url, accountTier: d.accountTier },
      badgeCount: badgeCountById.get(d._id.toString()) || 0,
    }))
    .filter((e) => e.badgeCount >= 1)
    .sort((a, b) => b.badgeCount - a.badgeCount)
    .slice(0, LEADERBOARD_SIZE);

  return { mostFollowed, mostWatched, mostReviewed, mostLiked, topRecommenders, mostBadges };
}

export const getPeopleLeaderboard = asyncHandler(async (req, res) => {
  const type = ["movie", "series"].includes(req.query.type) ? req.query.type : null;
  const result = await getPeopleThreePodiums(type);
  sendSuccess(res, result, "People leaderboard fetched");
});

// Canonical category order for getMyPodiumPlacements below — also the
// order PeoplePodium.tsx's own CATEGORY_KEYS array uses, so a returned
// `category` string maps 1:1 onto that file's own CategoryKey type
// (mostFollowed→"followed", mostWatched→"watched", etc.) without the
// client needing its own separate mapping table.
const PODIUM_CATEGORY_KEYS = ["mostFollowed", "mostWatched", "mostReviewed", "mostLiked", "topRecommenders", "mostBadges"];

// @route GET /api/feed/my-podium-placements
// Powers the "you made the podium!" popup shown once per app open (see
// app/(app)/_layout.tsx) — checks the *current* user's own rank across all
// 5 of the people podium's categories (movie/series `?type=` doesn't apply
// here; Most Watched's own type-scoped ranking isn't what this checks,
// deliberately the untyped, combined one, matching what a Free/Plus viewer
// would actually land on after tapping through). Reuses
// `getPeopleThreePodiums` — the *exact* same ranking this podium itself
// shows, not a second, potentially-drifting copy (same reasoning
// activityController.js's own getFollowedPodiumEvents already documents
// for why it does the same). A user can rank on more than one podium at
// once — every placement is returned, not just the first found, so the
// client can pick which one to feature (currently: the single best rank).
export const getMyPodiumPlacements = asyncHandler(async (req, res) => {
  const result = await getPeopleThreePodiums(null);
  const userId = req.user.id;

  const placements = [];
  for (const key of PODIUM_CATEGORY_KEYS) {
    const list = result[key] || [];
    const rankIndex = list.findIndex((entry) => entry.user.id === userId);
    if (rankIndex !== -1) placements.push({ category: key, rank: rankIndex + 1 });
  }

  sendSuccess(res, { placements }, "Podium placements fetched");
});

// "Podium" badge — how many of the people-podium's own 6 categories
// (PODIUM_CATEGORY_KEYS, `mostBadges` included) this user CURRENTLY ranks
// top-3 in. Lives here rather than badgeController.js because it's built
// entirely out of this file's own getPeopleThreePodiums — reusing it (the
// exact same ranking the podium itself shows, same reasoning
// getMyPodiumPlacements above and activityController.js's own
// getFollowedPodiumEvents already document) from badgeController.js would
// mean badgeController.js importing feedController.js while
// feedController.js already imports badgeController.js's own
// computeAllUsersBadgeCounts — a real circular import, not just an
// awkward one. Keeping this one function on the side of the dependency
// that actually needs the ranking avoids that entirely.
//
// No persisted podium history exists anywhere in this app (confirmed
// directly — getFollowedPodiumEvents's own doc comment already says as
// much: "a live status check, not a persisted event with its own real
// timestamp"), so this can only ever answer "how many podiums are you on
// RIGHT NOW," not "how many have you ever been on" — same live-computed-
// on-every-fetch model every other badge here already uses, just with no
// event to hook a live "you just earned it!" popup off of (rankings shift
// from everyone else's activity too, not just your own, so there's no
// single action that could ever trigger one). Deliberately excluded from
// badgeController.js's own "Most Badges" total — see totalBadgeCount's
// own doc comment for why counting it there would be self-referential.
export const PODIUM_TIERS = [
  { tier: "tier1", threshold: 1 },
  { tier: "tier2", threshold: 2 },
  { tier: "tier3", threshold: 3 },
];

export async function computePodiumBadge(userId) {
  const result = await getPeopleThreePodiums(null);
  const placementCount = PODIUM_CATEGORY_KEYS.filter((key) => (result[key] || []).some((entry) => entry.user.id === userId)).length;
  return [{ key: "podium", count: placementCount, tier: tierForCount(placementCount, PODIUM_TIERS) }];
}

export const getPodiumBadge = asyncHandler(async (req, res) => {
  const badges = await computePodiumBadge(req.user.id);
  sendSuccess(res, { badges, tiers: PODIUM_TIERS }, "Podium badge fetched", 200);
});

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

  // Real fix, not a pre-existing behavior kept as-is: CineGraph entries are
  // keyed by genre NAME (ratingController.js's updateCineGraph stores them
  // that way — see MOVIE_GENRE_NAME_TO_ID's own comment above), not the
  // numeric TMDB id Movie/Series documents actually store in their own
  // genre_ids array. The old version here used the raw CineGraph key
  // directly as if it already were that numeric id — `Number("Drama")` is
  // NaN, so `genre_ids: { $in: topGenreIds } }` could never match a single
  // real document, and this endpoint always silently returned an empty
  // recommendation list. Movie/series genre ids are also kept SEPARATE
  // now, not one shared list for both — the same genre name can map to a
  // different numeric id per type (movie "Action"=28 vs series "Action &
  // Adventure"=10759), so a single combined list would misfire against
  // whichever collection didn't originate a given id.
  function topGenreIdsFor(cineGraph, nameToId) {
    if (!cineGraph) return [];
    const entries = cineGraph instanceof Map ? cineGraph.entries() : Object.entries(cineGraph);
    const scored = [];
    for (const [name, stats] of entries) {
      const id = nameToId[name];
      if (id == null) continue;
      scored.push([id, (stats.count || 0) * (stats.avgRating || 5)]);
    }
    return scored
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);
  }

  const movieGenreIds = contentType !== "series" ? topGenreIdsFor(user.movieCineGraph, MOVIE_GENRE_NAME_TO_ID) : [];
  const seriesGenreIds = contentType !== "movie" ? topGenreIdsFor(user.seriesCineGraph, SERIES_GENRE_NAME_TO_ID) : [];
  const hasGenres = movieGenreIds.length > 0 || seriesGenreIds.length > 0;

  const baseQuery = {
    _id: { $nin: watchedIds },
    poster_path: { $exists: true, $ne: null, $ne: "" },
    vote_count: { $gte: 50 },
    vote_average: { $gte: 5.5 },
  };

  const fetchContent = async (model, genreIds) =>
    model
      .find(genreIds.length > 0 ? { ...baseQuery, genre_ids: { $in: genreIds } } : baseQuery)
      .select("_id title name poster_path genre_ids vote_average release_date first_air_date")
      .sort({ vote_average: -1, vote_count: -1 })
      .limit(limit)
      .lean();

  let movies = [];
  let series = [];

  if (contentType !== "series") {
    movies = await fetchContent(getMovie(), movieGenreIds);
  }
  if (contentType !== "movie") {
    series = await fetchContent(getSeries(), seriesGenreIds);
  }

  // Interleave movies and series
  const results = [];
  const maxLen = Math.max(movies.length, series.length);
  for (let i = 0; i < maxLen && results.length < limit; i++) {
    if (movies[i]) results.push({ ...movies[i], contentType: "movie" });
    if (series[i] && results.length < limit) results.push({ ...series[i], contentType: "series" });
  }

  sendSuccess(
    res,
    { recommendations: results, topGenreIds: [...movieGenreIds, ...seriesGenreIds], hasPersonalization: hasGenres },
    "Recommendations fetched"
  );
});
