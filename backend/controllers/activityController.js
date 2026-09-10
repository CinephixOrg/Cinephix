import mongoose from "mongoose";
import User from "../models/User.js";
import Rating from "../models/Rating.js";
import Review from "../models/Review.js";
import CustomList from "../models/CustomList.js";
import Group from "../models/Group.js";
import FavoriteEvent from "../models/FavoriteEvent.js";
import Notification from "../models/Notification.js";
import Share from "../models/Share.js";
import { getPeopleThreePodiums } from "./feedController.js";
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

// ── GET /api/feed/activity?page=&limit= ── Discover's own "Friends'
// Activity" section: a chronological feed of the people you follow's real
// activity (who rated/reviewed/favorited/added-to-an-existing-list what),
// not your own.
// `favorited` is powered by FavoriteEvent, a separate append-only log
// (models/FavoriteEvent.js) — `favoriteMovies`/`favoriteSeries` themselves
// are still plain, untimestamped ObjectId arrays read directly by match-
// making/leaderboard/content-stats code in several other controllers, and
// migrating THAT shape would mean touching all of it; the event log is
// additive only, written once per genuinely-new favorite-add
// (userController.js's updateFavorites), and never touches those fields.
// `list_item_added` (an item added to an *existing* list) reuses
// `CustomList.items[].addedAt`, which already existed — distinct from
// `list_created` (a brand-new list), no schema change needed for this one.
// Plain equality $lookups (real hash-joinable joins Mongo executes in one
// pass) — an earlier version of this used correlated let/pipeline $lookups
// to pick movies vs. series by contentType as part of the join condition
// itself, which forces a per-document nested-loop-style join; verified
// against real data (373/360 real events across 2 real accounts) that this
// timed out server-side (`MaxTimeMSExpired`) at the volumes this endpoint
// handles. Doing both joins unconditionally (by id only) then picking the
// right one afterward via a cheap in-memory $cond is the standard fix for
// this "join then branch on a sibling field" shape.
// Rating/Review.contentId is stored as a plain String (per their schemas),
// but movies/series `_id` is a real BSON ObjectId (Mongoose defaults `_id`
// to ObjectId even under `strict:false`) — the old JS-loop version only
// worked because Mongoose's query-casting silently converted its
// `.toString()`'d values back to ObjectId before hitting the wire; a raw
// $lookup does no such casting, so a String will never equal an ObjectId.
// `User.watchlist.itemId` is already schema-typed ObjectId, so it doesn't
// need this — `needsObjectIdCast` distinguishes the two call sites. $convert
// (not bare $toObjectId) so a malformed id yields null and simply finds no
// content, matching the old code's silent-skip behavior instead of
// throwing and failing the whole pipeline.
function contentLookupStages(idField, typeField, needsObjectIdCast) {
  const bareIdField = idField.replace(/^\$/, "");
  const stages = [];
  let joinField = bareIdField;
  if (needsObjectIdCast) {
    stages.push({ $addFields: { _contentIdOid: { $convert: { input: idField, to: "objectId", onError: null, onNull: null } } } });
    joinField = "_contentIdOid";
  }
  stages.push(
    { $lookup: { from: "movies", localField: joinField, foreignField: "_id", as: "_movieMatch" } },
    { $lookup: { from: "series", localField: joinField, foreignField: "_id", as: "_seriesMatch" } },
    {
      $addFields: {
        _content: {
          $cond: [{ $eq: [typeField, "movie"] }, { $arrayElemAt: ["$_movieMatch", 0] }, { $arrayElemAt: ["$_seriesMatch", 0] }],
        },
      },
    }
  );
  return stages;
}

function actorLookupStages(userIdField) {
  const bareIdField = userIdField.replace(/^\$/, "");
  return [
    { $lookup: { from: "users", localField: bareIdField, foreignField: "_id", as: "_actorMatch" } },
    { $addFields: { _actor: { $arrayElemAt: ["$_actorMatch", 0] } } },
  ];
}

