import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_FILTERS,
  MATCH_TIER,
  activeFilterCount,
  buildIndex,
  matchTitle,
  normalizeText,
  queryCollection,
  reduceFilters,
  sortPriority,
  tokenize,
  withinOneEdit,
  type CollectionEntry,
  type CollectionFilters,
} from "./collectionQuery.ts";

let nextOrder = 0;
function entry(title: string, overrides: Partial<CollectionEntry> = {}): CollectionEntry {
  nextOrder += 1;
  return {
    id: `id-${nextOrder}`,
    type: "movie",
    title,
    posterPath: null,
    releaseDate: null,
    popularity: 0,
    rating: null,
    order: nextOrder,
    ...overrides,
  };
}

const titles = (entries: CollectionEntry[]) => entries.map((e) => e.title);
const score = (title: string, query: string) => {
  const [item] = buildIndex([entry(title)]);
  const q = normalizeText(query);
  return matchTitle(item, q, tokenize(q));
};
const withFilters = (...actions: Parameters<typeof reduceFilters>[1][]): CollectionFilters =>
  actions.reduce(reduceFilters, EMPTY_FILTERS);

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

test("normalization folds case and diacritics", () => {
  assert.equal(normalizeText("Amélie"), "amelie");
  assert.equal(normalizeText("AMÉLIE"), "amelie");
});

test("normalization turns punctuation into single word breaks", () => {
  assert.equal(normalizeText("Spider-Man: No Way Home"), "spider man no way home");
  assert.equal(normalizeText("  WALL·E!! "), "wall e");
  assert.equal(normalizeText("..."), "");
});

test("Turkish letters fold so an English keyboard can find them", () => {
  assert.equal(normalizeText("İstanbul"), "istanbul");
  assert.equal(normalizeText("Kış Uykusu"), "kis uykusu");
  assert.equal(score("Kış Uykusu", "kis uykusu")?.tier, MATCH_TIER.EXACT_TITLE);
  assert.equal(score("Kış Uykusu", "kış")?.tier, MATCH_TIER.TITLE_PREFIX);
});

test("caseless scripts stay searchable instead of being stripped", () => {
  assert.equal(normalizeText("千と千尋の神隠し"), "千と千尋の神隠し");
  assert.equal(normalizeText("الرسالة"), "الرسالة");
  assert.equal(normalizeText("기생충"), "기생충");
});

test("search keeps working on a runtime without String.prototype.normalize", () => {
  const original = String.prototype.normalize;
  try {
    // Simulates a Hermes build without Intl.
    (String.prototype as { normalize?: unknown }).normalize = undefined;
    assert.equal(normalizeText("The Dark Knight"), "the dark knight");
    assert.equal(normalizeText("Amélie"), "amélie");
    assert.equal(score("The Dark Knight", "dark")?.tier, MATCH_TIER.ALL_WORDS);
  } finally {
    String.prototype.normalize = original;
  }
});

// ---------------------------------------------------------------------------
// One-edit distance
// ---------------------------------------------------------------------------

test("one edit covers substitution, insertion, deletion and transposition", () => {
  assert.equal(withinOneEdit("matrix", "matrix"), true);
  assert.equal(withinOneEdit("matrix", "matrox"), true); // substitution
  assert.equal(withinOneEdit("matrix", "matrixx"), true); // insertion
  assert.equal(withinOneEdit("matrix", "matix"), true); // deletion
  assert.equal(withinOneEdit("matrix", "matirx"), true); // transposition
});

test("two edits are rejected", () => {
  assert.equal(withinOneEdit("matrix", "mtarxi"), false);
  assert.equal(withinOneEdit("matrix", "matr"), false);
  assert.equal(withinOneEdit("abc", "xyz"), false);
});

// ---------------------------------------------------------------------------
// Matching — mirrors the three clauses in backend/utils/atlasSearch.js
// ---------------------------------------------------------------------------

test("an exact title ranks in the top tier", () => {
  assert.equal(score("The Dark Knight", "the dark knight")?.tier, MATCH_TIER.EXACT_TITLE);
});

test("a title that starts with the query ranks just below exact", () => {
  assert.equal(score("The Dark Knight Rises", "the dark knight")?.tier, MATCH_TIER.TITLE_PREFIX);
});

test("every typed word matching, in any order, is the queryString clause", () => {
  assert.equal(score("The Dark Knight", "knight dark")?.tier, MATCH_TIER.ALL_WORDS);
  assert.equal(score("The Dark Knight", "kni da")?.tier, MATCH_TIER.ALL_WORDS);
});

test("one typed word prefixing a title word is the autocomplete clause", () => {
  assert.equal(score("The Dark Knight", "dark zzz")?.tier, MATCH_TIER.ANY_WORD_PREFIX);
});

