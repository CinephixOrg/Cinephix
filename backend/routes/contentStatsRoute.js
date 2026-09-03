import mongoose from "mongoose";
import express from "express";
import User from "../models/User.js";
import Review from "../models/Review.js";
import Rating from "../models/Rating.js";
import CustomList from "../models/CustomList.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

const getMovie = () => mongoose.connection.model("Movie");
const getSeries = () => mongoose.connection.model("Series");

async function resolveContent(type, id) {
  const model = type === "movie" ? getMovie() : getSeries();
  const doc = await model.findById(id).select("title name poster_path").lean();
  if (!doc) return null;
  return { id, title: doc.title || doc.name, poster_path: doc.poster_path, type };
}

// GET /api/content/:type/:id/stats — public aggregate counts
router.get("/:type/:id/stats", async (req, res) => {
  try {
    const { type, id } = req.params;
    if (!["movie", "series"].includes(type)) return res.status(400).json({ message: "Invalid type" });
    const favoriteField = type === "movie" ? "favoriteMovies" : "favoriteSeries";

    const [reviewCount, watchedCount, favoriteCount, listCount] = await Promise.all([
      Review.countDocuments({ contentId: id }),
      User.countDocuments({ watchlist: { $elemMatch: { itemId: id, itemType: type } } }),
      User.countDocuments({ [favoriteField]: id }),
      CustomList.countDocuments({ items: { $elemMatch: { itemId: id, itemType: type } } }),
    ]);

    return res.json({ reviewCount, watchedCount, favoriteCount, listCount });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/content/:type/:id/watched-by-friends — profiles from the current
// user's network who have this content on their watched list, plus each
// user's own rating for it (if any), for a gray-star (not numeric) display.
router.get("/:type/:id/watched-by-friends", authMiddleware, async (req, res) => {
  try {
    const { type, id } = req.params;
    if (!["movie", "series"].includes(type)) return res.status(400).json({ message: "Invalid type" });

    const currentUser = await User.findById(req.user._id).select("following").lean();
    const followingIds = currentUser?.following || [];
    if (followingIds.length === 0) return res.json({ users: [] });

    const watchers = await User.find({
      _id: { $in: followingIds },
      watchlist: { $elemMatch: { itemId: id, itemType: type } },
    })
      .select("username profile_pic_url")
      .lean();
    if (watchers.length === 0) return res.json({ users: [] });

    const ratings = await Rating.find({ user: { $in: watchers.map((w) => w._id) }, contentId: id })
      .select("user value")
      .lean();
    const ratingMap = Object.fromEntries(ratings.map((r) => [r.user.toString(), r.value]));

    const users = watchers.map((w) => ({
      _id: w._id.toString(),
      username: w.username,
      profile_pic_url: w.profile_pic_url,
      rating: ratingMap[w._id.toString()] ?? null,
    }));

    return res.json({ users });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/content/:type/:id/watched-by — Content Detail's "Watched" stat
// button target: everyone (not just friends — that's watched-by-friends
// above) who has this on their watched list, newest add first. Shaped as
// `watchlist_added` ActivityEvent items (same as GET /feed/activity) minus
// the repeated `content` block — one item per user's own `watchlist`
// subdocument (which already has `addedAt`, unlike favorites — see
// favorited-by below) — so the mobile side can reuse ActivityRow.tsx
// as-is instead of a new card design, per direct ask ("aynı aktivite
// bölümündeki ... kart").
router.get("/:type/:id/watched-by", authMiddleware, async (req, res) => {
  try {
    const { type, id } = req.params;
    if (!["movie", "series"].includes(type)) return res.status(400).json({ message: "Invalid type" });
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const content = await resolveContent(type, id);
    if (!content) return res.status(404).json({ message: "Content not found" });

    // `addedAt` lives inside each user's own watchlist array, not a
    // top-level field Mongo can sort/paginate against directly — same
    // fetch-then-sort-then-slice-in-JS shape activityController.js's
    // getNetworkActivity already uses for the identical reason. Capped at
    // 500 matching users as a sane bound (this mirrors a "how many people
    // could realistically have watched one title" assumption, not a hard
    // product limit).
    const watchers = await User.find({ watchlist: { $elemMatch: { itemId: id, itemType: type } } })
      .select("username profile_pic_url watchlist")
      .limit(500)
      .lean();

    const items = [];
    for (const u of watchers) {
      const entry = (u.watchlist || []).find((w) => w.itemId?.toString() === id && w.itemType === type);
      if (!entry) continue;
      items.push({
        actor: { _id: u._id.toString(), username: u.username, profile_pic_url: u.profile_pic_url },
        createdAt: entry.addedAt,
      });
    }
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const start = (page - 1) * limit;
    const page_items = items.slice(start, start + limit);

    return res.json({ content, items: page_items, page, hasMore: start + limit < items.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/content/:type/:id/favorited-by — Content Detail's "Favorites"
// stat button target: everyone who has this in their favorites. No
// per-user timestamp available (favoriteMovies/favoriteSeries are still
// plain ObjectId arrays, unlike watchlist — see the earlier decision in
// activityController.js's getNetworkActivity for why that isn't changing
// as a side effect of this endpoint), so this paginates by a stable `_id`
// order directly at the DB level rather than the JS sort watched-by needs.
router.get("/:type/:id/favorited-by", authMiddleware, async (req, res) => {
  try {
    const { type, id } = req.params;
    if (!["movie", "series"].includes(type)) return res.status(400).json({ message: "Invalid type" });
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const favoriteField = type === "movie" ? "favoriteMovies" : "favoriteSeries";

    const query = { [favoriteField]: id };
    const [users, total] = await Promise.all([
      User.find(query)
        .select("username profile_pic_url")
        .sort({ _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    const items = users.map((u) => ({ _id: u._id.toString(), username: u.username, profile_pic_url: u.profile_pic_url }));
    return res.json({ items, page, hasMore: page * limit < total });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
