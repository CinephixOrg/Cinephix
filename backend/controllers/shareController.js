import mongoose from "mongoose";
import Share from "../models/Share.js";
import Review from "../models/Review.js";
import Rating from "../models/Rating.js";
import User from "../models/User.js";
import CustomList from "../models/CustomList.js";
import { hydratePreviewItems } from "../routes/customListRoute.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError, sendPaginated } from "../utils/response.js";

const getMovie = () => mongoose.connection.model("Movie");
const getSeries = () => mongoose.connection.model("Series");

const MAX_LIMIT = 50;

// Anti-spam cooldown for re-sharing a review of the SAME title — direct ask
// after a real concern was raised: nothing stopped someone from editing
// their review and hitting "Save and Share" over and over, flooding the
// feed with 5-10 near-duplicate posts about one title in a few minutes.
// Only gates *sharing* a review to Medya, never plain saving/editing one —
// editing your own review privately has no feed-spam angle at all. Editing
// the text of an *already-shared* review post is explicitly out of scope
// for this round (a future "edit post" feature, not built yet) — this is
// purely about how often a brand-new review Share can be created per title.
const REVIEW_SHARE_COOLDOWN_MS = 60 * 60 * 1000;

async function hydrateContentData(contentId, contentType) {
  const model = contentType === "movie" ? getMovie() : getSeries();
  const doc = await model.findById(contentId).select("title name poster_path release_date first_air_date").lean();
  if (!doc) return null;
  const date = contentType === "movie" ? doc.release_date : doc.first_air_date;
  return {
    title: doc.title || doc.name,
    posterUrl: doc.poster_path || null,
    releaseYear: date ? new Date(date).getFullYear() : undefined,
  };
}

// ── POST /api/shares ──
export const createShare = asyncHandler(async (req, res) => {
  const { type } = req.body;
  const userId = req.user.id;

  if (type === "analysis") {
    // Trusts client-supplied analysisData directly, same as the existing
    // DM analysis_share message flow already does (sendRichMessage's
    // analysisData is never server-verified either) — the mobile client's
    // ProfileAnalysis result has no persisted _id to look up (getProfileAnalysis
    // returns the raw generated content, not the created doc's id), so an
    // id-based lookup here isn't actually reachable from the real client.
    const { analysisData } = req.body;
    if (!analysisData || typeof analysisData !== "object") {
      return sendError(res, "analysisData is required", 400);
    }
    const share = await Share.create({ user: userId, type: "analysis", analysisData });
    return sendSuccess(res, share, "Shared to Medya", 201);
  }

  if (type === "review") {
    const { reviewId } = req.body;
    if (!reviewId) return sendError(res, "reviewId is required", 400);
    const review = await Review.findOne({ _id: reviewId, user: userId }).lean();
    if (!review) return sendError(res, "Review not found", 404);

    const recentShareOfSameTitle = await Share.findOne({
      user: userId,
      type: "review",
      contentId: review.contentId,
      contentType: review.contentType,
      createdAt: { $gte: new Date(Date.now() - REVIEW_SHARE_COOLDOWN_MS) },
    })
      .sort({ createdAt: -1 })
      .select("createdAt")
      .lean();
    if (recentShareOfSameTitle) {
      const retryAfterMs = recentShareOfSameTitle.createdAt.getTime() + REVIEW_SHARE_COOLDOWN_MS - Date.now();
      return sendError(res, "You've already shared a review for this title recently. Try again later.", 429, { retryAfterMs });
    }

    const [contentData, rating] = await Promise.all([
      hydrateContentData(review.contentId, review.contentType),
      Rating.findOne({ user: userId, contentId: review.contentId }).select("value").lean(),
    ]);
    if (!contentData) return sendError(res, "Content not found", 404);

    const share = await Share.create({
      user: userId,
      type: "review",
      reviewText: review.text,
      reviewRating: rating?.value ?? null,
      contentId: review.contentId,
      contentType: review.contentType,
      contentData,
    });
    return sendSuccess(res, share, "Shared to Medya", 201);
  }

  if (type === "recommendation") {
    const { contentId, contentType, note } = req.body;
    if (!contentId || !["movie", "series"].includes(contentType)) {
      return sendError(res, "contentId and a valid contentType are required", 400);
    }
    const contentData = await hydrateContentData(contentId, contentType);
    if (!contentData) return sendError(res, "Content not found", 404);

    const share = await Share.create({
      user: userId,
      type: "recommendation",
      contentId,
      contentType,
      contentData,
      note: note?.trim() || undefined,
    });
    return sendSuccess(res, share, "Shared to Medya", 201);
  }

  if (type === "list") {
    const { listId } = req.body;
    if (!listId) return sendError(res, "listId is required", 400);
    const list = await CustomList.findOne({ _id: listId, owner: userId, isPublic: true }).lean();
    if (!list) return sendError(res, "List not found", 404);

    // Bigger limit than the default 5 — this box stacks however many
    // posters actually fit the post's real width (PosterCascade's
    // fitToWidth on the mobile side), not a fixed small preview count.
    const [hydrated] = await hydratePreviewItems([list], 20);
    const share = await Share.create({
      user: userId,
      type: "list",
      listId: list._id,
      listData: {
        name: list.name,
        description: list.description,
        itemCount: list.items.length,
        previewItems: hydrated.previewItems,
      },
    });
    return sendSuccess(res, share, "Shared to Medya", 201);
  }

  return sendError(res, 'type must be "analysis", "review", "recommendation", or "list"', 400);
});

