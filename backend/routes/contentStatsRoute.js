import express from "express";
import User from "../models/User.js";
import Review from "../models/Review.js";
import Rating from "../models/Rating.js";
import CustomList from "../models/CustomList.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

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

export default router;
