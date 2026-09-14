// The entries of a user's watched list or watchlist, as the public profile's
// full-list sheet receives them.
//
// Ids only, plus the owner's rating on the watched list. The app fills in
// titles and posters from the content cache it shares with the viewer's own
// lists, so a title the viewer has already come across anywhere in the app
// costs nothing to show here.

const timeOf = (doc) => new Date(doc?.updatedAt ?? doc?.createdAt ?? 0).getTime();

/**
 * items    the stored subdocuments [{ itemId, itemType }], in stored order
 * ratings  the owner's ratings [{ contentId, value }] with contentId in either
 *          id form, or null to leave ratings out (the watchlist)
 */
export function buildCollectionEntries(items, ratings = null) {
  let ratingByTitle = null;
  if (ratings) {
    ratingByTitle = new Map();
    for (const rating of ratings) {
      if (typeof rating?.value !== "number") continue;
      const id = String(rating.contentId);
      const current = ratingByTitle.get(id);
      if (!current || timeOf(rating) >= timeOf(current)) ratingByTitle.set(id, rating);
    }
  }

  const seen = new Set();
  const entries = [];
  for (const item of items ?? []) {
    if (!item?.itemId || (item.itemType !== "movie" && item.itemType !== "series")) continue;
    const itemId = String(item.itemId);
    const key = `${item.itemType}:${itemId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = { itemId, itemType: item.itemType };
    if (ratingByTitle) entry.rating = ratingByTitle.get(itemId)?.value ?? null;
    entries.push(entry);
  }
  return entries;
}
