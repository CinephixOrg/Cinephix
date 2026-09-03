import mongoose from "mongoose";
import express from "express";
import authMiddleware, { optionalAuth } from "../middleware/authMiddleware.js";
import CustomList from "../models/CustomList.js";

const router = express.Router();

const getMovie = () => mongoose.connection.model("Movie");
const getSeries = () => mongoose.connection.model("Series");

// User text going into a $regex must be escaped first — an unescaped
// string lets a caller inject regex metacharacters (at best a crash, at
// worst a ReDoS-shaped query).
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Attaches previewItems (title+poster for the first N items of each list,
// bulk-hydrated the same way feedController.js/reviewController.js resolve
// content) and likeCount — used by /discover, /popular, and /for-content,
// which return otherwise-differently-sourced list arrays in the same
// enriched shape. Exported for shareController.js's "list"-type
// createShare, which needs the exact same denormalized snapshot shape.
// `limit` defaults to 5, but /discover, /popular, and /for-content all now
// pass 20 explicitly — DiscoverListCard.tsx's own poster preview switched
// from a small fixed-count cascade to a scrollable "film strip" (same
// technique as Medya's own list-post box, see shareController.js's
// createShare), so a fixed 5-item cap now silently truncated real content
// and made a strip with nothing to scroll past on lists that had more.
// /me stays at the bare default (5) — that route backs list *management*,
// not the film-strip card.
// Was two separate `.find()`s (movies, series) — folded into one aggregation
// seeded from the distinct item refs across every list's own preview slice
// via Mongo's `$documents` stage, joined against both `movies`/`series` by
// id (plain equality $lookup, not correlated — see activityController.js's
// getNetworkActivity for why that distinction matters at volume) and
// picking whichever matched. `$documents` needs a database-level
// {aggregate:1} command, which Model.aggregate() can't issue (always
// collection-scoped), hence the raw driver's db.aggregate() rather than a
// Model call. `CustomList.items[].itemId` is already schema-typed
// ObjectId (unlike Review/Rating's String `contentId`), so no $convert
// step is needed here — it matches `movies`/`series` `_id` directly.
export async function hydratePreviewItems(lists, limit = 5) {
  const previewSlices = lists.map((l) => l.items.slice(0, limit));
  const allItems = [];
  for (const slice of previewSlices) {
    for (const item of slice) allItems.push({ itemId: item.itemId, itemType: item.itemType });
  }
  const uniqueItems = [...new Map(allItems.map((it) => [`${it.itemType}:${it.itemId.toString()}`, it])).values()];

  const hydrated = uniqueItems.length
    ? await mongoose.connection.db
        .aggregate([
          { $documents: uniqueItems.map((it) => ({ itemId: it.itemId, itemType: it.itemType })) },
          {
            $lookup: {
              from: "movies",
              localField: "itemId",
              foreignField: "_id",
              pipeline: [{ $project: { title: 1, name: 1, poster_path: 1 } }],
              as: "_movieMatch",
            },
          },
          {
            $lookup: {
              from: "series",
              localField: "itemId",
              foreignField: "_id",
              pipeline: [{ $project: { title: 1, name: 1, poster_path: 1 } }],
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
        .toArray()
    : [];

  const itemMap = Object.fromEntries(hydrated.map((h) => [`${h.itemType}:${h.itemId.toString()}`, h.item]));

  return lists.map((l, i) => ({
    ...l,
    likeCount: (l.likes || []).length,
    previewItems: previewSlices[i]
      .map((item) => {
        const doc = itemMap[`${item.itemType}:${item.itemId.toString()}`];
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
    // authMiddleware already fetched the caller's full document (and
    // coalesces concurrent lookups for the same request burst) — reusing
    // `req.user.following` instead of re-fetching it here removes one more
    // redundant round trip.
    const followingIds = req.user.following || [];

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

    return res.json({ lists: await hydratePreviewItems(lists, 20) });
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
      {
        $addFields: {
          likeCount: { $size: { $ifNull: ["$likes", []] } },
          // Likes are a deliberate, stronger intent signal than a passive
          // view, so they're weighted 5:1 against raw view count.
          popularityScore: { $add: [{ $multiply: [{ $size: { $ifNull: ["$likes", []] } }, 5] }, { $ifNull: ["$views", 0] }] },
        },
      },
      { $sort: { popularityScore: -1, updatedAt: -1 } },
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

    return res.json({ lists: await hydratePreviewItems(lists, 20) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── GET /api/lists/for-content/:contentType/:contentId ── public lists
// that contain this specific movie/series — backs Content Detail's "Lists"
// stat button. Didn't exist before: contentStatsRoute.js's own listCount
// only ever needed a bare `countDocuments`, never the actual documents.
router.get("/for-content/:contentType/:contentId", authMiddleware, async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    if (!["movie", "series"].includes(contentType)) {
      return res.status(400).json({ message: "contentType must be movie or series" });
    }
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const query = { isPublic: true, items: { $elemMatch: { itemId: contentId, itemType: contentType } } };
    const [lists, total] = await Promise.all([
      CustomList.find(query)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("owner", "username profile_pic_url")
        .lean(),
      CustomList.countDocuments(query),
    ]);

    return res.json({ lists: await hydratePreviewItems(lists, 20), page, hasMore: page * limit < total });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Assigns a stable order to any of this owner's lists still at the schema
// default (i.e. created before the `order` field existed). The query below
// already sorts order desc/createdAt desc, so among the ones needing
// backfill the newest comes first — preserving each user's pre-existing
// "newest first" view with no visible jump the first time this runs.
async function backfillOrder(lists) {
  const needsBackfill = lists.filter((l) => !l.order);
  if (!needsBackfill.length) return lists;

  const ops = needsBackfill.map((l, i) => ({
    updateOne: { filter: { _id: l._id }, update: { $set: { order: needsBackfill.length - i } } },
  }));
  await CustomList.bulkWrite(ops);
  needsBackfill.forEach((l, i) => {
    l.order = needsBackfill.length - i;
  });
  return lists.sort((a, b) => b.order - a.order);
}

// ── GET /api/lists/me ── my lists
router.get("/me", authMiddleware, async (req, res) => {
  try {
    let lists = await CustomList.find({ owner: req.user._id }).sort({ order: -1, createdAt: -1 }).lean();
    lists = await backfillOrder(lists);
    return res.json({ lists: await hydratePreviewItems(lists) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── PATCH /api/lists/me/reorder ── persist a manual drag-reorder of the
// caller's own lists. Body: { orderedIds: string[] } — the full set of this
// user's list ids, front-to-back as the UI now shows them.
router.patch("/me/reorder", authMiddleware, async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || !orderedIds.length) {
      return res.status(400).json({ message: "orderedIds is required" });
    }

    const owned = await CustomList.find({ owner: req.user._id, _id: { $in: orderedIds } })
      .select("_id")
      .lean();
    const ownedIds = new Set(owned.map((l) => l._id.toString()));
    // Reject rather than partially reorder — a size/membership mismatch
    // means a stale client array or a list that isn't this user's own.
    if (ownedIds.size !== orderedIds.length || !orderedIds.every((id) => ownedIds.has(id))) {
      return res.status(400).json({ message: "Invalid list ids" });
    }

    const n = orderedIds.length;
    const ops = orderedIds.map((id, i) => ({
      updateOne: { filter: { _id: id }, update: { $set: { order: n - i } } },
    }));
    await CustomList.bulkWrite(ops);
    return res.json({ message: "Order updated" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/lists ── create a new list
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Name is required" });

    const maxOrderDoc = await CustomList.findOne({ owner: req.user._id })
      .sort({ order: -1 })
      .select("order")
      .lean();
    const order = (maxOrderDoc?.order || 0) + 1;

    const list = await CustomList.create({
      owner: req.user._id,
      name: name.trim(),
      description: description?.trim() || "",
      isPublic: !!isPublic,
      order,
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
