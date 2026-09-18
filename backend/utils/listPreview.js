import mongoose from "mongoose";


// Attaches previewItems (title+poster for the first N items of each list,
// bulk-hydrated the same way feedController.js/reviewController.js resolve
// content) and likeCount — used by /discover, /popular, and /for-content,
// which return otherwise-differently-sourced list arrays in the same
// enriched shape. Exported for shareController.js's "list"-type
// createShare, which needs the exact same denormalized snapshot shape.
// `limit` defaults to 5, but /discover, /popular, and /for-content all now
// pass 20 explicitly — DiscoverListCard.tsx's own poster preview switched
// from a small fixed-count cascade to a scrollable "film strip" (same
// technique as Media's own list-post box, see shareController.js's
// createShare), so a fixed 5-item cap now silently truncated real content
// and made a strip with nothing to scroll past on lists that had more.
// /me stays at the bare default (5) — that route backs list *management*,
// not the film-strip card.
// Was two separate `.find()`s (movies, series) — folded into one aggregation
// seeded from the distinct item refs across every list's own preview slice
// via Mongo's `$documents` stage, joined against both `movies`/`series` by
// id (plain equality $lookup, not correlated — see activityController.js's
// getNetworkActivity for why that distinction matters at volume) and
// picking whichever matched. `$documents` needs a database-level
// {aggregate:1} command, which Model.aggregate() can't issue (always
// collection-scoped), hence the raw driver's db.aggregate() rather than a
// Model call. `CustomList.items[].itemId` is already schema-typed
// ObjectId (unlike Review/Rating's String `contentId`), so no $convert
// step is needed here — it matches `movies`/`series` `_id` directly.
export async function hydratePreviewItems(lists, limit = 5) {
  const previewSlices = lists.map((l) => l.items.slice(0, limit));
  const allItems = [];
  for (const slice of previewSlices) {
    for (const item of slice) allItems.push({ itemId: item.itemId, itemType: item.itemType });
  }
  const uniqueItems = [...new Map(allItems.map((it) => [`${it.itemType}:${it.itemId.toString()}`, it])).values()];

  const hydrated = uniqueItems.length
    ? await mongoose.connection.db
        .aggregate([
          { $documents: uniqueItems.map((it) => ({ itemId: it.itemId, itemType: it.itemType })) },
          {
            $lookup: {
              from: "movies",
              localField: "itemId",
              foreignField: "_id",
              pipeline: [{ $project: { title: 1, name: 1, poster_path: 1, release_date: 1, popularity: 1 } }],
              as: "_movieMatch",
            },
          },
          {
            $lookup: {
              from: "series",
              localField: "itemId",
              foreignField: "_id",
              pipeline: [{ $project: { title: 1, name: 1, poster_path: 1, first_air_date: 1, popularity: 1 } }],
              as: "_seriesMatch",
            },
          },
          {
            $addFields: {
              _item: { $cond: [{ $eq: ["$itemType", "movie"] }, { $arrayElemAt: ["$_movieMatch", 0] }, { $arrayElemAt: ["$_seriesMatch", 0] }] },
            },
          },
          { $match: { _item: { $ne: null } } },
          { $project: { _id: 0, itemId: 1, itemType: 1, item: "$_item" } },
        ])
        .toArray()
    : [];

  const itemMap = Object.fromEntries(hydrated.map((h) => [`${h.itemType}:${h.itemId.toString()}`, h.item]));

  return lists.map((l, i) => ({
    ...l,
    likeCount: (l.likes || []).length,
    previewItems: previewSlices[i]
      .map((item) => {
        const doc = itemMap[`${item.itemType}:${item.itemId.toString()}`];
        if (!doc) return null;
        return {
          itemId: item.itemId.toString(),
          itemType: item.itemType,
          title: doc.title || doc.name,
          poster_path: doc.poster_path,
          // Added for ListDetailScreen.tsx's own CollectionEntry mapping
          // (Release-date sort, and popularity as a search tie-break) —
          // /discover, /popular, /for-content ignore these two, unused but
          // harmless in their own response shape.
          release_date: doc.release_date || doc.first_air_date || null,
          popularity: typeof doc.popularity === "number" ? doc.popularity : 0,
        };
      })
      .filter(Boolean),
  }));
}
