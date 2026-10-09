import mongoose from "mongoose";
import { asyncHandler } from "../middleware/errorHandler.js";
import User from "../models/User.js";
import Rating from "../models/Rating.js";
import Group from "../models/Group.js";
import { getOnlineUserIds } from "../services/presenceService.js";
import { sendError, sendSuccess } from "../utils/response.js";
import {
  RECENT_PROJECTION,
  dailySeries,
  parseRecentQuery,
  parseTzOffset,
  recentFilter,
  startOfLocalDay,
  toSignupRow,
  tzString,
} from "../utils/recentSignups.js";

// The dashboard's "Recent signups" tab, under /api/admin (signed-in admins
// only). Rules and the row shape: utils/recentSignups.js.
//
// One aggregate returns the page (filtered, newest first, paginated, and
// projected down to counts and booleans in the database), then two grouped
// counts cover only that page's users: ratings, and communities joined.

/** userId → count, for the given users, from a grouped aggregate. */
async function countsByUser(model, ids, match, userPath) {
  const rows = await model.aggregate([
    { $match: match },
    ...(userPath.includes(".") ? [{ $unwind: `$${userPath.split(".")[0]}` }, { $match: { [userPath]: { $in: ids } } }] : []),
    { $group: { _id: `$${userPath}`, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

// GET /api/admin/users/recent?days=&method=&verified=&q=&page=&limit=&tz=
export const recentSignups = asyncHandler(async (req, res) => {
  const now = new Date();
  const { value, error } = parseRecentQuery(req.query, now);
  if (error) return sendError(res, error, 400);

  const [result] = await User.aggregate([
    { $match: recentFilter(value) },
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        items: [{ $skip: value.skip }, { $limit: value.limit }, { $project: RECENT_PROJECTION }],
        total: [{ $count: "n" }],
      },
    },
  ]);
  const docs = result?.items ?? [];
  const total = result?.total?.[0]?.n ?? 0;

  const ids = docs.map((doc) => doc._id);
  const [ratings, communities] = ids.length
    ? await Promise.all([
        countsByUser(Rating, ids, { user: { $in: ids } }, "user"),
        countsByUser(Group, ids, { "members.user": { $in: ids } }, "members.user"),
      ])
    : [new Map(), new Map()];
  const online = new Set(getOnlineUserIds().map(String));

  const items = docs.map((doc) => {
    const id = String(doc._id);
    return toSignupRow(doc, { ratings: ratings.get(id) ?? 0, communities: communities.get(id) ?? 0, online: online.has(id), now });
  });

  sendSuccess(res, {
    items,
    since: value.since,
    pagination: { page: value.page, limit: value.limit, total, hasMore: value.skip + items.length < total },
  });
});

// GET /api/admin/users/recent/stats?tz= — signups today, in the last 7 and
// 30 days (local calendar days, today included), and per day for 30 days.
export const recentSignupStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const tz = parseTzOffset(req.query.tz);
  const since30 = startOfLocalDay(now, tz, 29);
  const [today, last7, last30, buckets] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: startOfLocalDay(now, tz) } }),
    User.countDocuments({ createdAt: { $gte: startOfLocalDay(now, tz, 6) } }),
    User.countDocuments({ createdAt: { $gte: since30 } }),
    User.aggregate([
      { $match: { createdAt: { $gte: since30 } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: tzString(tz) } }, count: { $sum: 1 } } },
    ]),
  ]);
  sendSuccess(res, { today, last7, last30, daily: dailySeries(buckets, now, 30, tz) });
});

// GET /api/admin/users/:id/email — one person's full address, when an admin
// asks for it (the list only ever shows it masked).
export const revealUserEmail = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, "User not found", 404);
  const user = await User.findById(req.params.id).select("email").lean();
  if (!user) return sendError(res, "User not found", 404);
  sendSuccess(res, { _id: user._id, email: user.email });
});