const contentProjection = {
  id: "$contentId",
  title: { $ifNull: ["$_content.title", "$_content.name"] },
  poster_path: "$_content.poster_path",
  type: "$contentType",
};
const actorProjection = {
  _id: "$_actor._id",
  username: "$_actor.username",
  profile_pic_url: "$_actor.profile_pic_url",
  // actorLookupStages' own $lookup has no field-restricting pipeline, so
  // the full user doc (accountTier included) was already sitting in $_actor
  // — this was the only thing missing to drive Discover's Activity rows'
  // own tier ring/diamond, same as ShareCard.tsx already does for posts.
  accountTier: "$_actor.accountTier",
};

// Tier-gated per direct request: only a Plus/Premium *viewer* sees "so-and-
// so made the podium" news — this checks the requesting user's own tier,
// unrelated to the podium person's own tier (a Free-following-a-Premium
// case still shouldn't surface it to that Free viewer). Genuinely a live
// status check, not a persisted event with its own real timestamp — a
// podium spot is a ranking that can change on the next request, not a
// one-time achievement with a natural "moment it happened" the way a
// rating/review/follow has. Reusing getPeopleThreePodiums (the exact same
// query PeoplePodium.tsx's own Most Followed/Watched/Reviewed pages show)
// rather than a second, potentially-drifting copy of that ranking logic —
// "on the podium" here means literally currently in one of those same top
// 3s, nothing looser. `createdAt` is stamped "now" each time this runs, so
// it always surfaces near the top of the feed while genuinely true, and
// simply stops appearing the moment that person drops out of the top 3 —
// no stale "so-and-so made the podium" leftover from days ago.
async function getFollowedPodiumEvents(followingIds) {
  const followingSet = new Set(followingIds.map((id) => id.toString()));
  const { mostFollowed, mostWatched, mostReviewed } = await getPeopleThreePodiums(null);
  const now = new Date();
  const events = [];
  const collect = (list, category) => {
    list.forEach((entry, i) => {
      if (!followingSet.has(entry.user.id)) return;
      events.push({
        type: "podium",
        actor: { _id: entry.user.id, username: entry.user.username, profile_pic_url: entry.user.profile_pic_url, accountTier: entry.user.accountTier },
        category,
        rank: i + 1,
        createdAt: now,
      });
    });
  };
  collect(mostFollowed, "followed");
  collect(mostWatched, "watched");
  collect(mostReviewed, "reviewed");
  return events;
}

