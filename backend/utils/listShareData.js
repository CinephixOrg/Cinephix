// The list snapshot a "check out this list" chat message stores, from what
// the sender's app sent. Shared by DM and community sends so both store the
// same shape.
//
// Denormalized on purpose: the card must still render if the list is later
// renamed, emptied or deleted. The newer fields (description, owner) are
// optional, so an older app's share — without them — still stores cleanly,
// and every string is bounded so a message can't carry an essay.

const clip = (value, max) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined);

export function listShareData(input = {}) {
  const itemCount = Number.isFinite(input.itemCount) ? Math.max(0, Math.floor(input.itemCount)) : 0;
  const previewPosters = Array.isArray(input.previewPosters)
    ? input.previewPosters.filter((p) => typeof p === "string" && p).slice(0, 3)
    : [];
  return {
    listId: input.listId,
    name: clip(input.name, 120) ?? "",
    itemCount,
    previewPosters,
    description: clip(input.description, 200),
    ownerUsername: clip(input.ownerUsername, 60),
  };
}
