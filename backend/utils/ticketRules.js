// Validation for support tickets. Pure, so it's tested without a database
// (ticketRules.test.js).

import mongoose from "mongoose";
import { TICKET_STATUSES, TICKET_TYPES } from "../models/Ticket.js";

export const MAX_TITLE = 120;
export const MAX_DESCRIPTION = 4000;
export const MAX_REPLY = 4000;
/** Tickets one person can open per day — generous for real use, not for flooding the queue. */
export const TICKETS_PER_DAY = 10;

const text = (value, max) => (typeof value === "string" ? value.trim().replace(/\s+$/g, "").slice(0, max) : "");

/**
 * A ticket as the app sends it: { type, title, description }.
 * Returns { value } or { error } — never throws.
 */
export function parseTicketInput(body = {}) {
  if (!TICKET_TYPES.includes(body.type)) return { error: "Unknown ticket type" };
  const title = text(body.title, MAX_TITLE);
  if (title.length < 3) return { error: "Please give your ticket a title" };
  const description = text(body.description, MAX_DESCRIPTION);
  if (description.length < 10) return { error: "Please describe the issue in a little more detail" };
  return { value: { type: body.type, title, description } };
}

// ─── What the app sees ───────────────────────────────────────────────────────

/**
 * Every app-facing ticket query: one person's tickets, never a manual one.
 * `$ne: true` rather than `false`, since tickets from before manual ones
 * existed have no `manual` field at all.
 */
export const appTicketFilter = (userId, extra = {}) => ({ ...extra, userId, manual: { $ne: true } });

/** The tickets that count against someone's TICKETS_PER_DAY: their own, in the last day. */
export const dailyLimitFilter = (userId, now = new Date()) =>
  appTicketFilter(userId, { createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } });

/**
 * A ticket as the app reads it — no reporter, no moderators, nothing about
 * how it was filed — plus its unread flag.
 */
export function forUser(ticket) {
  return {
    _id: ticket._id,
    type: ticket.type,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    adminReply: ticket.adminReply,
    replies: (ticket.replies ?? []).map((reply) => ({ text: reply.text, createdAt: reply.createdAt })),
    repliedAt: ticket.repliedAt,
    hasUnreadReply: hasUnreadReply(ticket),
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

/** Whether a moderator's change is pushed to the reporter: only for their own ticket, never a manual one. */
export const shouldPushTicketUpdate = (ticket) => Boolean(ticket && !ticket.manual && ticket.userId);

// ─── Tickets a moderator adds by hand ────────────────────────────────────────

/** A manual ticket is a bug or an idea that came in some other way. */
export const MANUAL_TICKET_TYPES = ["Bug Report", "Feature Request"];
export const MAX_SOURCE = 200;

/**
 * The dashboard's "New ticket" form: { type, title, description, status?,
 * reporterId?, source? }. Over-long text is refused rather than cut — the
 * form limits it already, so anything longer didn't come from the form.
 * Returns { value } or { error } — never throws.
 */
export function parseAdminTicketInput(body = {}) {
  body ??= {};
  if (!MANUAL_TICKET_TYPES.includes(body.type)) return { error: "Type must be Bug Report or Feature Request" };

  const fields = [
    ["title", "Title", MAX_TITLE, true],
    ["description", "Description", MAX_DESCRIPTION, true],
    ["source", "Source", MAX_SOURCE, false],
  ];
  const value = { type: body.type };
  for (const [key, label, max, required] of fields) {
    if (body[key] !== undefined && body[key] !== null && typeof body[key] !== "string") return { error: `${label} must be text` };
    const trimmed = (body[key] ?? "").trim();
    if (required && !trimmed) return { error: `${label} is required` };
    if (trimmed.length > max) return { error: `${label} can be at most ${max} characters` };
    if (trimmed) value[key] = trimmed;
  }

  const status = body.status ?? "Open";
  if (!TICKET_STATUSES.includes(status)) return { error: "Unknown status" };
  value.status = status;

  if (body.reporterId !== undefined && body.reporterId !== null && body.reporterId !== "") {
    if (typeof body.reporterId !== "string" || !mongoose.isValidObjectId(body.reporterId)) return { error: "Unknown reporter" };
    value.reporterId = body.reporterId;
  }
  return { value };
}

/** The document a manual ticket is saved as: the same schema, marked manual, with who added it. */
export function manualTicketDoc(value, adminId, now = new Date()) {
  const doc = {
    type: value.type,
    title: value.title,
    description: value.description,
    status: value.status,
    manual: true,
    createdByAdmin: adminId,
  };
  if (value.reporterId) doc.userId = new mongoose.Types.ObjectId(value.reporterId);
  if (value.source) doc.source = value.source;
  if (value.status !== "Open") doc.statusChangedAt = now;
  return doc;
}

/** The admin queue's filters: ?status=&type=&userId=&page=&limit=. "all" drops a filter. */
export function parseTicketQuery(query = {}) {
  const filter = {};
  if (TICKET_STATUSES.includes(query.status)) filter.status = query.status;
  if (TICKET_TYPES.includes(query.type)) filter.type = query.type;
  if (mongoose.isValidObjectId(query.userId)) filter.userId = new mongoose.Types.ObjectId(query.userId);
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 25));
  return { filter, page, limit };
}

