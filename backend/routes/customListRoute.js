import mongoose from "mongoose";
import { recordFootprint, clearFootprint } from "../models/FootprintEvent.js";
import express from "express";
import authMiddleware, { optionalAuth } from "../middleware/authMiddleware.js";
import CustomList from "../models/CustomList.js";
import User from "../models/User.js";
import Group from "../models/Group.js";
import { hydratePreviewItems } from "../utils/listPreview.js";
import { LIST_COUNT_TIERS, crossedActivityTier, bumpStreak } from "../controllers/badgeController.js";
import { normalizeListItems } from "../utils/listItems.js";
import { parseSuggestionRequest } from "../utils/listSuggestions.js";
import { suggestForList } from "../services/listSuggestions.js";

const router = express.Router();

const getMovie = () => mongoose.connection.model("Movie");
const getSeries = () => mongoose.connection.model("Series");

// User text going into a $regex must be escaped first — an unescaped
// string lets a caller inject regex metacharacters (at best a crash, at
// worst a ReDoS-shaped query).
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
          .populate("owner", "username profile_pic_url accountTier")
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
            .populate("owner", "username profile_pic_url accountTier")
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

// ── GET /api/lists/suggested ── Search's Lists tab empty state (no query,
// no filter) — direct ask: public lists that actually contain something
// the viewer has already watched ("lists içeren filmleri/dizileri userın
// watchedlistinde olan"), not a generic popular/discover set. A pool (not
// just the final handful shown) comes back so the client can pick a fresh
// few on every visit, same reasoning as feedController.js's
// getRecommendations feeding WhatToWatchRail/SuggestedForYouGrid.
router.get("/suggested", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("watchlist").lean();
    const watchedIds = (user?.watchlist || []).map((w) => w.itemId);
    if (watchedIds.length === 0) return res.json({ lists: [] });

    const lists = await CustomList.find({
      isPublic: true,
      owner: { $ne: req.user.id },
      "items.itemId": { $in: watchedIds },
    })
      .sort({ updatedAt: -1 })
      .limit(20)
      .populate("owner", "username profile_pic_url accountTier")
      .lean();

    return res.json({ lists: await hydratePreviewItems(lists.filter((l) => l.owner), 20) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Search's new Lists filter sheet — "Most Liked" is this route's own
// long-standing default (the popularityScore formula below), "Most Items"
// and "Newest" are new alternatives a viewer can switch to instead.
const LIST_SORTS = {
  liked: { popularityScore: -1, updatedAt: -1 },
  items: { itemCount: -1, updatedAt: -1 },
  newest: { createdAt: -1 },
};

// ── GET /api/lists/popular ── globally most-liked public lists
// `page` is optional and additive — omitting it keeps the original "top N,
// no more" behavior every existing caller (Home's Keşfet/Lists rails) relies
// on; Search's own paginated browse passes it explicitly. Was a fixed
// `$limit` with no total count at all — same class of gap as the
// movies/series list endpoints' own pagination bug fixed earlier, just here
// by omission (this route was never given real pagination) rather than a
// misplaced stage: anything past the first `limit` results was permanently
// unreachable no matter how a viewer scrolled.
router.get("/popular", authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;
    const q = req.query.q?.trim();
    const sortKey = LIST_SORTS[req.query.sort] ? req.query.sort : "liked";
    // Discover's Popular Lists own All/Friends/Liked filter — direct ask,
    // same 3-mode shape reviewController.js's getReviewsFeed now uses.
    // "all" (default) is this route's original unfiltered behavior.
    const mode = ["friends", "liked"].includes(req.query.mode) ? req.query.mode : "all";
    const modeMatch =
      mode === "friends"
        ? [{ $match: { owner: { $in: req.user.following || [] } } }]
        : mode === "liked"
        ? [{ $match: { likes: req.user._id } }]
        : [];

    const [result] = await CustomList.aggregate([
      { $match: { isPublic: true } },
      ...(q ? [{ $match: { name: { $regex: escapeRegex(q), $options: "i" } } }] : []),
      ...modeMatch,
      {
        $addFields: {
          likeCount: { $size: { $ifNull: ["$likes", []] } },
          itemCount: { $size: { $ifNull: ["$items", []] } },
          // Likes are a deliberate, stronger intent signal than a passive
          // view, so they're weighted 5:1 against raw view count.
          popularityScore: { $add: [{ $multiply: [{ $size: { $ifNull: ["$likes", []] } }, 5] }, { $ifNull: ["$views", 0] }] },
        },
      },
      { $sort: LIST_SORTS[sortKey] },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $skip: skip },
            { $limit: limit },
            // Owner hydration moved here (only ran on the already-limited set
            // before too, just via a plain top-level $limit) — now scoped to
            // just this page's rows instead of the pre-$facet full match set.
            {
              $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [{ $project: { username: 1, profile_pic_url: 1, accountTier: 1 } }],
              },
            },
            { $unwind: "$owner" },
          ],
        },
      },
    ]);

    const total = result?.metadata[0]?.total || 0;
    const lists = result?.data || [];

    // hydratePreviewItems is shared with createShare's own viewer-agnostic
    // snapshot use — hasLiked is computed here instead, per-viewer, right
    // after (each list doc's own `likes` array survives the aggregation
    // above untouched, no $project ever strips it).
    const hydrated = await hydratePreviewItems(lists, 20);
    const myId = req.user._id.toString();
    const withHasLiked = hydrated.map((l) => ({ ...l, hasLiked: (l.likes || []).some((id) => id.toString() === myId) }));

    return res.json({ lists: withHasLiked, page, hasMore: page * limit < total });
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
// groupId: null excludes a community list created via "Pin a List"
// (groupController.js's createGroupList) — that list is the community's,
// not this admin's personal one, even though they're the one who made it.
router.get("/me", authMiddleware, async (req, res) => {
  try {
    let lists = await CustomList.find({ owner: req.user._id, groupId: null }).sort({ order: -1, createdAt: -1 }).lean();
    lists = await backfillOrder(lists);
    // 20 preview posters, like /popular and /discover: the My Lists page shows
    // the same card, whose film strip swipes through them.
    return res.json({ lists: await hydratePreviewItems(lists, 20) });
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

// ── POST /api/lists/suggestions ── titles to suggest for a list being built
// Body: { seeds: [{ itemId, itemType }], exclude?: [{ itemId, itemType }], limit? }
// — seeds are the list's most recently added titles, exclude everything
// already on it. See services/listSuggestions.js.
router.post("/suggestions", authMiddleware, async (req, res) => {
  const request = parseSuggestionRequest(req.body);
  if (request.error) return res.status(400).json({ message: request.error });
  try {
    return res.json(await suggestForList(request));
  } catch (err) {
    console.error("List suggestions failed:", err?.message || err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/lists ── create a new list, optionally with its titles
// Body: { name, description?, isPublic?, items?: [{ itemId, itemType }] }
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, description, isPublic, items } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Name is required" });

    let listItems = [];
    if (items !== undefined) {
      const normalized = normalizeListItems(items, [], new Date(), req.user._id);
      if (normalized.error) return res.status(400).json({ message: normalized.error });
      listItems = normalized.items;
    }

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
      items: listItems,
      order,
    });

    // List-count badge crossing — every call here creates a genuinely new
    // list (no upsert on this endpoint), so no "was this an edit" guard is
    // needed the way rating/review counts need one.
    const newlyEarnedBadges = [];
    // bumpStreak (a write) and listCount (a read) are independent —
    // parallelized instead of 2 sequential round trips.
    const [streakBadge, listCount] = await Promise.all([
      bumpStreak(req.user._id),
      CustomList.countDocuments({ owner: req.user._id }),
    ]);
    if (streakBadge) newlyEarnedBadges.push(streakBadge);
    const crossedTier = crossedActivityTier(listCount, LIST_COUNT_TIERS);
    if (crossedTier) {
      const threshold = LIST_COUNT_TIERS.find((t) => t.tier === crossedTier).threshold;
      newlyEarnedBadges.push({ family: "listCount", key: "lists", count: listCount, tier: crossedTier, threshold });
    }

    return res.status(201).json({ list, newlyEarnedBadges });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
});

// ── GET /api/lists/:id ── view a list (public or owned)
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const list = await CustomList.findById(req.params.id)
      .populate("owner", "username profile_pic_url")
      .populate("groupId", "name slug coverImage accentColor")
      .lean();
    if (!list) return res.status(404).json({ message: "List not found" });
    // A list by someone hidden by a block reads as not found, even by link.
    if (req.hiddenUsers?.has(String(list.owner?._id))) return res.status(404).json({ message: "List not found" });

    const isOwner = req.user && list.owner._id.toString() === req.user._id.toString();
    // A community list's own members can always see it — same as any
    // member already seeing it pinned on the community page itself — even
    // if the admin left it marked private (private there only means "not
    // in /discover," never "hidden from the community it belongs to").
    const isGroupMember =
      req.user && list.groupId
        ? await Group.exists({ _id: list.groupId._id ?? list.groupId, "members.user": req.user._id }).then(Boolean)
        : false;
    if (!list.isPublic && !isOwner && !isGroupMember) {
      return res.status(403).json({ message: "This list is private" });
    }

    // Views exclude the owner browsing their own list.
    if (!isOwner) {
      await CustomList.updateOne({ _id: list._id }, { $inc: { views: 1 } });
      list.views = (list.views || 0) + 1;
    }

    const likes = list.likes || [];
    const hasLiked = req.user ? likes.some((id) => id.toString() === req.user._id.toString()) : false;
    // Who's allowed to add titles here (never remove — that stays
    // owner-only everywhere, see DELETE /:id/items below): the admin
    // always, or any member of the list's own community when they've
    // turned allowMemberAdd on.
    const canAddItems = isOwner || (!!list.groupId && !!list.allowMemberAdd && isGroupMember);

    // Hydrate every item's title/poster server-side in one aggregation
    // (hydratePreviewItems, shared with /discover etc. above — just given a
    // limit covering the whole list instead of a preview slice) instead of
    // returning bare {itemId, itemType} refs. Mobile used to hydrate this
    // itself with one getMovieById/getSeriesById call PER item — this
    // page's own real slowness, not a rendering problem: a 30-item list
    // meant 30 extra round trips just to get posters on screen.
    const [hydratedList] = list.items.length > 0 ? await hydratePreviewItems([list], list.items.length) : [{ ...list, previewItems: [] }];

    return res.json({ list: { ...hydratedList, likeCount: likes.length }, isOwner: !!isOwner, hasLiked, canAddItems });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
});

