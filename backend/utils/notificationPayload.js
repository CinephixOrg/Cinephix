// The type-specific part of a notification, built in one place.
//
// Each type keeps its data in its own small subdocument (`message`, `share`)
// rather than loose top-level fields, so a notification carries everything
// needed to show it — and later to deliver it as a native push notification —
// without loading the conversation or share it points at.
//
// Pure, so it's unit-tested (notificationPayload.test.js).

export const MESSAGE_PREVIEW_LENGTH = 120;

/**
 * A message as a notification-sized snippet: whitespace collapsed, and cut at
 * a character boundary rather than a UTF-16 unit, so an emoji is never split
 * in half.
 */
export function messagePreview(message) {
  const kind = message?.type || "text";
  const text = typeof message?.text === "string" ? message.text.replace(/\s+/g, " ").trim() : "";
  const chars = Array.from(text);
  const preview =
    chars.length > MESSAGE_PREVIEW_LENGTH ? `${chars.slice(0, MESSAGE_PREVIEW_LENGTH - 1).join("").trimEnd()}…` : text;
  return { preview, kind };
}

/**
 * Who liked a share, as its author sees it: how many people liked it (the
 * author's own like doesn't count) and who liked it most recently. `likes`
 * is in the order the likes happened.
 */
export function shareLikeSummary(share) {
  const authorId = String(share?.user?._id ?? share?.user);
  const likers = (share?.likes || []).map(String).filter((id) => id !== authorId);
  return { likerCount: likers.length, latestLikerId: likers.length > 0 ? likers[likers.length - 1] : null };
}
