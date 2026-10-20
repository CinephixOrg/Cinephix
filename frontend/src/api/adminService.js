import API from "./axios.js";

// The moderation API (backend routes/adminRoute.js). Every call needs a
// signed-in admin; the server answers 403 otherwise.

/** The signed-in user, fresh from the server — the source of truth for isAdmin. */
export async function getMe() {
  const res = await API.get("/users/me");
  return res.data;
}

/**
 * { items, page, limit, total, hasMore }. status "all" for every status;
 * reportedUserId / reporterId narrow it to one person's history.
 */
export async function getReports({ status = "pending", entityType, reportedUserId, reporterId, page = 1, limit = 20 } = {}) {
  const params = { status, page, limit };
  if (entityType) params.entityType = entityType;
  if (reportedUserId) params.reportedUserId = reportedUserId;
  if (reporterId) params.reporterId = reporterId;
  const res = await API.get("/admin/reports", { params });
  return res.data;
}

/** A user as moderators see them, with their report counts both ways. */
export async function getAdminUser(id) {
  const res = await API.get(`/admin/users/${id}`);
  return res.data;
}

// Their profile as the mobile app shows it, read through /admin so the block
// filter is off and private lists are included (backend routes/adminRoute.js).
// Same endpoints, same shapes as the app's own public-profile screen.

export async function getAdminProfile(id) {
  const res = await API.get(`/admin/users/${id}/profile`);
  return res.data;
}

export async function getAdminCineGraph(id) {
  const res = await API.get(`/admin/users/${id}/cinegraph`);
  return res.data;
}

export async function getAdminFavorites(id) {
  const res = await API.get(`/admin/users/${id}/favorites`);
  return res.data;
}

/** { lists, watched: { total, items }, watchlist: { total, items } } */
export async function getAdminCollections(id) {
  const res = await API.get(`/admin/users/${id}/collections`);
  return res.data;
}

/** Their posts, newest first: { items, total, hasMore }. */
export async function getAdminShares(id, page = 1, limit = 10) {
  const res = await API.get(`/admin/users/${id}/shares`, { params: { page, limit } });
  const total = res.pagination?.total ?? res.data.length;
  return { items: res.data, total, hasMore: page * limit < total };
}

/** Every review they've written, shared to the feed or not. */
export async function getAdminReviews(id, page = 1, limit = 20) {
  const res = await API.get(`/admin/users/${id}/reviews`, { params: { page, limit } });
  return res.data;
}

/** { byStatus: { pending, resolved, dismissed }, pendingByType: { User, List, ... } } */
export async function getReportStats() {
  const res = await API.get("/admin/reports/stats");
  return res.data;
}

/** status: "resolved" | "dismissed" | "pending" (reopen). */
export async function decideReport(id, status, resolutionNote) {
  const res = await API.patch(`/admin/reports/${id}`, { status, resolutionNote });
  return res.data;
}

// ─── Support tickets ────────────────────────────────────────────────────────
// What people wrote from the app's Help & Feedback screen
// (backend/controllers/ticketController.js).

/** { items, page, limit, total, hasMore }. status/type "" for all of them. */
export async function getTickets({ status, type, userId, page = 1, limit = 20 } = {}) {
  const params = { page, limit };
  if (status) params.status = status;
  if (type) params.type = type;
  if (userId) params.userId = userId;
  const res = await API.get("/admin/tickets", { params });
  return res.data;
}

/** { byStatus: { Open, ... }, byType: { "Bug Report", ... } } */
export async function getTicketStats() {
  const res = await API.get("/admin/tickets/stats");
  return res.data;
}

/**
 * Downloads every ticket matching the filters — all of them with none — as
 * "csv", or "zip" (tickets.csv + tickets.json + tickets.md). Fetched as a
 * blob rather than linked to, since the admin token travels in a header.
 * `from`/`to` (YYYY-MM-DD) are supported by the server; the page doesn't
 * offer them yet.
 */
