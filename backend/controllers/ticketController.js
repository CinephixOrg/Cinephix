import { once } from "node:events";
import AdmZip from "adm-zip";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendError, sendSuccess } from "../utils/response.js";
import Ticket, { TICKET_STATUSES, TICKET_TYPES } from "../models/Ticket.js";
import { pushTicketUpdate } from "../services/push.js";
import {
  TICKETS_PER_DAY,
  hasUnreadReply,
  parseTicketExportQuery,
  parseTicketInput,
  parseTicketQuery,
  parseTicketUpdate,
} from "../utils/ticketRules.js";
import {
  CSV_BOM,
  EXPORT_USER_FIELDS,
  csvHeader,
  csvRow,
  exportFilename,
  ticketRecord,
  ticketsCsv,
  ticketsJson,
  ticketsMarkdown,
} from "../utils/ticketExport.js";

// Support tickets: written from the app's Help & Feedback screen, answered
// from the web dashboard's Support Tickets queue.

/** A ticket as the app reads it — no moderator's notes, plus its unread flag. */
function forUser(ticket) {
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

// ─── The app ─────────────────────────────────────────────────────────────────

// POST /api/tickets { type, title, description }
export const createTicket = asyncHandler(async (req, res) => {
  const { value, error } = parseTicketInput(req.body);
  if (error) return sendError(res, error, 400);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const today = await Ticket.countDocuments({ userId: req.user._id, createdAt: { $gte: since } });
  if (today >= TICKETS_PER_DAY) return sendError(res, "You've opened a lot of tickets today. Please try again tomorrow.", 429);

  const ticket = await Ticket.create({ ...value, userId: req.user._id });
  sendSuccess(res, forUser(ticket.toObject()), "Ticket created", 201);
});

// GET /api/tickets/me?page=&limit= — their own history, newest first.
export const myTickets = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const filter = { userId: req.user._id };
  const [tickets, total] = await Promise.all([
    Ticket.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Ticket.countDocuments(filter),
  ]);
  const items = tickets.map(forUser);
  sendSuccess(
    res,
    { items, page, limit, total, hasMore: page * limit < total, unread: items.filter((t) => t.hasUnreadReply).length },
    "Tickets fetched"
  );
});

// GET /api/tickets/:id — one of their own.
export const getMyTicket = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, "Ticket not found", 404);
  const ticket = await Ticket.findOne({ _id: req.params.id, userId: req.user._id }).lean();
  if (!ticket) return sendError(res, "Ticket not found", 404);
  sendSuccess(res, forUser(ticket), "Ticket fetched");
});

// PATCH /api/tickets/:id/read — opening a ticket clears its "new answer" dot.
export const markTicketRead = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, "Ticket not found", 404);
  const ticket = await Ticket.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: { userReadAt: new Date() } },
    { new: true }
  ).lean();
  if (!ticket) return sendError(res, "Ticket not found", 404);
  sendSuccess(res, forUser(ticket), "Ticket read");
});

// ─── Moderation (admins only; see routes/adminRoute.js) ─────────────────────

// GET /api/admin/tickets?status=&type=&userId=&page=&limit=
export const listTickets = asyncHandler(async (req, res) => {
  const { filter, page, limit } = parseTicketQuery(req.query);
  const [items, total] = await Promise.all([
    Ticket.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("userId", "username profile_pic_url accountTier isSuspended")
      .populate("replies.adminId", "username")
      .lean(),
    Ticket.countDocuments(filter),
  ]);
  sendSuccess(res, { items, page, limit, total, hasMore: page * limit < total }, "Tickets fetched");
});

