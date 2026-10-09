import mongoose from "mongoose";
import { asyncHandler } from "../middleware/errorHandler.js";
import User from "../models/User.js";
import TierGrantLog from "../models/TierGrantLog.js";
import { invalidateUserCache } from "../middleware/authMiddleware.js";
import { logTierGrant } from "../services/tierGrants.js";
import { sendError, sendSuccess } from "../utils/response.js";
import {
  effectiveTier,
  endGrantUpdate,
  grantActive,
  grantUpdate,
  parseExtend,
  parseGrant,
  previousTierFor,
  remaining,
  tierAfterGrant,
  usernameSearch,
} from "../utils/tierGrants.js";

// Admin-granted Plus/Premium (the dashboard's "Premium grants" tab), under
// /api/admin, so every route is signed-in admins only (routes/adminRoute.js).
// Rules: utils/tierGrants.js. Every change is written to TierGrantLog.

const USER_FIELDS = "_id username profile_pic_url accountTier tierGrant";

function paging(query, defaultLimit = 20) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

/** A user as the dashboard shows them: the tier they really have, and their grant if any. */
function toRow(user, now = new Date()) {
  const grant = user.tierGrant && grantActive(user, now) ? user.tierGrant : null;
  return {
    _id: user._id,
    username: user.username,
    profile_pic_url: user.profile_pic_url || "",
    accountTier: effectiveTier(user, now),
    grant: grant
      ? {
          tier: grant.tier,
          expiresAt: grant.expiresAt,
          grantedAt: grant.grantedAt ?? null,
          grantedBy: grant.grantedBy && grant.grantedBy.username ? { _id: grant.grantedBy._id, username: grant.grantedBy.username } : grant.grantedBy ?? null,
          note: grant.note ?? null,
          previousTier: grant.previousTier || "free",
          remainingDays: remaining(grant.expiresAt, now).days,
          remainingMs: remaining(grant.expiresAt, now).ms,
        }
      : null,
  };
}

async function findTarget(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return User.findById(id).select(USER_FIELDS).lean();
}

function auditBase(req, target) {
  return { user: target._id, username: target.username, admin: req.user._id, adminUsername: req.user.username };
}

// GET /api/admin/tier-grants/users?q=&page=&limit= — find people by username (partial, any case).
export const searchGrantUsers = asyncHandler(async (req, res) => {
  const match = usernameSearch(req.query.q);
  if (!match) return sendError(res, "Type part of a username", 400);
  const { page, limit, skip } = paging(req.query);
  const filter = { username: match };
  const [users, total] = await Promise.all([
    User.find(filter).select(USER_FIELDS).sort({ username: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const now = new Date();
  sendSuccess(res, {
    items: users.map((user) => toRow(user, now)),
    pagination: { page, limit, total, hasMore: skip + users.length < total },
  });
});

// GET /api/admin/tier-grants?page=&limit= — grants still running, soonest to end first.
export const listActiveGrants = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paging(req.query, 50);
  const now = new Date();
  const filter = { "tierGrant.expiresAt": { $gt: now } };
  const [users, total] = await Promise.all([
    User.find(filter)
      .select(USER_FIELDS)
      .populate("tierGrant.grantedBy", "username")
      .sort({ "tierGrant.expiresAt": 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  sendSuccess(res, {
    items: users.map((user) => toRow(user, now)),
    pagination: { page, limit, total, hasMore: skip + users.length < total },
  });
});

// GET /api/admin/tier-grants/log?userId=&page=&limit= — the audit trail, newest first.
export const listGrantLog = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const filter = {};
  if (req.query.userId) {
    if (!mongoose.isValidObjectId(req.query.userId)) return sendError(res, "User not found", 404);
    filter.user = req.query.userId;
  }
  const [items, total] = await Promise.all([
    TierGrantLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    TierGrantLog.countDocuments(filter),
  ]);
  sendSuccess(res, { items, pagination: { page, limit, total, hasMore: skip + items.length < total } });
});

// POST /api/admin/users/:id/tier-grant — { tier, days | expiresAt, note? }.
// Granting over a running grant replaces it, and still restores the tier
// from before the first one when it ends.
export const grantTier = asyncHandler(async (req, res) => {
  const now = new Date();
  const { value, error } = parseGrant(req.body, now);
  if (error) return sendError(res, error, 400);
  const target = await findTarget(req.params.id);
  if (!target) return sendError(res, "User not found", 404);

  const previousTier = previousTierFor(target, now);
  await User.updateOne({ _id: target._id }, grantUpdate({ ...value, adminId: req.user._id, previousTier, now }));
  invalidateUserCache(target._id);
  await logTierGrant({
    ...auditBase(req, target),
    action: "grant",
    tier: value.tier,
    tierBefore: effectiveTier(target, now),
    tierAfter: value.tier,
    expiresAtBefore: grantActive(target, now) ? target.tierGrant.expiresAt : undefined,
    expiresAtAfter: value.expiresAt,
    note: value.note,
  });

  const updated = await User.findById(target._id).select(USER_FIELDS).populate("tierGrant.grantedBy", "username").lean();
  sendSuccess(res, toRow(updated, now), `${value.tier === "premium" ? "Premium" : "Plus"} granted`, 201);
});

// PATCH /api/admin/users/:id/tier-grant — { days | expiresAt, note? }:
// more time on a running grant (days count from its current end).
export const extendTierGrant = asyncHandler(async (req, res) => {
  const now = new Date();
  const target = await findTarget(req.params.id);
  if (!target) return sendError(res, "User not found", 404);
  if (!grantActive(target, now)) return sendError(res, "This account has no running grant to extend", 409);
  const { value, error } = parseExtend(req.body, target.tierGrant.expiresAt, now);
  if (error) return sendError(res, error, 400);

  const set = { "tierGrant.expiresAt": value.expiresAt, tierUpdatedAt: now };
  if (value.note) set["tierGrant.note"] = value.note;
  await User.updateOne({ _id: target._id }, { $set: set });
  invalidateUserCache(target._id);
  await logTierGrant({
    ...auditBase(req, target),
    action: "extend",
    tier: target.tierGrant.tier,
    tierBefore: target.accountTier,
    tierAfter: target.accountTier,
    expiresAtBefore: target.tierGrant.expiresAt,
    expiresAtAfter: value.expiresAt,
    note: value.note,
  });

  const updated = await User.findById(target._id).select(USER_FIELDS).populate("tierGrant.grantedBy", "username").lean();
  sendSuccess(res, toRow(updated, now), "Grant extended");
});

// DELETE /api/admin/users/:id/tier-grant — ends a grant now; the account
// goes back to the tier it had before.
export const revokeTierGrant = asyncHandler(async (req, res) => {
  const now = new Date();
  const target = await findTarget(req.params.id);
  if (!target) return sendError(res, "User not found", 404);
  if (!target.tierGrant) return sendError(res, "This account has no grant to revoke", 404);

  const tierAfter = tierAfterGrant(target);
  await User.updateOne({ _id: target._id }, endGrantUpdate(target, now));
  invalidateUserCache(target._id);
  await logTierGrant({
    ...auditBase(req, target),
    action: "revoke",
    tier: target.tierGrant.tier,
    tierBefore: target.accountTier,
    tierAfter,
    expiresAtBefore: target.tierGrant.expiresAt,
    note: typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 500) || undefined : undefined,
  });

  sendSuccess(res, toRow({ ...target, accountTier: tierAfter, tierGrant: undefined }, now), "Grant revoked");
});