export async function exportTickets(format, { status, type, userId, from, to } = {}) {
  const params = { format, tz: new Date().getTimezoneOffset() };
  if (status) params.status = status;
  if (type) params.type = type;
  if (userId) params.userId = userId;
  if (from) params.from = from;
  if (to) params.to = to;
  let res;
  try {
    res = await API.get("/admin/tickets/export", { params, responseType: "blob" });
  } catch (err) {
    // An error's JSON body arrives as a blob too; read its message out.
    const body = err?.response?.data;
    if (body instanceof Blob) {
      try {
        err.response.data = JSON.parse(await body.text());
      } catch {
        // Not JSON — leave it.
      }
    }
    throw err;
  }
  const disposition = res.headers["content-disposition"] ?? "";
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `tickets-export.${format}`;
  const url = URL.createObjectURL(res.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

/**
 * Sets a ticket's status, adds a reply, or both — and the server tells the
 * person on their devices. Returns the updated ticket.
 */
export async function updateTicket(id, { status, reply } = {}) {
  const res = await API.patch(`/admin/tickets/${id}`, { status, reply });
  return res.data;
}

// ─── Taking content down, and suspending accounts ───────────────────────────
// Both are permanent enough that the UI asks twice before calling them.

/** Removes one review, post, list or message and closes the reports about it. */
export async function deleteContent(type, id, reason) {
  const res = await API.delete(`/admin/content/${type}/${id}`, { data: { reason } });
  return res.data;
}

/**
 * Suspends or restores an account. Suspending requires a reason;
 * `durationHours` null means permanent.
 */
export async function setSuspension(userId, suspended, reason, durationHours = null) {
  const res = await API.patch(`/admin/users/${userId}/suspension`, { suspended, reason, durationHours });
  return res.data;
}

// ─── Premium grants ─────────────────────────────────────────────────────────
// Plus/Premium for a limited time (backend controllers/tierGrantController.js).
// A row is { _id, username, profile_pic_url, accountTier, grant | null }.

/** Usernames containing `q`: { items, pagination }. */
export async function searchGrantUsers(q, page = 1, limit = 10) {
  const res = await API.get("/admin/tier-grants/users", { params: { q, page, limit } });
  return res.data;
}

/** Grants still running, soonest to end first: { items, pagination }. */
export async function getActiveGrants(page = 1, limit = 50) {
  const res = await API.get("/admin/tier-grants", { params: { page, limit } });
  return res.data;
}

/** The audit trail, newest first, optionally for one person: { items, pagination }. */
export async function getGrantLog({ userId, page = 1, limit = 20 } = {}) {
  const params = { page, limit };
  if (userId) params.userId = userId;
  const res = await API.get("/admin/tier-grants/log", { params });
  return res.data;
}

/** { tier: "plus" | "premium", days | expiresAt, note? } → the updated row. */
export async function grantTier(userId, body) {
  const res = await API.post(`/admin/users/${userId}/tier-grant`, body);
  return res.data;
}

/** { days | expiresAt, note? }; days are added to the current end. → the updated row. */
export async function extendTierGrant(userId, body) {
  const res = await API.patch(`/admin/users/${userId}/tier-grant`, body);
  return res.data;
}

/** Ends the grant now; the account goes back to its tier from before. → the updated row. */
export async function revokeTierGrant(userId) {
  const res = await API.delete(`/admin/users/${userId}/tier-grant`);
  return res.data;
}

// ─── Recent signups ─────────────────────────────────────────────────────────
// backend controllers/recentSignupsController.js. Emails come masked; one is
// revealed on purpose with revealUserEmail. `tz` is the browser's offset, so
// "today" and the daily counts follow the admin's own calendar day.

const tzOffset = () => new Date().getTimezoneOffset();

/** { items, since, pagination }. days 1 = today. */
export async function getRecentSignups({ days = 30, method, verified, q, page = 1, limit = 25 } = {}) {
  const params = { days, page, limit, tz: tzOffset() };
  if (method) params.method = method;
  if (verified) params.verified = "true";
  if (q) params.q = q;
  const res = await API.get("/admin/users/recent", { params });
  return res.data;
}

/** { today, last7, last30, daily: [{ date, count }] × 30 } */
export async function getRecentSignupStats() {
  const res = await API.get("/admin/users/recent/stats", { params: { tz: tzOffset() } });
  return res.data;
}

/** One person's full email address. */
export async function revealUserEmail(userId) {
  const res = await API.get(`/admin/users/${userId}/email`);
  return res.data.email;
}
