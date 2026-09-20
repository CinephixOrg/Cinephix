// What a moderator is allowed to remove or suspend, and how it reads back.
// Pure, so it's tested without a database (moderationActions.test.js).

import mongoose from "mongoose";

/** The kinds of content a moderator can delete, as the dashboard names them. */
export const DELETABLE_TYPES = ["review", "share", "list", "message"];

/** The report entity type each one corresponds to (models/Report.js). */
export const ENTITY_TYPE_OF = { review: "Review", share: "Share", list: "List", message: "Message" };

export const MAX_REASON = 500;

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
  return { value: { suspended: body.suspended, reason: reason || undefined } };
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
