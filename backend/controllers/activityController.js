import mongoose from "mongoose";
import User from "../models/User.js";
import Rating from "../models/Rating.js";
import Review from "../models/Review.js";
import CustomList from "../models/CustomList.js";
import Group from "../models/Group.js";
import FavoriteEvent from "../models/FavoriteEvent.js";
import Notification from "../models/Notification.js";
import Share from "../models/Share.js";
import FootprintEvent from "../models/FootprintEvent.js";
import MatchAnalysisLog from "../models/MatchAnalysisLog.js";
import ProfileAnalysis from "../models/ProfileAnalysis.js";
import { compareEvents, mergeActivityPage, mergeFollowEvents, parseActivityQuery } from "../utils/activityFeed.js";
import { getPeopleThreePodiums } from "./feedController.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess } from "../utils/response.js";

const getMovie = () => mongoose.connection.model("Movie");
const getSeries = () => mongoose.connection.model("Series");

const MAX_LIMIT = 50;

// ── GET /api/users/me/activity?range=week|month|all&categories=&page=&limit= ──
// The caller's own footprint in the app: ratings, reviews, likes (of
// reviews and lists), follows, lists, watched/watchlist adds, favorites,
// communities joined, Media shares and CineMatch/CineGraph analyses.
//
// Built for "All time" over big libraries (an import can add thousands of
// ratings): each requested source is asked only for its newest page×limit
// rows, the sources are merged in one stable order (utils/activityFeed.js),
// and titles and people are looked up afterwards for just the page being
// returned. Categories the caller filtered out aren't queried at all.
export const getMyActivity = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { cutoff, page, limit, types } = parseActivityQuery(req.query);
  const cap = page * limit;
  const since = (field) => (cutoff ? { [field]: { $gte: cutoff } } : {});
  const wants = (type) => types.has(type);

  const sources = await Promise.all([
    wants("rated") &&
      Rating.find({ user: userId, ...since("createdAt") })
        .sort({ createdAt: -1, _id: -1 })
        .limit(cap)
        .select("contentId contentType value createdAt")
        .lean()
        .then((rows) =>
          rows.map((r) => ({ key: `rated:${r._id}`, type: "rated", createdAt: r.createdAt, contentRef: [r.contentId, r.contentType], value: r.value }))
        ),
    wants("reviewed") &&
      Review.find({ user: userId, ...since("createdAt") })
        .sort({ createdAt: -1, _id: -1 })
        .limit(cap)
        .select("contentId contentType text createdAt")
        .lean()
        .then((rows) =>
          rows.map((r) => ({
            key: `reviewed:${r._id}`,
            type: "reviewed",
            createdAt: r.createdAt,
            contentRef: [r.contentId, r.contentType],
            excerpt: r.text?.slice(0, 160),
          }))
        ),
    wants("review_liked") &&
      Review.aggregate([
        { $match: { "likeEvents.user": userId } },
        { $unwind: "$likeEvents" },
        { $match: { "likeEvents.user": userId, ...(cutoff ? { "likeEvents.likedAt": { $gte: cutoff } } : {}) } },
        { $sort: { "likeEvents.likedAt": -1, _id: -1 } },
        { $limit: cap },
        { $project: { contentId: 1, contentType: 1, user: 1, likedAt: "$likeEvents.likedAt" } },
      ]).then((rows) =>
        rows.map((r) => ({
          key: `review_liked:${r._id}`,
          type: "review_liked",
          createdAt: r.likedAt,
          contentRef: [r.contentId, r.contentType],
          userRef: r.user,
        }))
      ),
    // The auth middleware has already loaded the caller's own document, so
    // their watched list and watchlist are read from it rather than fetched
    // again — for a big imported library that re-fetch was the slowest part.
    [
      ...(wants("watchlist_added") ? addedEvents(req.user.watchlist, "watchlist_added", cutoff, cap) : []),
      ...(wants("towatch_added") ? addedEvents(req.user.toWatchList, "towatch_added", cutoff, cap) : []),
    ],
    wants("favorited") &&
      FavoriteEvent.find({ user: userId, ...since("createdAt") })
        .sort({ createdAt: -1, _id: -1 })
        .limit(cap)
        .lean()
        .then((rows) =>
          rows.map((r) => ({ key: `favorited:${r._id}`, type: "favorited", createdAt: r.createdAt, contentRef: [r.contentId, r.contentType] }))
        ),
    wants("list_created") &&
      CustomList.find({ owner: userId, ...since("createdAt") })
        .sort({ createdAt: -1, _id: -1 })
        .limit(cap)
        .select("name createdAt")
        .lean()
        .then((rows) =>
          rows.map((l) => ({ key: `list_created:${l._id}`, type: "list_created", createdAt: l.createdAt, listId: l._id.toString(), listName: l.name }))
        ),
    wants("list_liked") &&
      FootprintEvent.find({ user: userId, type: "list_liked", ...since("createdAt") })
        .sort({ createdAt: -1, _id: -1 })
        .limit(cap)
        .populate({ path: "list", select: "name owner", populate: { path: "owner", select: "username profile_pic_url accountTier" } })
        .lean()
        .then((rows) =>
          rows
            .filter((r) => r.list)
            .map((r) => ({
              key: `list_liked:${r._id}`,
              type: "list_liked",
              createdAt: r.createdAt,
              listId: r.list._id.toString(),
              listName: r.list.name,
              targetUser: publicUser(r.list.owner),
            }))
        ),
    wants("followed") && followEvents(req.user, cutoff, cap),
    wants("group_joined") &&
      Group.find({ members: { $elemMatch: { user: userId, ...(cutoff ? { joinedAt: { $gte: cutoff } } : {}) } } })
        .select("name slug coverImage members.$")
        .lean()
        .then((rows) =>
          rows
            .map((g) => ({
              key: `group_joined:${g._id}`,
              type: "group_joined",
              createdAt: g.members?.[0]?.joinedAt || g.createdAt,
              groupSlug: g.slug,
              groupName: g.name,
              groupCoverImage: g.coverImage || undefined,
            }))
            .sort(compareEvents)
            .slice(0, cap)
        ),
    wants("shared") &&
      // groupId: null — see shareController.js's getUserShares comment: a
      // community poll a member/admin created for their community is that
      // community's own activity, not a personal "I shared this" event.
      Share.find({ user: userId, isOfficialPost: { $ne: true }, groupId: null, ...since("createdAt") })
        .sort({ createdAt: -1, _id: -1 })
        .limit(cap)
        .select("type contentData.title listData.name createdAt")
        .lean()
        .then((rows) =>
          rows.map((s) => ({
            key: `shared:${s._id}`,
            type: "shared",
            shareId: s._id.toString(),
            createdAt: s.createdAt,
            shareType: s.type,
            shareTitle: s.contentData?.title || s.listData?.name || undefined,
          }))
        ),
    wants("match_analyzed") &&
      MatchAnalysisLog.find({ user: userId, ...since("createdAt") })
        .sort({ createdAt: -1, _id: -1 })
        .limit(cap)
        .lean()
        .then((rows) =>
          rows.map((r) => ({
            key: `match_analyzed:${r._id}`,
            type: "match_analyzed",
            createdAt: r.createdAt,
            userRef: r.targetUser,
            score: typeof r.score === "number" ? Math.round(r.score) : undefined,
          }))
        ),
    wants("profile_analyzed") &&
      ProfileAnalysis.find({ user: userId, ...since("createdAt") })
        .sort({ createdAt: -1, _id: -1 })
        .limit(cap)
        .select("result.nickname createdAt")
        .lean()
        .then((rows) =>
          rows.map((r) => ({
            key: `profile_analyzed:${r._id}`,
            type: "profile_analyzed",
            createdAt: r.createdAt,
            nickname: r.result?.nickname || undefined,
          }))
        ),
  ]);

  const { items, hasMore } = mergeActivityPage(
    sources.filter(Array.isArray).map((events) => ({ events })),
    { page, limit, cap }
  );

  sendSuccess(res, { items: await hydrateActivity(items), page, hasMore }, "Activity fetched");
});