// A like is worth ~20h of recency, following the author ~53h — real enough
// to matter, not enough to bury every brand-new post from someone you
// don't follow. Replaces the old separate Sort (Recent/Popular/Network) +
// Type filter UI: recency/engagement/network are blended into one ranking
// instead of being exposed as manual controls the user has to pick between
// (same "remove the control, let the page organize itself" call already
// made for Discover's own tab bar earlier this session), and per-type
// filtering was dropped entirely since every post already carries its own
// icon/color badge (ShareCard.tsx's typeMeta) for visual scanning, plus
// dedicated full-browse pages already exist for Reviews/Lists specifically
// (/home/reviews, /home/lists-discover).
const FEED_LIKE_WEIGHT = 3;
const FEED_NETWORK_BOOST = 8;
const FEED_DECAY_PER_HOUR = 0.15;

// Official Cinephix posts (isOfficialPost:true) are NOT ranked by the score
// formula above — a flat score boost was tried first, but a fresh official
// post starts with zero likes/follows like anyone else's, so it still lost
// to any already-liked organic post and simply never surfaced in practice
// (confirmed live: it scored ~6, several seeded posts scored well above
// that on likes alone). Pulling official posts out of the ranking entirely
// and placing them at FIXED, GUARANTEED absolute positions across the whole
// feed is the only way to satisfy "must show up regardless of popularity."
// Direct, explicit density requirement: the very first post of the feed is
// always official, then another one every 3-4 organic posts after that —
// noticeably more frequent than an earlier one-per-page version, which the
// user reported as "still far too rare" in practice. The gap between
// consecutive official slots alternates 3/4 via a small deterministic hash
// (not a fixed 3,4,3,4… pattern, and not truly random either — a real
// per-request random gap would make the SAME page's arrangement shift on
// every refetch, which reads as a bug, not a feature) so it *looks*
// unpredictable while staying byte-for-byte reproducible for the same
// absolute feed position. Only applied for scope "all" — scope "following"
// is deliberately just the people you follow, and nobody follows the
// official account by default.
const OFFICIAL_MIN_GAP = 3;
const OFFICIAL_GAP_SPREAD = 3; // gap is OFFICIAL_MIN_GAP, +1, or +2 (3-5), direct ask ("kimi zaman 3 kimi zaman 4" up to 5)

// A tiny deterministic (Knuth multiplicative) hash — same input always
// produces the same output, so re-fetching the same page never reshuffles
// it, but consecutive slot numbers don't look like an obviously fixed
// pattern either.
function stableHash(n) {
  return Math.imul(n ^ 0x9e3779b9, 2654435761) >>> 0;
}

// All official-slot absolute positions (0-indexed into the *combined*
// official+organic feed) strictly less than `beforeIndex` — position 0 is
// always a slot (the guaranteed first-post placement), then each next slot
// sits `1 + gap` positions after the previous one, gap alternating 3/4 via
// stableHash. Deterministic and cheap (one pass, no DB access) so it can be
// recomputed per-request with no stored cursor/state needed.
function officialSlotPositions(beforeIndex) {
  const slots = [];
  let pos = 0;
  let i = 0;
  while (pos < beforeIndex) {
    slots.push(pos);
    const gap = OFFICIAL_MIN_GAP + (stableHash(i) % OFFICIAL_GAP_SPREAD);
    pos += 1 + gap;
    i++;
  }
  return slots;
}

