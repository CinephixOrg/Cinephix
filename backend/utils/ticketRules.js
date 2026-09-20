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