// GET /api/admin/tickets/stats — queue sizes, for the dashboard's header.
export const ticketStats = asyncHandler(async (_req, res) => {
  const rows = await Ticket.aggregate([{ $group: { _id: { status: "$status", type: "$type" }, count: { $sum: 1 } } }]);
  const byStatus = Object.fromEntries(TICKET_STATUSES.map((status) => [status, 0]));
  const byType = Object.fromEntries(TICKET_TYPES.map((type) => [type, 0]));
  for (const { _id, count } of rows) {
    byStatus[_id.status] = (byStatus[_id.status] ?? 0) + count;
    byType[_id.type] = (byType[_id.type] ?? 0) + count;
  }
  sendSuccess(res, { byStatus, byType }, "Ticket stats fetched");
});

// PATCH /api/admin/tickets/:id { status?, reply? }
//
// Either changes the status, adds an answer, or both — and tells the person
// so, on their devices. The answer is appended to the ticket's replies and
// becomes the one the app shows.
export const updateTicket = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, "Ticket not found", 404);
  const { value, error } = parseTicketUpdate(req.body);
  if (error) return sendError(res, error, 400);

  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return sendError(res, "Ticket not found", 404);

  const now = new Date();
  const statusChanged = Boolean(value.status && value.status !== ticket.status);
  if (statusChanged) {
    ticket.status = value.status;
    ticket.statusChangedAt = now;
  }
  if (value.reply) {
    ticket.adminReply = value.reply;
    ticket.replies.push({ text: value.reply, adminId: req.user._id, createdAt: now });
    ticket.repliedAt = now;
  }
  await ticket.save();

  // Only a real change is worth a notification.
  pushTicketUpdate(ticket.toObject(), { replied: Boolean(value.reply), statusChanged });

  const populated = await Ticket.findById(ticket._id)
    .populate("userId", "username profile_pic_url accountTier isSuspended")
    .populate("replies.adminId", "username")
    .lean();
  sendSuccess(res, populated, "Ticket updated");
});

// GET /api/admin/tickets/export?format=csv|zip&status=&type=&userId=&from=&to=&tz=
//
// Every ticket matching the queue's filters (or every ticket, with none), as
// a download. CSV streams straight from the database cursor. ZIP holds
// tickets.csv, tickets.json and tickets.md and is built in memory: tickets
// are text only, a few KB each.
export const exportTickets = asyncHandler(async (req, res) => {
  const { value, error } = parseTicketExportQuery(req.query);
  if (error) return sendError(res, error, 400);
  const { filter, applied, format, tzOffset } = value;

  const now = new Date();
  const query = () =>
    Ticket.find(filter)
      .sort({ createdAt: -1 })
      .populate("userId", EXPORT_USER_FIELDS)
      .populate("replies.adminId", "username")
      .lean();
  const download = (contentType) => {
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${exportFilename(format, now, tzOffset)}"`);
    res.setHeader("Cache-Control", "no-store");
  };

  if (format === "zip") {
    const records = (await query()).map(ticketRecord);
    const meta = { exportedAt: now, filters: applied };
    const zip = new AdmZip();
    zip.addFile("tickets.csv", Buffer.from(ticketsCsv(records), "utf8"));
    zip.addFile("tickets.json", Buffer.from(ticketsJson(records, meta), "utf8"));
    zip.addFile("tickets.md", Buffer.from(ticketsMarkdown(records, meta), "utf8"));
    download("application/zip");
    return res.send(zip.toBuffer());
  }

  // CSV, a row at a time. Once the first byte is out the error handler can't
  // answer with JSON any more, so a failure part-way cuts the download off
  // instead — the browser then reports it as failed rather than saving half.
  const cursor = query().cursor();
  download("text/csv; charset=utf-8");
  try {
    res.write(CSV_BOM + csvHeader());
    for await (const ticket of cursor) {
      if (res.destroyed) break;
      if (!res.write(csvRow(ticketRecord(ticket)))) await once(res, "drain");
    }
    res.end();
  } catch (err) {
    console.error("Ticket export failed:", err);
    res.destroy(err);
  } finally {
    await cursor.close().catch(() => {});
  }
});
