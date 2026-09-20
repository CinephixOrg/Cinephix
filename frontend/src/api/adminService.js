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

/** Suspends or restores an account. Suspending requires a reason. */
export async function setSuspension(userId, suspended, reason) {
  const res = await API.patch(`/admin/users/${userId}/suspension`, { suspended, reason });
  return res.data;
}