test("a one-letter typo still matches through the fuzzy clause", () => {
  assert.equal(score("Interstellar", "interstelar")?.tier, MATCH_TIER.FUZZY);
  assert.equal(score("Interstellar", "interstellar")?.tier, MATCH_TIER.EXACT_TITLE);
});

test("fuzzy matching requires the first two characters to be exact", () => {
  assert.equal(score("Interstellar", "nterstellar"), null);
  assert.equal(score("Interstellar", "unterstellar"), null);
});

test("a single letter matches as a word prefix, like a trailing wildcard", () => {
  assert.equal(score("Dune", "d")?.tier, MATCH_TIER.TITLE_PREFIX);
  assert.equal(score("The Dark Knight", "k")?.tier, MATCH_TIER.ALL_WORDS);
});

test("unrelated text does not match", () => {
  assert.equal(score("Interstellar", "godfather"), null);
  assert.equal(score("Interstellar", ""), null);
});

test("accents and punctuation don't stop a match", () => {
  assert.equal(score("Amélie", "amelie")?.tier, MATCH_TIER.EXACT_TITLE);
  assert.equal(score("Spider-Man: No Way Home", "spiderman")?.tier ?? null, null);
  assert.equal(score("Spider-Man: No Way Home", "spider man")?.tier, MATCH_TIER.TITLE_PREFIX);
});

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

test("type filters toggle on and off independently", () => {
  let filters = reduceFilters(EMPTY_FILTERS, { kind: "type", value: "movie" });
  assert.deepEqual(filters.types, ["movie"]);
  filters = reduceFilters(filters, { kind: "type", value: "series" });
  assert.deepEqual(filters.types, ["movie", "series"]);
  filters = reduceFilters(filters, { kind: "type", value: "movie" });
  assert.deepEqual(filters.types, ["series"]);
});

test("rated and unrated are mutually exclusive, and tapping again clears", () => {
  let filters = reduceFilters(EMPTY_FILTERS, { kind: "rated", value: "rated" });
  assert.equal(filters.rated, "rated");
  filters = reduceFilters(filters, { kind: "rated", value: "unrated" });
  assert.equal(filters.rated, "unrated");
  filters = reduceFilters(filters, { kind: "rated", value: "unrated" });
  assert.equal(filters.rated, null);
});

test("A-Z and Z-A can never both be active", () => {
  const filters = withFilters(
    { kind: "sort", group: "alpha", direction: "asc" },
    { kind: "sort", group: "alpha", direction: "desc" }
  );
  assert.deepEqual(filters.sorts, [{ group: "alpha", direction: "desc" }]);
  assert.equal(sortPriority(filters, "alpha", "asc"), 0);
  assert.equal(sortPriority(filters, "alpha", "desc"), 1);
});

test("swapping a sort's direction keeps its priority", () => {
  const filters = withFilters(
    { kind: "sort", group: "alpha", direction: "asc" },
    { kind: "sort", group: "release", direction: "desc" },
    { kind: "sort", group: "alpha", direction: "desc" }
  );
  assert.deepEqual(filters.sorts, [
    { group: "alpha", direction: "desc" },
    { group: "release", direction: "desc" },
  ]);
});

test("different sort groups combine, in the order they were chosen", () => {
  const filters = withFilters(
    { kind: "type", value: "movie" },
    { kind: "sort", group: "alpha", direction: "asc" },
    { kind: "sort", group: "release", direction: "desc" }
  );
  assert.equal(sortPriority(filters, "alpha", "asc"), 1);
  assert.equal(sortPriority(filters, "release", "desc"), 2);
  assert.equal(activeFilterCount(filters), 3);
});

test("tapping an active sort turns it off and promotes the next one", () => {
  const filters = withFilters(
    { kind: "sort", group: "alpha", direction: "asc" },
    { kind: "sort", group: "release", direction: "desc" },
    { kind: "sort", group: "alpha", direction: "asc" }
  );
  assert.deepEqual(filters.sorts, [{ group: "release", direction: "desc" }]);
  assert.equal(sortPriority(filters, "release", "desc"), 1);
});

test("clear resets everything", () => {
  const filters = withFilters({ kind: "type", value: "series" }, { kind: "rated", value: "rated" }, { kind: "clear" });
  assert.deepEqual(filters, EMPTY_FILTERS);
  assert.equal(activeFilterCount(filters), 0);
});