// Fixed 8-step category cycle for official slots — direct ask, exact order
// given: the page's very first official slot is always a poll (so the
// opening post is "fresh"), then trivia from the pool, then a same-day-
// release-coincidence trivia specifically (the other DB-native trivia
// template — origin-country — isn't part of this named sequence, folded
// into "trivia_pool" below instead of getting its own slot), then a binary
// ("this or that") poll specifically, then on-this-day, highlight, tip,
// and community stats. Repeats (slot 8 is poll again, slot 9 is
// trivia_pool again, ...) for every slot past the first 8 — "kalanları da
// ona göre dağıt."
const OFFICIAL_CATEGORY_SEQUENCE = ["poll_any", "trivia_pool", "trivia_same_release", "poll_binary", "on_this_day", "highlight", "tip", "stats"];

// Sorts an official Share doc into one of OFFICIAL_CATEGORY_SEQUENCE's
// buckets from its own already-persisted shape — no new field needed on
// Share itself, every distinction here already exists in how each
// generator (officialContentService.js) shapes its own payload:
//  - poll: pollData.options.length === 2 is the binary ("this or that")
//    template, anything else (the 5-option "best X" templates) is
//    poll_any's own pool too (poll_any's bucket is every poll, binary
//    included, not just the non-binary ones — never asked to exclude them).
//  - trivia: generateSameDayReleaseTrivia is the only trivia generator
//    that sets 2 officialLinks (one per title) and no top-level contentId;
//    everything else trivia-shaped (the 300-item pool, and the other
//    DB-native template, origin-country, which sets exactly 1 link plus a
//    contentId) falls into the general trivia_pool bucket.
function classifyOfficialDoc(doc) {
  if (doc.type === "poll") {
    const optionCount = doc.pollData?.options?.length || 0;
    return optionCount === 2 ? "poll_binary" : "poll_any";
  }
  if (doc.officialCategory === "trivia") {
    const linkCount = doc.officialLinks?.length || 0;
    return linkCount >= 2 ? "trivia_same_release" : "trivia_pool";
  }
  return doc.officialCategory; // "tip" | "highlight" | "on_this_day" | "stats" | "announcement"
}

