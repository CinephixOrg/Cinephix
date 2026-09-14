// Deciding which ratings (or reviews) survive when two catalogue documents are
// merged. Pure, so it can be tested without a database.
//
// A user may hold one rating per title, but in this data a title id appears
// both as a string and as an ObjectId, and the unique {user, contentId} index
// treats those as different values. So a user can already have two ratings on
// the document being merged away, one on the document being kept, or both.
// For each user, the most recent rating across both documents is kept and the
// rest are removed, which leaves exactly one, and it's the user's latest opinion.

const timeOf = (doc) => {
  const stamp = doc.updatedAt ?? doc.createdAt;
  if (stamp) return new Date(stamp).getTime();
  // Seeded documents have no timestamps; the ObjectId records when they were created.
  return parseInt(String(doc._id).slice(0, 8), 16) * 1000;
};

const newestFirst = (a, b) => timeOf(b.doc) - timeOf(a.doc) || (String(b.doc._id) > String(a.doc._id) ? 1 : -1);

/**
 * fromDocs: ratings on the document being merged away.
 * toDocs: the same users' ratings on the document being kept.
 * Returns { remove, move }: documents to delete, and `from` documents to
 * re-point at the kept document. Delete before moving.
 */
export function planRatingMerge(fromDocs, toDocs) {
  const byUser = new Map();
  const add = (doc, side) => {
    const user = String(doc.user);
    byUser.set(user, [...(byUser.get(user) ?? []), { doc, side }]);
  };
  for (const doc of fromDocs) add(doc, "from");
  for (const doc of toDocs) add(doc, "to");

  const remove = [];
  const move = [];
  for (const entries of byUser.values()) {
    // Users with nothing on the merged-away document have nothing to resolve.
    if (!entries.some((entry) => entry.side === "from")) continue;
    const [keeper, ...rest] = [...entries].sort(newestFirst);
    remove.push(...rest.map((entry) => entry.doc));
    if (keeper.side === "from") move.push(keeper.doc);
  }
  return { remove, move };
}
