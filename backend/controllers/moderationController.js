import mongoose from "mongoose";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendError, sendSuccess } from "../utils/response.js";
import User from "../models/User.js";
import Report from "../models/Report.js";
import CustomList from "../models/CustomList.js";
import Review from "../models/Review.js";
import Share from "../models/Share.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Group from "../models/Group.js";
import FootprintEvent from "../models/FootprintEvent.js";
import { blockUser, unblockUser } from "../services/blockService.js";
import { removeShareNotifications } from "../services/notifications.js";
import { invalidateUserCache } from "../middleware/authMiddleware.js";
import { ENTITY_TYPE_OF, parseDeleteTarget, parseSuspension, resolutionNote, suspendedUntil, suspensionRefusal } from "../utils/moderationActions.js";
import { REPORTS_PER_HOUR, parseDecision, parseQueueQuery, parseReportInput } from "../utils/reportRules.js";

// ─── Blocking ────────────────────────────────────────────────────────────────

// POST /api/users/:id/block
export const block = asyncHandler(async (req, res) => {
  const targetId = req.params.id;
  if (!mongoose.isValidObjectId(targetId)) return sendError(res, "User not found", 404);
  if (String(targetId) === String(req.user._id)) return sendError(res, "You can't block yourself", 400);
  const target = await User.findById(targetId).select("_id isOfficial").lean();
  if (!target) return sendError(res, "User not found", 404);
  if (target.isOfficial) return sendError(res, "The official Cinephix account can't be blocked", 403);
  await blockUser(req.user, targetId);
  sendSuccess(res, { blocked: true }, "User blocked");
});

// DELETE /api/users/:id/block — only the blocker can undo their own block.
export const unblock = asyncHandler(async (req, res) => {
  const targetId = req.params.id;
  if (!mongoose.isValidObjectId(targetId)) return sendError(res, "User not found", 404);
  await unblockUser(req.user, targetId);
  sendSuccess(res, { blocked: false }, "User unblocked");
});

// GET /api/users/me/blocked — the people you've blocked (not who blocked you).
export const listBlocked = asyncHandler(async (req, res) => {
  const me = await User.findById(req.user._id)
    .select("blockedUsers")
    .populate("blockedUsers", "username profile_pic_url accountTier")
    .lean();
  // Skipped by the block filter: this one list is *about* blocked people.
  req.skipBlockFilter = true;
  sendSuccess(res, (me?.blockedUsers ?? []).filter(Boolean), "Blocked users fetched");
});

// GET /api/users/official — the official Cinephix account(s), which can't be
// reported or blocked. The app loads this once, to leave the ⋯ off their
// content wherever it shows up. Cached: the account never changes in practice.
let officialCache = { ids: null, at: 0 };
export const officialAccounts = asyncHandler(async (_req, res) => {
  if (!officialCache.ids || Date.now() - officialCache.at > 10 * 60_000) {
    const rows = await User.find({ isOfficial: true }).select("_id").lean();
    officialCache = { ids: rows.map((r) => String(r._id)), at: Date.now() };
  }
  sendSuccess(res, { ids: officialCache.ids }, "Official accounts fetched");
});

// ─── Reporting ───────────────────────────────────────────────────────────────

/**
 * The reported thing: who made it, a snapshot of it for moderators, and
 * whether the reporter could actually see it. Null when it doesn't exist.
 */
async function resolveEntity(entityType, entityId, reporter) {
  switch (entityType) {
    case "User": {
      const user = await User.findById(entityId).select("username bio profile_pic_url").lean();
      return user && { ownerId: user._id, snapshot: { username: user.username, bio: user.bio, profile_pic_url: user.profile_pic_url } };
    }
    case "List": {
      const list = await CustomList.findById(entityId).select("owner name description isPublic").lean();
      if (!list) return null;
      const visible = list.isPublic || String(list.owner) === String(reporter._id);
      return visible && { ownerId: list.owner, snapshot: { name: list.name, description: list.description } };
    }
    case "Review": {
      const review = await Review.findById(entityId).select("user text contentId contentType").lean();
      return review && { ownerId: review.user, snapshot: { text: review.text, contentId: review.contentId, contentType: review.contentType } };
    }
    case "Share": {
      const share = await Share.findById(entityId)
        .select("user type reviewText note contentData.title listData.name officialText")
        .lean();
      return (
        share && {
          ownerId: share.user,
          snapshot: {
            type: share.type,
            text: share.reviewText || share.note || share.officialText,
            title: share.contentData?.title || share.listData?.name,
          },
        }
      );
    }
    case "Message": {
      const message = await Message.findById(entityId).select("sender text type roomType roomId").lean();
      if (!message) return null;
      // Only someone in that chat saw the message.
      const inRoom =
        message.roomType === "dm"
          ? await Conversation.exists({ _id: message.roomId, participants: reporter._id })
          : await Group.exists({ _id: message.roomId, "members.user": reporter._id });
      return (
        inRoom && {
          ownerId: message.sender,
          snapshot: { text: message.text, type: message.type, roomType: message.roomType, roomId: message.roomId },
        }
      );
    }
    default:
      // "Comment" is reserved for a comments feature the app doesn't have yet.
      return null;
  }
}