// Shared hydration (author + viewers + liked/poll-vote fields + the final
// wire shape) for both the organic ranked query and the one official post
// below — kept in one place so the two queries can never drift on what
// shape a Share ends up in on the wire.
const shareHydrationStages = (userId) => [
  { $lookup: { from: "users", localField: "user", foreignField: "_id", as: "user" } },
  { $unwind: "$user" },
  { $lookup: { from: "users", localField: "views", foreignField: "_id", as: "viewUsers" } },
  // Flatten the first 5 voters of EVERY option into one array so a single
  // $lookup can hydrate every option's own small "who voted" avatar preview
  // at once (StackedAvatars, same idea as topViewers above), instead of one
  // $lookup per option. A pipeline-form $lookup (not a plain localField/
  // foreignField one) restricts the joined user docs to only the safe
  // fields a client should ever see — this is a public vote-preview, not an
  // authenticated profile fetch, so full user documents (password hash
  // included) must never flow through here.
  {
    $addFields: {
      _pollTopVoterIds: {
        $cond: [
          { $eq: ["$type", "poll"] },
          { $reduce: { input: { $ifNull: ["$pollData.options", []] }, initialValue: [], in: { $setUnion: ["$$value", { $slice: ["$$this.votes", 5] }] } } },
          [],
        ],
      },
    },
  },
  {
    $lookup: {
      from: "users",
      let: { ids: "$_pollTopVoterIds" },
      pipeline: [{ $match: { $expr: { $in: ["$_id", "$$ids"] } } }, { $project: { _id: 1, username: 1, profile_pic_url: 1 } }],
      as: "_pollVoterUsers",
    },
  },
  {
    $addFields: {
      liked: { $in: [new mongoose.Types.ObjectId(userId), "$likes"] },
      topViewers: { $slice: ["$viewUsers", 5] },
      // Poll votes carry raw voter ids server-side (revote handling in
      // voteOnPoll needs them) but the client only ever needs per-option
      // counts plus which option (if any) the caller themselves picked —
      // never the full voter list.
      userVoteIndex: {
        $cond: [
          { $eq: ["$type", "poll"] },
          {
            $let: {
              vars: {
                idx: {
                  $indexOfArray: [
                    { $map: { input: { $ifNull: ["$pollData.options", []] }, as: "o", in: { $in: [new mongoose.Types.ObjectId(userId), "$$o.votes"] } } },
                    true,
                  ],
                },
              },
              in: { $cond: [{ $eq: ["$$idx", -1] }, null, "$$idx"] },
            },
          },
          null,
        ],
      },
      "pollData.options": {
        $cond: [
          { $eq: ["$type", "poll"] },
          {
            $map: {
              input: { $ifNull: ["$pollData.options", []] },
              as: "o",
              in: {
                text: "$$o.text",
                voteCount: { $size: "$$o.votes" },
                topVoters: {
                  $map: {
                    input: { $slice: ["$$o.votes", 5] },
                    as: "vid",
                    in: { $arrayElemAt: [{ $filter: { input: "$_pollVoterUsers", cond: { $eq: ["$$this._id", "$$vid"] } } }, 0] },
                  },
                },
              },
            },
          },
          "$pollData.options",
        ],
      },
    },
  },
  {
    $project: {
      type: 1,
      analysisData: 1,
      reviewText: 1,
      reviewRating: 1,
      note: 1,
      contentId: 1,
      contentType: 1,
      contentData: 1,
      listId: 1,
      listData: 1,
      officialCategory: 1,
      officialText: 1,
      officialLinks: 1,
      pollData: 1,
      userVoteIndex: 1,
      likeCount: 1,
      viewCount: 1,
      createdAt: 1,
      updatedAt: 1,
      liked: 1,
      "user._id": 1,
      "user.username": 1,
      "user.profile_pic_url": 1,
      "user.accountTier": 1,
      "user.isOfficial": 1,
      "topViewers._id": 1,
      "topViewers.username": 1,
      "topViewers.profile_pic_url": 1,
    },
  },
];