test("reducing never mutates the previous state", () => {
  const before = withFilters({ kind: "sort", group: "alpha", direction: "asc" });
  const snapshot = JSON.stringify(before);
  reduceFilters(before, { kind: "sort", group: "alpha", direction: "desc" });
  reduceFilters(before, { kind: "type", value: "movie" });
  assert.equal(JSON.stringify(before), snapshot);
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

function library() {
  nextOrder = 0;
  return [
    entry("Dune", { releaseDate: "2021-10-22", rating: 9, popularity: 80 }),
    entry("Arrival", { releaseDate: "2016-11-11", rating: null, popularity: 40 }),
    entry("Severance", { type: "series", releaseDate: "2022-02-18", rating: 8, popularity: 60 }),
    entry("Dark", { type: "series", releaseDate: "2017-12-01", rating: null, popularity: 50 }),
    entry("The Dark Knight", { releaseDate: "2008-07-18", rating: 10, popularity: 90 }),
    entry("Undated Film", { releaseDate: null, rating: 6, popularity: 5 }),
  ];
}

test("with no query and no sort, the most recently added comes first", () => {
  const index = buildIndex(library());
  assert.deepEqual(titles(queryCollection(index, { query: "", filters: EMPTY_FILTERS })), [
    "Undated Film",
    "The Dark Knight",
    "Dark",
    "Severance",
    "Arrival",
    "Dune",
  ]);
});

test("a single type filter narrows the list; both types show everything", () => {
  const index = buildIndex(library());
  const series = queryCollection(index, { query: "", filters: withFilters({ kind: "type", value: "series" }) });
  assert.deepEqual(titles(series).sort(), ["Dark", "Severance"]);
  const both = queryCollection(index, {
    query: "",
    filters: withFilters({ kind: "type", value: "series" }, { kind: "type", value: "movie" }),
  });
  assert.equal(both.length, 6);
});

test("rated and unrated filters split the list exactly", () => {
  const index = buildIndex(library());
  const rated = queryCollection(index, { query: "", filters: withFilters({ kind: "rated", value: "rated" }) });
  const unrated = queryCollection(index, { query: "", filters: withFilters({ kind: "rated", value: "unrated" }) });
  assert.equal(rated.length + unrated.length, 6);
  assert.ok(rated.every((e) => e.rating !== null));
  assert.ok(unrated.every((e) => e.rating === null));
});

test("search only looks inside the filtered subset", () => {
  const index = buildIndex(library());
  const all = queryCollection(index, { query: "dark", filters: EMPTY_FILTERS });
  assert.deepEqual(titles(all).sort(), ["Dark", "The Dark Knight"]);
  const seriesOnly = queryCollection(index, { query: "dark", filters: withFilters({ kind: "type", value: "series" }) });
  assert.deepEqual(titles(seriesOnly), ["Dark"]);
});

test("search results are ordered by relevance when no sort is chosen", () => {
  const index = buildIndex(library());
  // "Dark" is an exact title; "The Dark Knight" only contains the word.
  assert.deepEqual(titles(queryCollection(index, { query: "dark", filters: EMPTY_FILTERS })), ["Dark", "The Dark Knight"]);
});

test("popularity only breaks ties between equally relevant matches", () => {
  nextOrder = 0;
  const index = buildIndex([
    entry("Dark City", { popularity: 5 }),
    entry("Dark Waters", { popularity: 70 }),
    entry("Dark", { popularity: 1 }),
  ]);
  // The exact title wins despite the lowest popularity; the two prefix
  // matches are then ordered by popularity.
  assert.deepEqual(titles(queryCollection(index, { query: "dark", filters: EMPTY_FILTERS })), [
    "Dark",
    "Dark Waters",
    "Dark City",
  ]);
});

test("a chosen sort overrides relevance but still respects the search", () => {
  const index = buildIndex(library());
  const result = queryCollection(index, {
    query: "dark",
    filters: withFilters({ kind: "sort", group: "release", direction: "asc" }),
  });
  assert.deepEqual(titles(result), ["The Dark Knight", "Dark"]);
});

test("alphabetical sorting works in both directions", () => {
  const index = buildIndex(library());
  const az = titles(queryCollection(index, { query: "", filters: withFilters({ kind: "sort", group: "alpha", direction: "asc" }) }));
  assert.deepEqual(az, ["Arrival", "Dark", "Dune", "Severance", "The Dark Knight", "Undated Film"]);
  const za = titles(queryCollection(index, { query: "", filters: withFilters({ kind: "sort", group: "alpha", direction: "desc" }) }));
  assert.deepEqual(za, [...az].reverse());
});

test("undated titles sort last whichever release direction is chosen", () => {
  const index = buildIndex(library());
  for (const direction of ["asc", "desc"] as const) {
    const result = queryCollection(index, { query: "", filters: withFilters({ kind: "sort", group: "release", direction }) });
    assert.equal(result[result.length - 1].title, "Undated Film", `release ${direction}`);
  }
  const newest = queryCollection(index, { query: "", filters: withFilters({ kind: "sort", group: "release", direction: "desc" }) });
  assert.equal(newest[0].title, "Severance");
});

test("unrated titles sort last whichever rating direction is chosen", () => {
  const index = buildIndex(library());
  const highest = queryCollection(index, { query: "", filters: withFilters({ kind: "sort", group: "rating", direction: "desc" }) });
  assert.deepEqual(titles(highest).slice(0, 4), ["The Dark Knight", "Dune", "Severance", "Undated Film"]);
  const lowest = queryCollection(index, { query: "", filters: withFilters({ kind: "sort", group: "rating", direction: "asc" }) });
  assert.deepEqual(titles(lowest).slice(0, 4), ["Undated Film", "Severance", "Dune", "The Dark Knight"]);
  assert.ok(lowest.slice(4).every((e) => e.rating === null));
});

test("a second sort only breaks ties left by the first", () => {
  nextOrder = 0;
  const index = buildIndex([
    entry("Twin", { releaseDate: "1990-01-01" }),
    entry("Twin", { releaseDate: "2020-01-01" }),
    entry("Alpha", { releaseDate: "2000-01-01" }),
  ]);
  const result = queryCollection(index, {
    query: "",
    filters: withFilters(
      { kind: "sort", group: "alpha", direction: "asc" },
      { kind: "sort", group: "release", direction: "desc" }
    ),
  });
  assert.deepEqual(result.map((e) => `${e.title} ${e.releaseDate}`), [
    "Alpha 2000-01-01",
    "Twin 2020-01-01",
    "Twin 1990-01-01",
  ]);
});

test("filters, search and sorts all apply together", () => {
  const index = buildIndex(library());
  const result = queryCollection(index, {
    query: "d",
    filters: withFilters(
      { kind: "type", value: "movie" },
      { kind: "rated", value: "rated" },
      { kind: "sort", group: "alpha", direction: "asc" }
    ),
  });
  // Movies, rated, with a word starting with "d": Dune and The Dark Knight.
  assert.deepEqual(titles(result), ["Dune", "The Dark Knight"]);
});

test("a whitespace-only query behaves like no query", () => {
  const index = buildIndex(library());
  assert.equal(queryCollection(index, { query: "   ", filters: EMPTY_FILTERS }).length, 6);
});

test("querying never mutates the index or the entries", () => {
  const index = buildIndex(library());
  const snapshot = JSON.stringify(index);
  queryCollection(index, { query: "dark", filters: withFilters({ kind: "sort", group: "rating", direction: "desc" }) });
  queryCollection(index, { query: "", filters: withFilters({ kind: "sort", group: "alpha", direction: "desc" }) });
  assert.equal(JSON.stringify(index), snapshot);
});

// ---------------------------------------------------------------------------
// Speed
//
// Loose ceilings — several times the measured cost — so this catches an
// algorithmic regression rather than failing on a busy machine.
// ---------------------------------------------------------------------------

function bigLibrary(size: number) {
  nextOrder = 0;
  const words = ["dark", "night", "star", "love", "war", "city", "blue", "house", "last", "river", "ghost", "king"];
  return Array.from({ length: size }, (_, i) =>
    entry(`${words[i % words.length]} ${words[(i * 7) % words.length]} ${i}`, {
      type: i % 3 === 0 ? "series" : "movie",
      releaseDate: `${1950 + (i % 75)}-06-15`,
      rating: i % 4 === 0 ? null : (i % 10) + 1,
      popularity: (i * 37) % 1000,
    })
  );
}

test("indexing 5,000 titles takes well under 200ms", () => {
  const entries = bigLibrary(5000);
  const start = performance.now();
  buildIndex(entries);
  const ms = performance.now() - start;
  assert.ok(ms < 200, `index took ${ms.toFixed(1)}ms`);
});

test("typing a 12-character query over 5,000 titles stays under a frame per keystroke", () => {
  const index = buildIndex(bigLibrary(5000));
  const query = "ghost king 1";
  // Warm up so JIT compilation isn't billed to the first keystroke.
  queryCollection(index, { query: "gh", filters: EMPTY_FILTERS });
  const start = performance.now();
  for (let i = 1; i <= query.length; i++) {
    queryCollection(index, { query: query.slice(0, i), filters: EMPTY_FILTERS });
  }
  const perKeystroke = (performance.now() - start) / query.length;
  assert.ok(perKeystroke < 16, `${perKeystroke.toFixed(2)}ms per keystroke`);
});

test("filtering and multi-sorting 5,000 titles takes well under 100ms", () => {
  const index = buildIndex(bigLibrary(5000));
  const filters = withFilters(
    { kind: "type", value: "movie" },
    { kind: "sort", group: "rating", direction: "desc" },
    { kind: "sort", group: "alpha", direction: "asc" }
  );
  const start = performance.now();
  const result = queryCollection(index, { query: "", filters });
  const ms = performance.now() - start;
  assert.ok(result.length > 0);
  assert.ok(ms < 100, `filter+sort took ${ms.toFixed(1)}ms`);
});