export const getNetworkActivity = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(parseInt(req.query.limit) || 10, MAX_LIMIT);

  // authMiddleware already fetched the caller's full document (and
  // coalesces concurrent lookups for the same request burst) — reusing
  // `req.user.following` instead of re-fetching it here removes one more
  // redundant round trip from an endpoint that used to need several.
  const followingIds = req.user.following || [];
  if (!followingIds.length) {
    return sendSuccess(res, { items: [], page, hasMore: false }, "Activity fetched");
  }

  const viewerTier = req.user.accountTier ?? "free";
  const canSeePodiumNews = viewerTier === "plus" || viewerTier === "premium" || viewerTier === "dev";

  // A 30-day window keeps the per-type queries bounded regardless of how
  // many people the caller follows — same cutoff convention getMyActivity
  // already uses, just always "month" here since this is a from-scratch
  // network feed, not a self-view with its own explicit range toggle.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  // Independent, self-contained aggregations (each resolves its own
  // actor/content via $lookup) instead of a two-phase shape (fetch events →
  // fetch the content those events reference): that would force a second
  // sequential round trip once content ids were known. Resolving inline
  // keeps it to one round trip per event type, all of them still running in
  // parallel via Promise.all.
  // `list_created` was dropped from this network feed entirely (per an
  // earlier direct request) — NOT deleted as a concept: a created-list
  // event was judged not worth a card of its own; it still backs
  // getMyActivity's own self-activity feed (untouched, separate function).
  // `watchlist_added` (the *Watched* List, `User.watchlist` — this app's
  // own inverted naming, see mobile README) was ALSO dropped earlier since
  // `rated` already covers the same "I've watched this" signal — that
  // reasoning doesn't apply to `towatch_added` below (the real Watchlist
  // queue, `User.toWatchList`), which is a genuinely distinct action with
  // no other event standing in for it, so it's added here fresh rather
  // than un-dropping the wrong one.
  const [ratings, reviews, favoriteEvents, listItemEvents, toWatchEvents, followNotifs, shares, podiumEvents] = await Promise.all([
    Rating.aggregate([
      { $match: { user: { $in: followingIds }, createdAt: { $gte: cutoff } } },
      { $sort: { createdAt: -1 } },
      { $limit: 200 },
      ...actorLookupStages("$user"),
      ...contentLookupStages("$contentId", "$contentType", true),
      { $match: { _actor: { $ne: null }, _content: { $ne: null } } },
      { $project: { _id: 0, type: { $literal: "rated" }, actor: actorProjection, content: contentProjection, value: 1, createdAt: 1 } },
    ]),
    Review.aggregate([
      { $match: { user: { $in: followingIds }, createdAt: { $gte: cutoff } } },
      { $sort: { createdAt: -1 } },
      { $limit: 200 },
      ...actorLookupStages("$user"),
      ...contentLookupStages("$contentId", "$contentType", true),
      { $match: { _actor: { $ne: null }, _content: { $ne: null } } },
      {
        $project: {
          _id: 0,
          type: { $literal: "reviewed" },
          actor: actorProjection,
          content: contentProjection,
          excerpt: { $substrCP: [{ $ifNull: ["$text", ""] }, 0, { $min: [150, { $strLenCP: { $ifNull: ["$text", ""] } }] }] },
          createdAt: 1,
        },
      },
    ]),
    FavoriteEvent.aggregate([
      { $match: { user: { $in: followingIds }, createdAt: { $gte: cutoff } } },
      { $sort: { createdAt: -1 } },
      { $limit: 200 },
      ...actorLookupStages("$user"),
      ...contentLookupStages("$contentId", "$contentType", false),
      { $match: { _actor: { $ne: null }, _content: { $ne: null } } },
      { $project: { _id: 0, type: { $literal: "favorited" }, actor: actorProjection, content: contentProjection, createdAt: 1 } },
    ]),
    CustomList.aggregate([
      { $match: { owner: { $in: followingIds } } },
      { $project: { owner: 1, name: 1, items: 1 } },
      { $unwind: "$items" },
      { $match: { "items.addedAt": { $gte: cutoff } } },
      ...actorLookupStages("$owner"),
      ...contentLookupStages("$items.itemId", "$items.itemType", false),
      { $match: { _actor: { $ne: null }, _content: { $ne: null } } },
      {
        $project: {
          _id: 0,
          type: { $literal: "list_item_added" },
          actor: actorProjection,
          content: {
            id: "$items.itemId",
            title: { $ifNull: ["$_content.title", "$_content.name"] },
            poster_path: "$_content.poster_path",
            type: "$items.itemType",
          },
          listId: "$_id",
          listName: "$name",
          createdAt: "$items.addedAt",
        },
      },
    ]),
    // Real Watchlist (to-watch queue) additions — same unwind-then-lookup
    // shape as list_item_added just above, on `User.toWatchList` instead of
    // `CustomList.items`. The actor here *is* the User document itself
    // (whoever added the item), so no separate actorLookupStages $lookup is
    // needed — its own username/profile_pic_url/accountTier are already on
    // the same document being unwound.
    User.aggregate([
      { $match: { _id: { $in: followingIds } } },
      { $project: { username: 1, profile_pic_url: 1, accountTier: 1, toWatchList: 1 } },
      { $unwind: "$toWatchList" },
      { $match: { "toWatchList.addedAt": { $gte: cutoff } } },
      ...contentLookupStages("$toWatchList.itemId", "$toWatchList.itemType", false),
      { $match: { _content: { $ne: null } } },
      {
        $project: {
          _id: 0,
          type: { $literal: "towatch_added" },
          actor: { _id: "$_id", username: "$username", profile_pic_url: "$profile_pic_url", accountTier: "$accountTier" },
          content: {
            id: "$toWatchList.itemId",
            title: { $ifNull: ["$_content.title", "$_content.name"] },
            poster_path: "$_content.poster_path",
            type: "$toWatchList.itemType",
          },
          createdAt: "$toWatchList.addedAt",
        },
      },
    ]),
    // Follows — not an aggregation like the others (no per-document content
    // to $lookup), a plain query against the same Notification record
    // every follow already creates. Same source feedController.js's own
    // (dead-from-mobile, kept for reference) getFeed used for its own
    // "followed" events — the one already-proven way to get a real
    // timestamp for "when did X follow Y" without adding a new field.
    Notification.find({ sender: { $in: followingIds }, type: "follow", createdAt: { $gte: cutoff } })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("sender", "username profile_pic_url accountTier")
      .populate("user", "username profile_pic_url accountTier")
      .lean(),
    // Medya shares — no per-share-type content preview here (a share's own
    // real content shape varies a lot by type — recommendation/review carry
    // contentData, list carries listData, analysis carries neither); this
    // just announces "X shared a Y", the actual post is one tap away in
    // Medya's own feed. Same actorLookupStages $lookup as every aggregation
    // above.
    Share.aggregate([
      { $match: { user: { $in: followingIds }, createdAt: { $gte: cutoff } } },
      { $sort: { createdAt: -1 } },
      { $limit: 200 },
      ...actorLookupStages("$user"),
      { $match: { _actor: { $ne: null } } },
      { $project: { _id: 0, type: { $literal: "shared" }, actor: actorProjection, shareType: "$type", createdAt: 1 } },
    ]),
    // Tier-gated — see getFollowedPodiumEvents' own doc comment above for
    // why this is a live status check rather than a real persisted event.
    canSeePodiumNews ? getFollowedPodiumEvents(followingIds) : Promise.resolve([]),
  ]);

  // toString() every id-ish field — aggregation returns real ObjectId/Date
  // instances, not the strings the old lean()+JS-loop version produced;
  // downstream (mobile) code expects strings. followNotifs (a plain
  // populate(), not an aggregation) needs its own mapping into the same
  // shape the rest of `events` already uses, plus dropping any record whose
  // sender/target account was since deleted.
  const followedEvents = followNotifs
    .filter((n) => n.sender && n.user)
    .map((n) => ({
      type: "followed",
      actor: { _id: n.sender._id.toString(), username: n.sender.username, profile_pic_url: n.sender.profile_pic_url, accountTier: n.sender.accountTier },
      targetUser: { _id: n.user._id.toString(), username: n.user.username, profile_pic_url: n.user.profile_pic_url, accountTier: n.user.accountTier },
      createdAt: n.createdAt,
    }));

  let events = [...ratings, ...reviews, ...favoriteEvents, ...listItemEvents, ...toWatchEvents, ...followedEvents, ...shares, ...podiumEvents];
  for (const e of events) {
    if (e.actor?._id) e.actor._id = e.actor._id.toString();
    if (e.content?.id) e.content.id = e.content.id.toString();
    if (e.listId) e.listId = e.listId.toString();
  }
  events.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Discover's Friends' Activity "See all" page's own category filter
  // (direct ask) — every type-array above is already merged from separate
  // per-type queries, so filtering down to just one is a plain post-merge
  // filter rather than re-querying; pagination below naturally recalculates
  // correctly off the already-filtered array.
  const category = req.query.category;
  if (category && category !== "all") {
    events = events.filter((e) => e.type === category);
  }

  const start = (page - 1) * limit;
  const items = events.slice(start, start + limit);

  sendSuccess(res, { items, page, hasMore: start + limit < events.length }, "Activity fetched");
});