// POST /api/reports { entityType, entityId, reason, description? }
export const createReport = asyncHandler(async (req, res) => {
  const { value, error } = parseReportInput(req.body);
  if (error) return sendError(res, error, 400);
  const { entityType, entityId, reason, description } = value;
  const reporter = req.user;

  const entity = await resolveEntity(entityType, entityId, reporter);
  if (!entity) return sendError(res, "That content isn't available to report", 404);
  if (String(entity.ownerId) === String(reporter._id)) return sendError(res, "You can't report your own content", 400);
  // The official Cinephix account's posts are the app's own announcements.
  if (await User.exists({ _id: entity.ownerId, isOfficial: true })) {
    return sendError(res, "The official Cinephix account can't be reported", 403);
  }

  const recent = await Report.countDocuments({ reporterId: reporter._id, createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } });
  if (recent >= REPORTS_PER_HOUR) return sendError(res, "You've sent a lot of reports recently. Please try again later.", 429);

  try {
    const report = await Report.create({
      reporterId: reporter._id,
      reportedEntityId: entityId,
      entityType,
      reportedUserId: entity.ownerId,
      reason,
      description,
      snapshot: entity.snapshot,
    });
    return sendSuccess(res, { reportId: report._id, alreadyReported: false }, "Report received", 201);
  } catch (err) {
    // Already reported and still pending: the existing report stands.
    if (err?.code === 11000) return sendSuccess(res, { alreadyReported: true }, "Already reported", 200);
    throw err;
  }
});

// ─── Moderation (admins only; see routes/adminRoute.js) ─────────────────────

/**
 * Marks each report with whether the thing it is about still exists.
 *
 * A moderator can remove reported content, and the report outlives it (its
 * snapshot is the record). Without this the dashboard would keep offering
 * Delete for something already gone, and answer with a bare 404 — which is
 * exactly what it did before. One query per entity type, not per report.
 */
async function withEntityExistence(reports) {
  const models = { Review, Share, List: CustomList, Message, User };
  const byType = new Map();
  for (const report of reports) {
    if (!models[report.entityType]) continue;
    if (!byType.has(report.entityType)) byType.set(report.entityType, new Set());
    byType.get(report.entityType).add(String(report.reportedEntityId));
  }

  const alive = new Set();
  await Promise.all(
    [...byType].map(async ([entityType, ids]) => {
      const found = await models[entityType]
        .find({ _id: { $in: [...ids] } })
        .select("_id")
        .lean();
      for (const doc of found) alive.add(`${entityType}:${doc._id}`);
    })
  );

  return reports.map((report) => ({
    ...report,
    entityExists: models[report.entityType] ? alive.has(`${report.entityType}:${report.reportedEntityId}`) : null,
  }));
}

// GET /api/admin/reports?status=&entityType=&reportedUserId=&page=&limit=
export const listReports = asyncHandler(async (req, res) => {
  const { filter, page, limit } = parseQueueQuery(req.query);
  const [items, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("reporterId", "username profile_pic_url")
      .populate("reportedUserId", "username profile_pic_url accountTier isSuspended")
      .populate("reviewedBy", "username")
      .lean(),
    Report.countDocuments(filter),
  ]);
  sendSuccess(res, { items: await withEntityExistence(items), page, limit, total, hasMore: page * limit < total }, "Reports fetched");
});

// GET /api/admin/reports/stats — queue sizes, for the dashboard's header.
export const reportStats = asyncHandler(async (req, res) => {
  const rows = await Report.aggregate([{ $group: { _id: { status: "$status", entityType: "$entityType" }, count: { $sum: 1 } } }]);
  const byStatus = {};
  const pendingByType = {};
  for (const { _id, count } of rows) {
    byStatus[_id.status] = (byStatus[_id.status] ?? 0) + count;
    if (_id.status === "pending") pendingByType[_id.entityType] = count;
  }
  sendSuccess(res, { byStatus, pendingByType }, "Report stats fetched");
});

