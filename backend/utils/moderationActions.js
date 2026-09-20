// What a moderator is allowed to remove or suspend, and how it reads back.
// Pure, so it's tested without a database (moderationActions.test.js).

import mongoose from "mongoose";

/** The kinds of content a moderator can delete, as the dashboard names them. */
export const DELETABLE_TYPES = ["review", "share", "list", "message"];

/** The report entity type each one corresponds to (models/Report.js). */
export const ENTITY_TYPE_OF = { review: "Review", share: "Share", list: "List", message: "Message" };

export const MAX_REASON = 500;

/** What the dashboard offers; `null` hours means permanent. */
export const SUSPENSION_DURATIONS = [
  { key: "24h", label: "24 hours", hours: 24 },
  { key: "3d", label: "3 days", hours: 72 },
  { key: "1w", label: "1 week", hours: 168 },
  { key: "permanent", label: "Permanent", hours: null },
];

/** A year, so a typo can't suspend someone into the next century. */
const MAX_HOURS = 8760;

const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/**
 * A delete request: { type, id }. Returns { value } or { error } — never
 * throws. `reason` is optional and only ever recorded, never shown to the
 * person whose content it was.
 */
export function parseDeleteTarget(params = {}, body = {}) {
  if (!DELETABLE_TYPES.includes(params.type)) return { error: "That kind of content can't be removed here" };
  if (!mongoose.isValidObjectId(params.id)) return { error: "Content not found" };
  return { value: { type: params.type, id: String(params.id), reason: text(body.reason, MAX_REASON) || undefined } };
}

/**
 * A suspension change: { suspended, reason? }.
 *
 * Suspending needs a reason — it's the one moderation action the person
 * feels immediately, and "why" is what a later appeal turns on. Lifting one
 * doesn't.
 */
export function parseSuspension(body = {}) {
  if (typeof body.suspended !== "boolean") return { error: "suspended must be true or false" };
  const reason = text(body.reason, MAX_REASON);
  if (body.suspended && !reason) return { error: "Please give a reason for the suspension" };

  // Absent or null hours = permanent; anything else must be a sane number.
  let hours = null;
  if (body.suspended && body.durationHours !== undefined && body.durationHours !== null) {
    hours = Number(body.durationHours);
    if (!Number.isFinite(hours) || !Number.isInteger(hours) || hours < 1 || hours > MAX_HOURS) {
      return { error: "That suspension length isn't allowed" };
    }
  }

  return { value: { suspended: body.suspended, reason: reason || undefined, hours } };
}

/** When a suspension of this many hours ends, or null for permanent. */
export function suspendedUntil(hours, now = new Date()) {
  return hours === null || hours === undefined ? null : new Date(now.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Whether a suspension still stands. A temporary one that has run out no
 * longer does, which is what lets it lift itself.
 */
export function suspensionActive(user, now = new Date()) {
  if (!user?.isSuspended) return false;
  if (!user.suspendedUntil) return true;
  return new Date(user.suspendedUntil) > now;
}

/**
 * Whether this account may be suspended, and why not when it may not.
 * Moderators and the official account are out of reach, and nobody suspends
 * themselves by accident.
 */
export function suspensionRefusal(target, actorId) {
  if (!target) return "User not found";
  if (String(target._id) === String(actorId)) return "You can't suspend your own account";
  if (target.isOfficial) return "The official Cinephix account can't be suspended";
  if (target.isAdmin) return "Moderators can't be suspended from the dashboard";
  return null;
}

/** The note written onto the reports a moderation action closes. */
export function resolutionNote(action, adminUsername, reason) {
  const who = adminUsername ? `@${adminUsername}` : "a moderator";
  const why = reason ? ` — ${reason}` : "";
  return action === "deleted" ? `Content removed by ${who}${why}` : `Account suspended by ${who}${why}`;
}