// ── GET /api/shares/feed?page=&limit=&scope= ── scope defaults to "all"
// (the blended ranking above); "following" restricts to just the shares
// of people the caller follows, still ranked by the same score within
// that subset — a lightweight re-add of a "Friends" view, requested
// directly by the user after the broader Sort/Type filter UI was removed
// (see FEED_LIKE_WEIGHT's own comment above). Not the old removed
// "Network" sort mode brought back wholesale — that also changed the
// *ranking formula* itself; this is purely a hard filter on top of the
// exact same one ranking everyone else sees, so "All" and "Friends" never
// disagree on relative order, only on which posts are eligible at all.
// Following nobody legitimately returns an empty feed here, unlike the
// "all" scope's own following-agnostic fallback — that's the whole point
// of asking for just your friends' posts.
export const getShareFeed = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, MAX_LIMIT);
  const scope = req.query.scope === "following" ? "following" : "all";

  const currentUser = await User.findById(userId).select("following").lean();
  const followingIds = currentUser?.following || [];
  const now = new Date();

  // The organic, score-ranked query always excludes official posts — they
  // get fixed guaranteed positions instead of competing on engagement (see
  // officialSlotPositions above).
  const organicMatch = { isOfficialPost: { $ne: true }, ...(scope === "following" ? { user: { $in: followingIds } } : {}) };

  const officialCount = scope === "all" ? await Share.countDocuments({ isOfficialPost: true }) : 0;

  // Which absolute feed positions in this page's own [pageStart, pageEnd)
  // window are official slots, and how many came before this page (needed
  // both to pick *which* organic items belong on this page — organic
  // positions are everything that ISN'T a slot — and to know how far into
  // the official rotation this page's own slots have advanced).
  const pageStart = (page - 1) * limit;
  const pageEnd = page * limit;
  let officialSlotsInPage = [];
  let slotsBeforePage = 0;
  if (officialCount > 0) {
    const allSlotsUpToPageEnd = officialSlotPositions(pageEnd);
    slotsBeforePage = allSlotsUpToPageEnd.filter((p) => p < pageStart).length;
    officialSlotsInPage = allSlotsUpToPageEnd.filter((p) => p >= pageStart);
  }
  const organicCountThisPage = limit - officialSlotsInPage.length;
  const organicSkip = pageStart - slotsBeforePage;

  // `score` is computed per-request (recency+engagement+network blended),
  // so no index can back this $sort — at this collection's current real
  // size (live-checked: 72 documents) that's genuinely free, but Mongo's
  // default in-memory sort has a hard 100MB cap with no fallback; a much
  // larger Share collection down the line would eventually hit that and
  // start hard-failing every feed request instead of just getting slower.
  // .allowDiskUse(true) below is the same fix already applied to the
  // movies/series list endpoints' own $facet stage for the identical
  // reason — free to add now, before it's ever actually needed.
  // MongoDB's $limit stage rejects 0 outright ("the limit must be
  // positive") — confirmed live with a small `limit` request (e.g. 1) where
  // every position in the page is a reserved official slot, leaving zero
  // organic items needed. Skip the whole aggregate in that case rather than
  // trying to $limit:0 it away.
  const organicQuery =
    organicCountThisPage > 0
      ? Share.aggregate([
          { $match: organicMatch },
          {
            $addFields: {
              isFollowed: { $in: ["$user", followingIds] },
              ageHours: { $divide: [{ $subtract: [now, "$createdAt"] }, 1000 * 60 * 60] },
            },
          },
          {
            $addFields: {
              score: {
                $subtract: [
                  { $add: [{ $multiply: ["$likeCount", FEED_LIKE_WEIGHT] }, { $cond: ["$isFollowed", FEED_NETWORK_BOOST, 0] }] },
                  { $multiply: ["$ageHours", FEED_DECAY_PER_HOUR] },
                ],
              },
            },
          },
          { $sort: { score: -1, createdAt: -1 } },
          { $skip: Math.max(0, organicSkip) },
          { $limit: organicCountThisPage },
          ...shareHydrationStages(userId),
        ]).allowDiskUse(true)
      : Promise.resolve([]);

  const [organicItems, organicTotal, officialDocs] = await Promise.all([
    organicQuery,
    Share.countDocuments(organicMatch),
    // The official pool is small (low hundreds at most) — cheaper to fetch
    // every doc's classification fields once (sorted, so each bucket below
    // ends up newest-first for free) and pick this page's handful out of it
    // in JS than to run one query per slot.
    officialSlotsInPage.length > 0
      ? Share.find({ isOfficialPost: true })
          .select("_id type officialCategory contentId officialLinks pollData.options")
          .sort({ createdAt: -1 })
          .lean()
      : [],
  ]);

  let officialItems = [];
  if (officialSlotsInPage.length > 0 && officialDocs.length > 0) {
    // Buckets by OFFICIAL_CATEGORY_SEQUENCE's own category key, each
    // already newest-first (officialDocs' own sort order is preserved by
    // a plain push loop). A slot's exact category comes from its position
    // in the repeating 8-step sequence; which doc within that category's
    // bucket comes from a SEPARATE per-category occurrence counter (how
    // many times this exact category has appeared so far), not the slot's
    // own global number — that's what makes the very first poll slot
    // always land on the single most recent poll (occurrence 0) while a
    // later poll slot rotates to the next-most-recent one instead of
    // repeating it, same "straight sequential cycle, never a hash" reasoning
    // the old single-pool rotation used, just scoped per category now.
    const buckets = {};
    for (const doc of officialDocs) {
      const key = classifyOfficialDoc(doc);
      (buckets[key] ||= []).push(doc._id);
    }
    const categoryOccurrenceSoFar = {};
    // Slots strictly before this page still advance each category's own
    // occurrence counter even though their docs aren't refetched here — has
    // to replay the same classification counting from slot 0, cheap (JS
    // math over small arrays, no DB work) and the only way a later page's
    // rotation state stays consistent with what earlier pages already showed.
    for (let g = 0; g < slotsBeforePage; g++) {
      const cat = OFFICIAL_CATEGORY_SEQUENCE[g % OFFICIAL_CATEGORY_SEQUENCE.length];
      categoryOccurrenceSoFar[cat] = (categoryOccurrenceSoFar[cat] || 0) + 1;
    }

    const selectedIds = officialSlotsInPage.map((_absPos, k) => {
      const globalSlotNumber = slotsBeforePage + k;
      const category = OFFICIAL_CATEGORY_SEQUENCE[globalSlotNumber % OFFICIAL_CATEGORY_SEQUENCE.length];
      const occurrence = categoryOccurrenceSoFar[category] || 0;
      categoryOccurrenceSoFar[category] = occurrence + 1;
      const bucket = buckets[category];
      if (bucket && bucket.length > 0) return bucket[occurrence % bucket.length];
      // Fallback for a category with nothing posted yet (e.g. no binary
      // poll exists so early in seeding) — cycle the WHOLE pool instead of
      // leaving the slot empty, same reasoning the old single-pool
      // rotation used everywhere.
      return officialDocs[globalSlotNumber % officialDocs.length]._id;
    });
    const hydrated = await Share.aggregate([{ $match: { _id: { $in: selectedIds } } }, ...shareHydrationStages(userId)]);
    const hydratedMap = new Map(hydrated.map((h) => [h._id.toString(), h]));
    officialItems = selectedIds.map((id) => hydratedMap.get(id.toString())).filter(Boolean);
  }

  // Weave official items back into their exact reserved positions; organic
  // items fill every other slot in original (already-ranked) order.
  const items = new Array(limit).fill(null);
  officialSlotsInPage.forEach((absPos, k) => {
    items[absPos - pageStart] = officialItems[k];
  });
  let organicPtr = 0;
  for (let i = 0; i < limit; i++) {
    if (items[i] == null) items[i] = organicItems[organicPtr++];
  }
  // Trailing nulls happen near the end of the feed once organic items run
  // out before every reserved slot got filled — drop them rather than
  // sending gaps.
  const finalItems = items.filter(Boolean);

  sendSuccess(res, { items: finalItems, page, hasMore: organicSkip + organicItems.length < organicTotal }, "Share feed fetched");
});