// Titles added to the watched list or watchlist, newest first, from the
// user document's own arrays.
function addedEvents(items, type, cutoff, cap) {
  return (items || [])
    .filter((item) => item.addedAt && (!cutoff || new Date(item.addedAt) >= cutoff))
    .map((item) => ({ key: `${type}:${item.itemType}:${item.itemId}`, type, createdAt: item.addedAt, contentRef: [item.itemId, item.itemType] }))
    .sort(compareEvents)
    .slice(0, cap);
}

const publicUser = (u) =>
  u ? { _id: u._id.toString(), username: u.username, profile_pic_url: u.profile_pic_url, accountTier: u.accountTier } : undefined;

const MAX_FOLLOW_EVENTS = 5000;

// Everyone the caller follows now, with when they followed them: the
// footprint log where it has the follow, otherwise the follow notification
// sent at the time (for follows from before the log existed).
async function followEvents(me, cutoff, cap) {
  const following = new Set((me.following || []).map((id) => id.toString()));
  if (following.size === 0) return [];
  const range = cutoff ? { createdAt: { $gte: cutoff } } : {};
  const [logged, notified] = await Promise.all([
    // Not capped per page like the rest: every page must see the same time
    // for the same follow, or a follow could jump between days as more pages
    // load. Bounded anyway — one row per person currently followed.
    FootprintEvent.find({ user: me._id, type: "followed", ...range }).sort({ createdAt: -1 }).limit(MAX_FOLLOW_EVENTS).lean(),
    Notification.find({ sender: me._id, type: "follow", ...range }).sort({ createdAt: -1 }).limit(cap).select("user createdAt").lean(),
  ]);
  return mergeFollowEvents(
    logged.map((r) => ({ key: `followed:${r.targetUser}`, type: "followed", createdAt: r.createdAt, targetId: r.targetUser, userRef: r.targetUser })),
    notified.map((n) => ({ key: `followed:${n.user}`, type: "followed", createdAt: n.createdAt, targetId: n.user, userRef: n.user })),
    following
  ).slice(0, cap);
}

