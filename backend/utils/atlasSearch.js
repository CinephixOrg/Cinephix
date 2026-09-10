/**
 * Atlas Search helpers
 *
 * buildFuzzyTitleSearchStage was copy-pasted near-verbatim 4 times
 * (movieRoute.js's two routes, seriesRoute.js's two routes) — a real DRY
 * violation found during a search-quality audit: any future tweak to how
 * title search actually works (relevance weighting, fuzzy tolerance, etc.)
 * had to be applied by hand in all 4 places, with a real risk of them
 * silently drifting apart. Extracted here as the single source of truth.
 */

/**
 * Builds the `{ $search: {...} }` aggregation stage used for fuzzy/
 * autocomplete title search against a single text field ("title" for
 * movies, "name" for series). `compound.should` with no `must`/`filter`
 * requires at least one should clause to match by Atlas Search's own
 * default (`minimumShouldMatch` implicitly becomes 1 in that case) — this
 * isn't an unbounded "match everything, just rank it" query.
 */
export function buildFuzzyTitleSearchStage(query, path) {
  const safeQuery = query.replace(/[^\w\s]/gi, "");
  const tokens = safeQuery.split(/\s+/).filter((w) => w);
  const queryStr = tokens.length > 0 ? tokens.map((w) => `${w}*`).join(" AND ") : "";

  const should = [
    { autocomplete: { query, path } },
    { text: { query, path, fuzzy: { maxEdits: 1, prefixLength: 2 } } },
  ];

  if (queryStr) {
    should.push({ queryString: { defaultPath: path, query: queryStr } });
  }

  return { $search: { index: "default", compound: { should } } };
}

/**
 * The `{ $addFields: {combinedScore} }` + `{ $sort }` pair every title
 * search follows its own `buildFuzzyTitleSearchStage` with — search
 * relevance weighted by real-world popularity, not relevance alone, so an
 * obscure exact-title match doesn't outrank a well-known near-match.
 */
export function combinedScoreSortStages() {
  return [
    {
      $addFields: {
        combinedScore: {
          $multiply: [{ $meta: "searchScore" }, { $add: [{ $ifNull: ["$popularity", 1] }, 1] }],
        },
      },
    },
    { $sort: { combinedScore: -1 } },
  ];
}