export const EXPORT_FORMATS = ["csv", "zip"];

// A day as the admin means it: YYYY-MM-DD at midnight in their timezone
// (`tzOffset` is the browser's getTimezoneOffset()). A full ISO timestamp is
// taken as is.
function parseDay(value, tzOffset) {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = day ? new Date(Date.UTC(+day[1], +day[2] - 1, +day[3]) + tzOffset * 60 * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : { date, dayOnly: Boolean(day) };
}

/**
 * The export's query: the queue's filters (?status=&type=&userId=, no
 * paging) plus ?from=&to= (YYYY-MM-DD or ISO; a `to` day counts whole),
 * ?format=csv|zip and ?tz=. No filters means every ticket.
 *
 * Returns { value: { filter, applied, format, tzOffset } } or { error };
 * `applied` is the filters in words, for the export's own header.
 */
export function parseTicketExportQuery(query = {}) {
  const format = query.format ?? "csv";
  if (!EXPORT_FORMATS.includes(format)) return { error: "Unknown export format" };

  const tz = parseInt(query.tz, 10);
  const tzOffset = Number.isFinite(tz) && Math.abs(tz) <= 14 * 60 ? tz : 0;

  const { filter } = parseTicketQuery(query);
  const applied = {};
  if (filter.status) applied.status = filter.status;
  if (filter.type) applied.type = filter.type;
  if (filter.userId) applied.userId = String(filter.userId);

  const createdAt = {};
  if (query.from) {
    const from = parseDay(query.from, tzOffset);
    if (!from) return { error: "Invalid from date" };
    createdAt.$gte = from.date;
    applied.from = query.from;
  }
  if (query.to) {
    const to = parseDay(query.to, tzOffset);
    if (!to) return { error: "Invalid to date" };
    createdAt[to.dayOnly ? "$lt" : "$lte"] = to.dayOnly ? new Date(to.date.getTime() + 24 * 60 * 60 * 1000) : to.date;
    applied.to = query.to;
  }
  if (createdAt.$gte && (createdAt.$gte >= (createdAt.$lt ?? Infinity) || createdAt.$gte > (createdAt.$lte ?? Infinity))) {
    return { error: "The from date must be before the to date" };
  }
  if (Object.keys(createdAt).length) filter.createdAt = createdAt;

  return { value: { filter, applied, format, tzOffset } };
}

/**
 * A moderator's update: { status?, reply? }. At least one of the two, since
 * an update that changes nothing still pushes a notification to the person.
 */
export function parseTicketUpdate(body = {}) {
  const status = body.status === undefined ? undefined : body.status;
  if (status !== undefined && !TICKET_STATUSES.includes(status)) return { error: "Unknown status" };
  const reply = text(body.reply, MAX_REPLY);
  if (status === undefined && !reply) return { error: "Nothing to update" };
  return { value: { status, reply: reply || undefined } };
}

/** Whether a ticket has an answer the person hasn't opened yet. */
export function hasUnreadReply(ticket) {
  if (!ticket?.repliedAt) return false;
  return !ticket.userReadAt || new Date(ticket.userReadAt) < new Date(ticket.repliedAt);
}