// ── POST /api/shares/:id/like ── toggle the caller's own like on/off
export const toggleShareLike = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const share = await Share.findById(req.params.id);
  if (!share) return sendError(res, "Share not found", 404);

  const existingIndex = share.likes.findIndex((id) => id.toString() === userId.toString());
  let liked;

  if (existingIndex === -1) {
    share.likes.push(userId);
    share.likeCount += 1;
    liked = true;
  } else {
    share.likes.splice(existingIndex, 1);
    share.likeCount = Math.max(0, share.likeCount - 1);
    liked = false;
  }

  await share.save();

  // A "list" share is a snapshot post ABOUT a real CustomList, not its own
  // independent thing to like — liking the post should mean liking the
  // list, so the list's own `likes` (already the signal /lists/popular
  // ranks on) actually reflects engagement that happened via the feed, not
  // just via visiting the list detail page directly. Keeps the list's
  // like state as a mirror of this user's share-like state (set, not
  // re-toggle) so it can't drift out of sync on repeated toggles.
  if (share.type === "list" && share.listId) {
    const list = await CustomList.findById(share.listId).select("likes");
    if (list) {
      const listHasLiked = list.likes.some((id) => id.toString() === userId.toString());
      if (liked && !listHasLiked) {
        list.likes.push(userId);
        await list.save();
      } else if (!liked && listHasLiked) {
        list.likes.pull(userId);
        await list.save();
      }
    }
  }

  sendSuccess(res, { likeCount: share.likeCount, liked }, "Like updated");
});

// ── POST /api/shares/:id/view ── idempotent: registers the caller as a
// unique viewer at most once, no-ops on repeat calls (e.g. the same card
// re-mounting while scrolling).
export const registerShareView = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const share = await Share.findById(req.params.id);
  if (!share) return sendError(res, "Share not found", 404);

  const alreadyViewed = share.views.some((id) => id.toString() === userId.toString());
  if (!alreadyViewed) {
    share.views.push(userId);
    share.viewCount += 1;
    await share.save();

    // Same reasoning as toggleShareLike above — a view of a "list" share is
    // a real view of the underlying list, so it should count toward the
    // list's own `views` counter (the same one /lists/:id increments when
    // someone visits the list directly), not just the share's own count.
    if (share.type === "list" && share.listId) {
      await CustomList.updateOne({ _id: share.listId }, { $inc: { views: 1 } });
    }
  }

  sendSuccess(res, { viewCount: share.viewCount }, "View registered");
});

