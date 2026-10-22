// The admin dashboard's ticket export: every ticket as CSV (for a
// spreadsheet), JSON (for scripts and AI analysis) and Markdown (for reading
// top to bottom). Pure, so it's tested without a database
// (ticketExport.test.js); the controller only feeds it tickets.
//
// Tickets have no attachments yet. The column and the `attachments` list are
// kept anyway, holding paths as a ZIP would lay them out
// (attachments/<ticket-id>/<filename>), so the format doesn't change the day
// they arrive.

/** Excel only reads a CSV as UTF-8 (ç, ğ, ı, ö, ş, ü) when it starts with a BOM. */
export const CSV_BOM = "﻿";

/** What the export populates on each ticket — the username, never the email or devices. */
export const EXPORT_USER_FIELDS = "username accountTier";

const iso = (date) => (date ? new Date(date).toISOString() : null);

/**
 * One ticket, flattened for export: the populated user reduced to who they
 * are, each reply's admin to a username.
 */
export function ticketRecord(ticket) {
  const user = ticket.userId && typeof ticket.userId === "object" && "username" in ticket.userId ? ticket.userId : null;
  const replies = (ticket.replies ?? []).map((reply) => ({
    text: reply.text ?? "",
    admin: reply.adminId?.username ?? null,
    createdAt: iso(reply.createdAt),
  }));
  return {
    id: String(ticket._id),
    type: ticket.type,
    status: ticket.status,
    title: ticket.title,
    description: ticket.description,
    user: {
      id: user ? String(user._id) : ticket.userId ? String(ticket.userId) : null,
      username: user?.username ?? null,
      accountTier: user?.accountTier ?? null,
    },
    createdAt: iso(ticket.createdAt),
    updatedAt: iso(ticket.updatedAt),
    statusChangedAt: iso(ticket.statusChangedAt),
    repliedAt: iso(ticket.repliedAt),
    // Older tickets have an adminReply but no replies list.
    latestReply: ticket.adminReply ?? replies.at(-1)?.text ?? null,
    replies,
    // Added by a moderator rather than written in the app (models/Ticket.js).
    manual: Boolean(ticket.manual),
    createdByAdmin: ticket.manual ? (ticket.createdByAdmin?.username ?? null) : null,
    source: ticket.source ?? null,
    attachments: [],
  };
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

/** The CSV's columns, in order: header and how to read it off a ticketRecord. */
export const CSV_COLUMNS = [
  ["id", (t) => t.id],
  ["type", (t) => t.type],
  ["status", (t) => t.status],
  ["title", (t) => t.title],
  ["description", (t) => t.description],
  ["username", (t) => t.user.username],
  ["userId", (t) => t.user.id],
  ["accountTier", (t) => t.user.accountTier],
  ["createdAt", (t) => t.createdAt],
  ["updatedAt", (t) => t.updatedAt],
  ["statusChangedAt", (t) => t.statusChangedAt],
  ["repliedAt", (t) => t.repliedAt],
  ["replyCount", (t) => t.replies.length],
  ["latestReply", (t) => t.latestReply],
  ["manual", (t) => t.manual],
  ["createdByAdmin", (t) => t.createdByAdmin],
  ["source", (t) => t.source],
  ["attachments", (t) => t.attachments.join("; ")],
];

// A cell a spreadsheet would run as a formula. Tab and carriage return are
// in the list too: Excel strips them and then reads what follows.
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One CSV cell: neutralised if a spreadsheet would run it as a formula, then
 * quoted (RFC 4180) if it holds a comma, quote or line break.
 */
export function csvCell(value) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const csvLine = (cells) => `${cells.map(csvCell).join(",")}\r\n`;

/** The header line. Starts the file — after the BOM. */
export const csvHeader = () => csvLine(CSV_COLUMNS.map(([name]) => name));

/** One ticketRecord as a CSV line. */
export const csvRow = (record) => csvLine(CSV_COLUMNS.map(([, read]) => read(record)));

/** A whole CSV file, BOM included. */
export const ticketsCsv = (records) => CSV_BOM + csvHeader() + records.map(csvRow).join("");

// ─── JSON and Markdown ───────────────────────────────────────────────────────

/** { exportedAt, filters, count, tickets } — the full structure, replies and all. */
export function ticketsJson(records, { exportedAt, filters }) {
  return JSON.stringify({ exportedAt: iso(exportedAt), filters, count: records.length, tickets: records }, null, 2);
}

// People's own words are quoted, so a "# heading" someone typed into a
// description stays inside their ticket instead of starting a new section.
const quote = (text) =>
  String(text ?? "")
    .split(/\r?\n/)
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");

const describeFilters = (filters) => {
  const parts = Object.entries(filters ?? {}).map(([key, value]) => `${key}: ${value}`);
  return parts.length ? parts.join(", ") : "none (all tickets)";
};

/** Every ticket as its own section: what it is, what was said, what's attached. */
export function ticketsMarkdown(records, { exportedAt, filters }) {
  const head = [
    "# Support tickets",
    "",
    `- Exported: ${iso(exportedAt)}`,
    `- Filters: ${describeFilters(filters)}`,
    `- Tickets: ${records.length}`,
  ].join("\n");

  const sections = records.map((t) => {
    const lines = [
      `## ${t.title} (${t.id})`,
      "",
      `- **Status:** ${t.status}`,
      `- **Type:** ${t.type}`,
      `- **User:** ${t.user.username ? `@${t.user.username}` : t.manual && !t.user.id ? "(none)" : "(deleted account)"}${t.user.accountTier ? ` · ${t.user.accountTier}` : ""}`,
      `- **Created:** ${t.createdAt}`,
      `- **Updated:** ${t.updatedAt}`,
    ];
    if (t.statusChangedAt) lines.push(`- **Status changed:** ${t.statusChangedAt}`);
    if (t.manual) {
      lines.push(`- **Added manually by:** ${t.createdByAdmin ? `@${t.createdByAdmin}` : "a moderator"}`);
      if (t.source) lines.push(`- **Source:** ${t.source}`);
    }
    lines.push("", "### Description", "", quote(t.description));

    if (t.replies.length) {
      lines.push("", "### Replies");
      for (const reply of t.replies) {
        lines.push("", `**${reply.admin ? `@${reply.admin}` : "Moderator"}** · ${reply.createdAt}`, "", quote(reply.text));
      }
    } else if (t.latestReply) {
      lines.push("", "### Reply", "", quote(t.latestReply));
    }

    lines.push("", "### Attachments", "", t.attachments.length ? t.attachments.map((path) => `- ${path}`).join("\n") : "None");
    return lines.join("\n");
  });

  return [head, ...sections].join("\n\n---\n\n") + "\n";
}

// ─── File names ──────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, "0");

/**
 * tickets-export-2026-10-20-2039.zip, in the admin's own time: `tzOffset` is
 * the browser's getTimezoneOffset() (minutes behind UTC), as the Recent
 * signups endpoints take it.
 */
export function exportFilename(extension, now = new Date(), tzOffset = 0) {
  const local = new Date(now.getTime() - tzOffset * 60 * 1000);
  const date = `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
  return `tickets-export-${date}-${pad(local.getUTCHours())}${pad(local.getUTCMinutes())}.${extension}`;
}