// GET /api/admin/users/:id — who someone is, for a moderator looking into a
// report: their public profile plus what only moderators see (email, join
// date, flags) and their report history both ways. Blocks don't apply here.
export const adminUserSummary = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, "User not found", 404);
  const id = new mongoose.Types.ObjectId(req.params.id);
  const [user, against, filed] = await Promise.all([
    User.findById(id)
      .select("username email bio profile_pic_url accountTier isOfficial isAdmin isSuspended suspendedUntil suspendedAt suspensionReason createdAt followers following")
      .lean(),
    Report.aggregate([{ $match: { reportedUserId: id } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Report.countDocuments({ reporterId: id }),
  ]);
  if (!user) return sendError(res, "User not found", 404);
  const { followers, following, ...rest } = user;
  sendSuccess(
    res,
    {
      ...rest,
      followersCount: followers?.length ?? 0,
      followingCount: following?.length ?? 0,
      reportsAgainst: Object.fromEntries(against.map((r) => [r._id, r.count])),
      reportsFiled: filed,
    },
    "User fetched"
  );
});

// ─── Taking content down, and suspending accounts ───────────────────────────

/**
 * Removes one piece of content and everything that pointed at it, then
 * closes the reports about it. Deletion is permanent — moderators see what
 * they are removing in full first (the dashboard's profile view), and the
 * report keeps its own snapshot of it either way.
 */
async function removeContent(type, id) {
  switch (type) {
    case "share": {
      const share = await Share.findById(id);
      if (!share) return null;
      await share.deleteOne();
      // Its "liked your share" notification would open a page that's gone.
      await removeShareNotifications(share._id);
      return { ownerId: share.user, summary: share.reviewText || share.note || share.officialText || share.type };
    }
    case "review": {
      const review = await Review.findByIdAndDelete(id).lean();
      return review && { ownerId: review.user, summary: review.text };
    }
    case "list": {
      const list = await CustomList.findByIdAndDelete(id).lean();
      if (!list) return null;
      await Promise.all([
        // A "liked this list" entry in someone's activity, and any post
        // showing the list off, both point at something that no longer exists.
        FootprintEvent.deleteMany({ type: "list_liked", list: list._id }),
        Share.deleteMany({ type: "list", listId: list._id }),
      ]);
      return { ownerId: list.owner, summary: list.name };
    }
    case "message": {
      const message = await Message.findByIdAndDelete(id).lean();
      if (!message) return null;
      // The inbox shows the last message of each chat; if this was it, fall
      // back to whatever is now newest rather than leaving deleted text there.
      if (message.roomType === "dm") {
        const latest = await Message.findOne({ roomId: message.roomId }).sort({ createdAt: -1 }).lean();
        await Conversation.updateOne(
          { _id: message.roomId },
          { $set: { lastMessage: latest?.text ?? "", lastMessageAt: latest?.createdAt ?? null } }
        );
      }
      return { ownerId: message.sender, summary: message.text };
    }
    default:
      return null;
  }
}

// DELETE /api/admin/content/:type/:id  { reason? }
export const deleteContent = asyncHandler(async (req, res) => {
  const { value, error } = parseDeleteTarget(req.params, req.body);
  if (error) return sendError(res, error, 400);

  const removed = await removeContent(value.type, value.id);
  // Most often this means a moderator already removed it.
  if (!removed) return sendError(res, "That content has already been removed", 404);

  // Every pending report about this thing is now answered by its removal.
  const entityType = ENTITY_TYPE_OF[value.type];
  const closed = await Report.updateMany(
    { reportedEntityId: value.id, entityType, status: "pending" },
    {
      $set: {
        status: "resolved",
        reviewedBy: req.user._id,
        reviewedAt: new Date(),
        resolutionNote: resolutionNote("deleted", req.user.username, value.reason),
      },
    }
  );

  sendSuccess(res, { type: value.type, id: value.id, ownerId: removed.ownerId, reportsResolved: closed.modifiedCount ?? 0 }, "Content removed");
});

// PATCH /api/admin/users/:id/suspension  { suspended, reason? }
export const setSuspension = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, "User not found", 404);
  const { value, error } = parseSuspension(req.body);
  if (error) return sendError(res, error, 400);

  const target = await User.findById(req.params.id).select("_id username isOfficial isAdmin isSuspended suspendedUntil").lean();
  const refusal = suspensionRefusal(target, req.user._id);
  if (refusal) return sendError(res, refusal, refusal === "User not found" ? 404 : 403);

  const now = new Date();
  const until = value.suspended ? suspendedUntil(value.hours, now) : null;
  const update = value.suspended
    ? {
        $set: {
          isSuspended: true,
          suspendedAt: now,
          suspendedBy: req.user._id,
          suspensionReason: value.reason,
          // A permanent suspension simply has no end date.
          ...(until ? { suspendedUntil: until } : {}),
        },
        ...(until ? {} : { $unset: { suspendedUntil: 1 } }),
      }
    : { $set: { isSuspended: false }, $unset: { suspendedUntil: 1, suspendedAt: 1, suspendedBy: 1, suspensionReason: 1 } };
  await User.updateOne({ _id: target._id }, update);
  // The auth middleware holds a user for a few seconds; drop it so the
  // suspension bites on their very next request rather than the one after.
  invalidateUserCache(target._id);

  let reportsResolved = 0;
  if (value.suspended) {
    // Suspending answers the open reports about them.
    const closed = await Report.updateMany(
      { reportedUserId: target._id, status: "pending" },
      {
        $set: {
          status: "resolved",
          reviewedBy: req.user._id,
          reviewedAt: now,
          resolutionNote: resolutionNote("suspended", req.user.username, value.reason),
        },
      }
    );
    reportsResolved = closed.modifiedCount ?? 0;
  }

  sendSuccess(
    res,
    {
      _id: target._id,
      username: target.username,
      isSuspended: value.suspended,
      suspendedAt: value.suspended ? now : null,
      suspendedUntil: until,
      suspensionReason: value.suspended ? value.reason : null,
      reportsResolved,
    },
    value.suspended ? (until ? "Account suspended temporarily" : "Account suspended permanently") : "Suspension lifted"
  );
});

