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
