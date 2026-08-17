import mongoose from "mongoose";
import express from "express";
import authMiddleware, { optionalAuth } from "../middleware/authMiddleware.js";
import CustomList from "../models/CustomList.js";
import User from "../models/User.js";

const router = express.Router();

const getMovie = () => mongoose.connection.model("Movie");
const getSeries = () => mongoose.connection.model("Series");

// User text going into a $regex must be escaped first — an unescaped
// string lets a caller inject regex metacharacters (at best a crash, at
// worst a ReDoS-shaped query).
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Attaches previewItems (title+poster for the first 5 items of each list,
// bulk-hydrated the same way feedController.js/reviewController.js resolve
// content) and likeCount — used by both /discover and /popular, which return
// otherwise-differently-sourced list arrays in the same enriched shape.
async function hydratePreviewItems(lists) {
  const previewSlices = lists.map((l) => l.items.slice(0, 5));
  const movieIds = new Set();
  const seriesIds = new Set();
  for (const slice of previewSlices) {
    for (const item of slice) {
      if (item.itemType === "movie") movieIds.add(item.itemId.toString());
      else seriesIds.add(item.itemId.toString());
    }
  }

  const [movies, seriesList] = await Promise.all([
    movieIds.size ? getMovie().find({ _id: { $in: [...movieIds] } }).select("_id title name poster_path").lean() : [],
    seriesIds.size ? getSeries().find({ _id: { $in: [...seriesIds] } }).select("_id title name poster_path").lean() : [],
  ]);

  const movieMap = Object.fromEntries(movies.map((m) => [m._id.toString(), m]));
  const seriesMap = Object.fromEntries(seriesList.map((s) => [s._id.toString(), s]));

  return lists.map((l, i) => ({
    ...l,
    likeCount: (l.likes || []).length,
    previewItems: previewSlices[i]
      .map((item) => {
        const doc = item.itemType === "movie" ? movieMap[item.itemId.toString()] : seriesMap[item.itemId.toString()];
        if (!doc) return null;
        return {
          itemId: item.itemId.toString(),
          itemType: item.itemType,
          title: doc.title || doc.name,
          poster_path: doc.poster_path,
        };
      })
      .filter(Boolean),
  }));
}

// ── GET /api/lists/discover ── public list discovery (followed users first, then community)
router.get("/discover", authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const currentUser = await User.findById(req.user._id).select("following").lean();
    const followingIds = currentUser?.following || [];

    // Public lists from followed users
    const followedLists = followingIds.length
      ? await CustomList.find({ owner: { $in: followingIds }, isPublic: true })
          .sort({ updatedAt: -1 })
          .limit(limit)
          .populate("owner", "username profile_pic_url")
          .lean()
      : [];

    // Fill remaining slots with recent community lists (excluding own + already fetched)
    const excludeOwners = [req.user._id, ...followingIds];
    const alreadyIds = followedLists.map((l) => l._id);
    const remaining = limit - followedLists.length;

    const communityLists =
      remaining > 0
        ? await CustomList.find({
            isPublic: true,
            owner: { $nin: excludeOwners },
            _id: { $nin: alreadyIds },
          })
            .sort({ updatedAt: -1 })
            .limit(remaining)
            .populate("owner", "username profile_pic_url")
            .lean()
        : [];

    // owner can be null if the populated user was deleted but left a public
    // list behind — skip those rather than crashing or surfacing a ghost card.
    const lists = [...followedLists, ...communityLists]
      .filter((l) => l.owner)
      .map((l) => ({
        ...l,
        fromFollowing: followingIds.some((id) => id.toString() === l.owner._id.toString()),
      }));

    return res.json({ lists: await hydratePreviewItems(lists) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── GET /api/lists/popular ── globally most-liked public lists
router.get("/popular", authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const q = req.query.q?.trim();

    const lists = await CustomList.aggregate([
      { $match: { isPublic: true } },
      ...(q ? [{ $match: { name: { $regex: escapeRegex(q), $options: "i" } } }] : []),
      { $addFields: { likeCount: { $size: { $ifNull: ["$likes", []] } } } },
      { $sort: { likeCount: -1, updatedAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "owner",
          pipeline: [{ $project: { username: 1, profile_pic_url: 1 } }],
        },
      },
      { $unwind: "$owner" },
    ]);

    return res.json({ lists: await hydratePreviewItems(lists) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── GET /api/lists/me ── my lists
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const lists = await CustomList.find({ owner: req.user._id }).sort({ createdAt: -1 }).lean();
    return res.json({ lists });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/lists ── create a new list
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Name is required" });

    const list = await CustomList.create({
      owner: req.user._id,
      name: name.trim(),
      description: description?.trim() || "",
      isPublic: !!isPublic,
    });

    return res.status(201).json({ list });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
});

// ── GET /api/lists/:id ── view a list (public or owned)
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const list = await CustomList.findById(req.params.id).populate("owner", "username profile_pic_url").lean();
    if (!list) return res.status(404).json({ message: "List not found" });

    const isOwner = req.user && list.owner._id.toString() === req.user._id.toString();
    if (!list.isPublic && !isOwner) {
      return res.status(403).json({ message: "This list is private" });
    }

    // Views exclude the owner browsing their own list.
    if (!isOwner) {
      await CustomList.updateOne({ _id: list._id }, { $inc: { views: 1 } });
      list.views = (list.views || 0) + 1;
    }

    const likes = list.likes || [];
    const hasLiked = req.user ? likes.some((id) => id.toString() === req.user._id.toString()) : false;

    return res.json({ list: { ...list, likeCount: likes.length }, isOwner: !!isOwner, hasLiked });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
});

// ── PATCH /api/lists/:id ── update name / description / visibility
router.patch("/:id", authMiddleware, async (req, res) => {
  try {
    const list = await CustomList.findById(req.params.id);
    if (!list) return res.status(404).json({ message: "List not found" });
    if (list.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { name, description, isPublic } = req.body;
    if (name !== undefined) list.name = name.trim();
    if (description !== undefined) list.description = description.trim();
    if (isPublic !== undefined) list.isPublic = !!isPublic;

    await list.save();
    return res.json({ list });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
});

// ── DELETE /api/lists/:id ── delete a list
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const list = await CustomList.findById(req.params.id);
    if (!list) return res.status(404).json({ message: "List not found" });
    if (list.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await list.deleteOne();
    return res.json({ message: "List deleted" });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/lists/:id/like ── toggle like, mirrors reviewController.js's toggleReviewLike
router.post("/:id/like", authMiddleware, async (req, res) => {
  try {
    const list = await CustomList.findById(req.params.id);
    if (!list) return res.status(404).json({ message: "List not found" });

    const userId = req.user._id;
    const alreadyLiked = list.likes.some((id) => id.toString() === userId.toString());
    if (alreadyLiked) {
      list.likes.pull(userId);
    } else {
      list.likes.push(userId);
    }
    await list.save();

    return res.json({ likeCount: list.likes.length, hasLiked: !alreadyLiked });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/lists/:id/items ── add an item
router.post("/:id/items", authMiddleware, async (req, res) => {
  try {
    const list = await CustomList.findById(req.params.id);
    if (!list) return res.status(404).json({ message: "List not found" });
    if (list.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { itemId, itemType } = req.body;
    if (!itemId || !itemType) return res.status(400).json({ message: "Missing data" });

    const exists = list.items.some(
      (i) => i.itemId.toString() === itemId && i.itemType === itemType
    );
    if (exists) return res.status(409).json({ message: "Already in list" });

    list.items.push({ itemId, itemType });
    await list.save();
    return res.status(201).json({ list });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
});

// ── DELETE /api/lists/:id/items/:itemId?itemType=movie ── remove an item
router.delete("/:id/items/:itemId", authMiddleware, async (req, res) => {
  try {
    const list = await CustomList.findById(req.params.id);
    if (!list) return res.status(404).json({ message: "List not found" });
    if (list.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { itemId } = req.params;
    const { itemType } = req.query;
    if (!itemType) return res.status(400).json({ message: "Missing itemType" });

    const before = list.items.length;
    list.items = list.items.filter(
      (i) => !(i.itemId.toString() === itemId && i.itemType === itemType)
    );
    if (list.items.length === before) {
      return res.status(404).json({ message: "Item not found in list" });
    }

    await list.save();
    return res.json({ list });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