// GET /api/admin/users/:id/reviews?page=&limit= — everything this person
// has written, from the Review collection itself: a reported review isn't
// necessarily one they also posted to the feed, so the profile's own posts
// aren't enough to judge by. Titles are filled in from the content the app
// already stores.
export const adminUserReviews = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, "User not found", 404);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const filter = { user: req.params.id };
  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
  ]);

  const Movie = mongoose.model("Movie");
  const Series = mongoose.model("Series");
  const idsOf = (type) => reviews.filter((r) => r.contentType === type && mongoose.isValidObjectId(r.contentId)).map((r) => r.contentId);
  const [movies, series] = await Promise.all([
    Movie.find({ _id: { $in: idsOf("movie") } }).select("title name poster_path").lean(),
    Series.find({ _id: { $in: idsOf("series") } }).select("title name poster_path").lean(),
  ]);
  const byId = new Map([...movies, ...series].map((doc) => [String(doc._id), doc]));

  sendSuccess(
    res,
    {
      items: reviews.map((review) => {
        const doc = byId.get(String(review.contentId));
        return {
          _id: review._id,
          text: review.text,
          contentId: review.contentId,
          contentType: review.contentType,
          // The series collection is inconsistent about which field holds a
          // show's name (see utils/analysisMath.js).
          title: doc ? (review.contentType === "series" ? doc.name || doc.title : doc.title || doc.name) : null,
          poster_path: doc?.poster_path ?? null,
          likeCount: review.likes?.length ?? 0,
          createdAt: review.createdAt,
          updatedAt: review.updatedAt,
        };
      }),
      page,
      limit,
      total,
      hasMore: page * limit < total,
    },
    "Reviews fetched"
  );
});

// PATCH /api/admin/reports/:id { status, resolutionNote? }
export const decideReport = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, "Report not found", 404);
  const { value, error } = parseDecision(req.body);
  if (error) return sendError(res, error, 400);
  // Resolving or dismissing records who and when; reopening clears both
  // (and any old note), so the report reads as undecided again.
  const set = { status: value.status };
  const unset = {};
  if (value.status === "pending") Object.assign(unset, { reviewedBy: 1, reviewedAt: 1 });
  else Object.assign(set, { reviewedBy: req.user._id, reviewedAt: new Date() });
  if (value.resolutionNote) set.resolutionNote = value.resolutionNote;
  else unset.resolutionNote = 1;
  try {
    const report = await Report.findByIdAndUpdate(req.params.id, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { new: true })
      .populate("reporterId", "username profile_pic_url")
      .populate("reportedUserId", "username profile_pic_url accountTier isSuspended")
      .populate("reviewedBy", "username")
      .lean();
    if (!report) return sendError(res, "Report not found", 404);
    // Reopening never touches the reported content — a report about something
    // already removed reopens fine, and says so through entityExists.
    const [withExistence] = await withEntityExistence([report]);
    sendSuccess(res, withExistence, "Report updated");
  } catch (err) {
    // Reopening while the same person has a newer pending report on it.
    if (err?.code === 11000) return sendError(res, "A pending report for this already exists", 409);
    throw err;
  }
});
