// Validation for reports and the moderation queue. Pure, so it's tested
// without a database (reportRules.test.js).

import mongoose from "mongoose";
import { REPORT_ENTITY_TYPES, REPORT_REASONS, REPORT_STATUSES } from "../models/Report.js";

export const MAX_DESCRIPTION = 1000;
/** Reports one person can file per hour — enough for real use, not for flooding the queue. */
export const REPORTS_PER_HOUR = 20;

/**
 * A report as filed by the app: { entityType, entityId, reason, description? }.
 * Returns { value } or { error } — never throws.
 */
export function parseReportInput(body = {}) {
  const { entityType, entityId, reason } = body;
  if (!REPORT_ENTITY_TYPES.includes(entityType)) return { error: "Unknown entity type" };
  if (!mongoose.isValidObjectId(entityId)) return { error: "Invalid entity id" };
  if (!REPORT_REASONS.includes(reason)) return { error: "Unknown reason" };
  const description = typeof body.description === "string" ? body.description.trim().slice(0, MAX_DESCRIPTION) : "";
  return { value: { entityType, entityId: String(entityId), reason, description: description || undefined } };
}

/**
 * The admin queue's filters: ?status=&entityType=&reportedUserId=&reporterId=&page=&limit=.
 * status "all" drops the status filter (a user's whole history).
 */
export function parseQueueQuery(query = {}) {
  const filter = {};
  if (query.status !== "all") filter.status = REPORT_STATUSES.includes(query.status) ? query.status : "pending";
  if (REPORT_ENTITY_TYPES.includes(query.entityType)) filter.entityType = query.entityType;
  if (mongoose.isValidObjectId(query.reportedUserId)) filter.reportedUserId = new mongoose.Types.ObjectId(query.reportedUserId);
  if (mongoose.isValidObjectId(query.reporterId)) filter.reporterId = new mongoose.Types.ObjectId(query.reporterId);
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 25));
  return { filter, page, limit };
}

/** A moderator's decision: { status, resolutionNote? }. Reopening (back to pending) is allowed. */
export function parseDecision(body = {}) {
  if (!REPORT_STATUSES.includes(body.status)) return { error: "Unknown status" };
  const note = typeof body.resolutionNote === "string" ? body.resolutionNote.trim().slice(0, MAX_DESCRIPTION) : undefined;
  return { value: { status: body.status, resolutionNote: note || undefined } };
}