// ── PATCH /api/lists/:id ── update name / description / visibility, and
// optionally replace the titles (the list editor saves them all at once)
router.patch("/:id", authMiddleware, async (req, res) => {
  try {
    const list = await CustomList.findById(req.params.id);
    if (!list) return res.status(404).json({ message: "List not found" });
    if (list.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { name, description, isPublic, items, allowMemberAdd } = req.body;
    if (name !== undefined && !String(name).trim()) return res.status(400).json({ message: "Name is required" });
    if (items !== undefined) {
      const normalized = normalizeListItems(items, list.items, new Date(), req.user._id);
      if (normalized.error) return res.status(400).json({ message: normalized.error });
      list.items = normalized.items;
    }
    if (name !== undefined) list.name = name.trim();
    if (description !== undefined) list.description = description.trim();
    if (isPublic !== undefined) list.isPublic = !!isPublic;
    // Only meaningful on a community list (groupId set) — harmless no-op
    // otherwise, same as every other field here already tolerates being
    // sent even when unchanged. Lets the admin revisit a choice that used
    // to be creation-only (GroupListEditorScreen), direct ask.
    if (allowMemberAdd !== undefined && list.groupId) list.allowMemberAdd = !!allowMemberAdd;

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
    // For the liker's own Activity page — best effort, the like stands either way.
    await (alreadyLiked ? clearFootprint(userId, "list_liked", list._id) : recordFootprint(userId, "list_liked", list._id)).catch(
      () => {}
    );

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
    const isOwner = list.owner.toString() === req.user._id.toString();
    // A community list's own members get the same "add" right the admin
    // has — opt-in per list (allowMemberAdd) and add-only, never a path to
    // remove or edit anything else about it.
    const canAdd =
      isOwner ||
      (!!list.groupId && list.allowMemberAdd && (await Group.exists({ _id: list.groupId, "members.user": req.user._id })));
    if (!canAdd) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { itemId, itemType } = req.body;
    if (!itemId || !itemType) return res.status(400).json({ message: "Missing data" });

    const exists = list.items.some(
      (i) => i.itemId.toString() === itemId && i.itemType === itemType
    );
    if (exists) return res.status(409).json({ message: "Already in list" });

    list.items.push({ itemId, itemType, addedBy: req.user._id });
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