// ── POST /api/shares/:id/vote ── one vote per user; voting again with a
// different optionIndex swaps the vote rather than adding a second one
// (removes the caller from every option first, then adds to the chosen
// one) — never a double-count. Closed-option only, matching the app's own
// constraint that no auto-posted content may invite an open/written
// response.
export const voteOnPoll = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const optionIndex = parseInt(req.body.optionIndex);

  const share = await Share.findById(req.params.id);
  if (!share) return sendError(res, "Share not found", 404);
  if (share.type !== "poll") return sendError(res, "Share is not a poll", 400);
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= share.pollData.options.length) {
    return sendError(res, "Invalid optionIndex", 400);
  }

  for (const option of share.pollData.options) {
    option.votes.pull(userId);
  }
  share.pollData.options[optionIndex].votes.push(userId);
  await share.save();

  // Same "first 5 voters" avatar preview shape getShareFeed's own
  // shareHydrationStages returns — hydrated here directly against the
  // already-loaded Mongoose doc rather than a second aggregation, since a
  // single vote only ever touches a handful of ids across all options.
  const allVoterIds = [...new Set(share.pollData.options.flatMap((o) => o.votes.slice(0, 5).map((id) => id.toString())))];
  const voters = allVoterIds.length ? await User.find({ _id: { $in: allVoterIds } }).select("username profile_pic_url").lean() : [];
  const voterMap = new Map(voters.map((u) => [u._id.toString(), u]));
  const options = share.pollData.options.map((o) => ({
    text: o.text,
    voteCount: o.votes.length,
    topVoters: o.votes.slice(0, 5).map((id) => voterMap.get(id.toString())).filter(Boolean),
  }));
  sendSuccess(res, { options, userVoteIndex: optionIndex }, "Vote registered");
});

// ── GET /api/shares/user/:userId?page=&limit= ──
export const getUserShares = asyncHandler(async (req, res) => {
  const targetUserId = req.params.userId === "me" ? req.user.id : req.params.userId;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, MAX_LIMIT);

  const query = { user: targetUserId };
  const [items, total] = await Promise.all([
    Share.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      // accountTier included here so Profile's own shares grid can drive
      // TierAvatarFrame — getShareFeed above uses a $lookup-based
      // aggregation instead of populate() and already selects
      // "user.accountTier" itself (see that function).
      .populate("user", "username profile_pic_url accountTier isOfficial")
      .populate("views", "username profile_pic_url")
      .lean(),
    Share.countDocuments(query),
  ]);

  // Batch-fetch every poll's top-5-voter identities across the whole page in
  // one query, same reasoning as shareHydrationStages' own single $lookup —
  // avoids one User.find per poll per page.
  const allVoterIds = new Set();
  for (const s of items) {
    if (s.type === "poll" && s.pollData) {
      for (const o of s.pollData.options) (o.votes || []).slice(0, 5).forEach((id) => allVoterIds.add(id.toString()));
    }
  }
  const voters = allVoterIds.size ? await User.find({ _id: { $in: [...allVoterIds] } }).select("username profile_pic_url").lean() : [];
  const voterMap = new Map(voters.map((u) => [u._id.toString(), u]));

  const requesterId = req.user.id;
  const withMeta = items.map((s) => {
    const liked = (s.likes || []).some((id) => id.toString() === requesterId.toString());
    const topViewers = (s.views || []).slice(0, 5);
    let pollData = s.pollData;
    let userVoteIndex = null;
    if (s.type === "poll" && pollData) {
      const optionsWithCounts = pollData.options.map((o, i) => {
        if (o.votes.some((id) => id.toString() === requesterId.toString())) userVoteIndex = i;
        return {
          text: o.text,
          voteCount: o.votes.length,
          topVoters: o.votes.slice(0, 5).map((id) => voterMap.get(id.toString())).filter(Boolean),
        };
      });
      pollData = { question: pollData.question, options: optionsWithCounts };
    }
    return { ...s, liked, topViewers, pollData, userVoteIndex, likes: undefined, views: undefined };
  });

  sendPaginated(res, withMeta, total, page, limit, "User shares fetched");
});

// ── DELETE /api/shares/:id ── owner-only
export const deleteShare = asyncHandler(async (req, res) => {
  const share = await Share.findById(req.params.id);
  if (!share) return sendError(res, "Share not found", 404);
  if (share.user.toString() !== req.user.id.toString()) {
    return sendError(res, "Not authorized", 403);
  }
  await share.deleteOne();
  sendSuccess(res, null, "Share deleted");
});