// Titles and people for one page of events: one query per collection, for
// only what this page shows. An event whose title no longer exists is
// dropped rather than shown half-empty.
async function hydrateActivity(events) {
  const movieIds = new Set();
  const seriesIds = new Set();
  const userIds = new Set();
  for (const e of events) {
    if (e.contentRef) (e.contentRef[1] === "movie" ? movieIds : seriesIds).add(String(e.contentRef[0]));
    if (e.userRef) userIds.add(String(e.userRef));
  }
  const valid = (ids) => [...ids].filter((id) => mongoose.isValidObjectId(id));
  const [movies, series, users] = await Promise.all([
    movieIds.size ? getMovie().find({ _id: { $in: valid(movieIds) } }).select("title name poster_path").lean() : [],
    seriesIds.size ? getSeries().find({ _id: { $in: valid(seriesIds) } }).select("title name poster_path").lean() : [],
    userIds.size ? User.find({ _id: { $in: valid(userIds) } }).select("username profile_pic_url accountTier").lean() : [],
  ]);
  const byId = (rows) => new Map(rows.map((row) => [row._id.toString(), row]));
  const movieMap = byId(movies);
  const seriesMap = byId(series);
  const userMap = byId(users);

  const result = [];
  for (const { contentRef, userRef, targetId, ...event } of events) {
    if (contentRef) {
      const [id, type] = contentRef;
      const doc = (type === "movie" ? movieMap : seriesMap).get(String(id));
      if (!doc) continue;
      event.content = { id: String(id), title: doc.title || doc.name, poster_path: doc.poster_path, type };
    }
    if (userRef) {
      const user = userMap.get(String(userRef));
      if (!user && event.type !== "review_liked") continue;
      event.targetUser = publicUser(user);
    }
    result.push(event);
  }
  return result;
}

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
    // Media shares — no per-share-type content preview here (a share's own
    // real content shape varies a lot by type — recommendation/review carry
    // contentData, list carries listData, analysis carries neither); this
    // just announces "X shared a Y", the actual post is one tap away in
    // Media's own feed. Same actorLookupStages $lookup as every aggregation
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
