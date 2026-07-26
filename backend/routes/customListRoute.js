import express from "express";
import authMiddleware, { optionalAuth } from "../middleware/authMiddleware.js";
import CustomList from "../models/CustomList.js";
import User from "../models/User.js";

const router = express.Router();

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

    const lists = [...followedLists, ...communityLists].map((l) => ({
      ...l,
      fromFollowing: followingIds.some((id) => id.toString() === l.owner._id.toString()),
    }));

    return res.json({ lists });
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

    return res.json({ list, isOwner: !!isOwner });
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
