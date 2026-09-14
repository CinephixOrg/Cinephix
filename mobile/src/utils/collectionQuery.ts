// Query engine shared by the Watched List and the Watchlist: search, filter
// and sort over a list that is already in memory.
//
// Pure and dependency-free on purpose. Nothing here touches React, the
// network or i18n, which is what lets the whole engine run under
// `node --test` (see collectionQuery.test.mts) and lets the screen treat a query
// as a cheap, synchronous function call it can repeat on every keystroke.
//
// Search mirrors the main Search page's matching rules
// (backend/utils/atlasSearch.js), which accepts a title when ANY of three
// clauses hits:
//   1. autocomplete  — a typed word is the start of a word in the title
//   2. fuzzy text    — a typed word is within one edit of a title word, with
//                      the first two characters required to match exactly
//                      (maxEdits: 1, prefixLength: 2)
//   3. queryString   — every typed word is the start of some title word
// Ranking keeps that search's "relevance, then popularity" order, with one
// deliberate difference explained on compareRelevance below.

export type ContentKind = "movie" | "series";

export interface CollectionEntry {
  id: string;
  type: ContentKind;
  title: string;
  posterPath: string | null;
  /** ISO date (YYYY-MM-DD) as the catalogue stores it, or null. */
  releaseDate: string | null;
  /** TMDB popularity; 0 when unknown. */
  popularity: number;
  /** The user's own 1-10 rating, or null when unrated. */
  rating: number | null;
  /** Position in the server's list. Higher means added more recently. */
  order: number;
}

/** A title's identity across lists: the same key for the same title on anyone's list. */
export const collectionKey = (entry: { id: string; type: ContentKind }) => `${entry.type}:${entry.id}`;

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export type SortGroup = "alpha" | "release" | "rating";
export type SortDirection = "asc" | "desc";
export type RatedFilter = "rated" | "unrated";

export interface SortRule {
  group: SortGroup;
  direction: SortDirection;
}

export interface CollectionFilters {
  /** Empty, or both kinds, means every type is shown. */
  types: ContentKind[];
  rated: RatedFilter | null;
  /**
   * Active sorts in priority order, at most one per group. Selecting A-Z
   * and "Newest first" together is allowed — the first-chosen rule orders
   * the list and later ones only break its ties.
   */
  sorts: SortRule[];
}

export const EMPTY_FILTERS: CollectionFilters = { types: [], rated: null, sorts: [] };

export type FilterAction =
  | { kind: "type"; value: ContentKind }
  | { kind: "rated"; value: RatedFilter }
  | { kind: "sort"; group: SortGroup; direction: SortDirection }
  | { kind: "clear" };

/**
 * Applies one tap in the filter sheet.
 *
 * Contradictory options live in the same group and replace each other:
 * picking Z-A while A-Z is active swaps the direction in place (keeping its
 * priority), and tapping the active option again turns it off. Options in
 * different groups combine freely.
 */
export function reduceFilters(state: CollectionFilters, action: FilterAction): CollectionFilters {
  switch (action.kind) {
    case "type": {
      const has = state.types.includes(action.value);
      const types = has ? state.types.filter((t) => t !== action.value) : [...state.types, action.value];
      return { ...state, types };
    }
    case "rated":
      return { ...state, rated: state.rated === action.value ? null : action.value };
    case "sort": {
      const index = state.sorts.findIndex((rule) => rule.group === action.group);
      if (index === -1) {
        return { ...state, sorts: [...state.sorts, { group: action.group, direction: action.direction }] };
      }
      if (state.sorts[index].direction === action.direction) {
        return { ...state, sorts: state.sorts.filter((_, i) => i !== index) };
      }
      const sorts = state.sorts.slice();
      sorts[index] = { group: action.group, direction: action.direction };
      return { ...state, sorts };
    }
    case "clear":
      return EMPTY_FILTERS;
  }
}

export function activeFilterCount(filters: CollectionFilters): number {
  return filters.types.length + (filters.rated ? 1 : 0) + filters.sorts.length;
}

/** 1-based priority of a sort rule, or 0 when that exact rule isn't active. */
export function sortPriority(filters: CollectionFilters, group: SortGroup, direction: SortDirection): number {
  const index = filters.sorts.findIndex((rule) => rule.group === group && rule.direction === direction);
  return index + 1;
}

// ---------------------------------------------------------------------------
// Text normalization
// ---------------------------------------------------------------------------

const COMBINING_MARKS = /[\u0300-\u036f]/g;

// Word boundaries are found by listing separators rather than word
// characters. A "\p{L}\p{N}" regex would be simpler, but Unicode property
// escapes are not guaranteed on every Hermes build, and a regex that fails to
// parse takes the whole screen down at import time. Treating everything
// outside these punctuation/symbol ranges as a word character also keeps
// caseless scripts (Arabic, Hebrew, CJK, Hangul, Thai) searchable.
function isSeparator(code: number): boolean {
  if (code < 128) {
    const isDigit = code >= 48 && code <= 57;
    const isUpper = code >= 65 && code <= 90;
    const isLower = code >= 97 && code <= 122;
    return !(isDigit || isUpper || isLower);
  }
  return (
    (code >= 0x00a0 && code <= 0x00bf) || // Latin-1 punctuation and symbols
    code === 0x00d7 || code === 0x00f7 || // multiplication / division signs
    (code >= 0x2000 && code <= 0x206f) || // general punctuation
    (code >= 0x2e00 && code <= 0x2e7f) || // supplemental punctuation
    (code >= 0x3000 && code <= 0x303f) || // CJK punctuation
    (code >= 0xff00 && code <= 0xff0f) || // fullwidth punctuation
    (code >= 0xff1a && code <= 0xff20)
  );
}

// NFD splits accents off their letters so they can be dropped; NFC then
// rebuilds everything that wasn't an accent. Without the second step, Hangul
// syllables would stay decomposed into separate jamo.
//
// String.prototype.normalize only exists on Hermes builds that ship Intl.
// Where it's missing, accents simply stay attached: search still finds exact
// spellings and just stops treating "é" as "e", instead of throwing on every
// keystroke and taking the screen down with it.
function foldDiacritics(text: string): string {
  if (typeof text.normalize !== "function") return text;
  return text.normalize("NFD").replace(COMBINING_MARKS, "").normalize("NFC");
}

/**
 * Lowercases, strips diacritics and turns punctuation into single spaces,
 * so "Amélie", "amelie" and "AMELIE!" all compare equal and "Spider-Man"
 * splits into two words.
 */
export function normalizeText(text: string): string {
  const folded = foldDiacritics(text)
    .toLowerCase()
    // Turkish dotless i (U+0131) has no accent to strip, so it's folded
    // explicitly; otherwise typing "kis" on an English keyboard could never
    // find a title spelled with it.
    .replace(/\u0131/g, "i");
  let out = "";
  let pendingSpace = false;
  for (let i = 0; i < folded.length; i++) {
    const code = folded.charCodeAt(i);
    if (isSeparator(code)) {
      pendingSpace = out.length > 0;
      continue;
    }
    if (pendingSpace) {
      out += " ";
      pendingSpace = false;
    }
    out += folded[i];
  }
  return out;
}

export function tokenize(normalized: string): string[] {
  return normalized.length === 0 ? [] : normalized.split(" ");
}

// ---------------------------------------------------------------------------
// Fuzzy matching
// ---------------------------------------------------------------------------

/**
 * True when `a` and `b` differ by at most one insertion, deletion,
 * substitution or adjacent transposition (Damerau-Levenshtein <= 1).
 * Linear time with an early exit, rather than building a distance matrix
 * for a question that only ever needs "is it one edit or not".
 */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;

  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;

  if (la === lb) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true; // substitution
    return i + 1 < la && a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

// The backend's fuzzy clause uses prefixLength: 2 — the first two characters
// must match exactly before any edit is allowed.
const FUZZY_PREFIX_LENGTH = 2;
// Atlas autocomplete indexes edge grams of at least two characters, so a
// single typed letter can't match through that clause on its own.
const AUTOCOMPLETE_MIN_GRAM = 2;

function fuzzyTermMatch(queryToken: string, titleToken: string): boolean {
  if (queryToken.slice(0, FUZZY_PREFIX_LENGTH) !== titleToken.slice(0, FUZZY_PREFIX_LENGTH)) return false;
  return withinOneEdit(queryToken, titleToken);
}

// ---------------------------------------------------------------------------
// Index and search
// ---------------------------------------------------------------------------

export interface IndexedEntry {
  entry: CollectionEntry;
  norm: string;
  tokens: string[];
  releaseTime: number | null;
}

/**
 * Precomputes everything a query needs per title, once per list change
 * instead of once per keystroke.
 */
export function buildIndex(entries: CollectionEntry[]): IndexedEntry[] {
  return entries.map((entry) => {
    const norm = normalizeText(entry.title);
    const time = entry.releaseDate ? Date.parse(entry.releaseDate) : NaN;
    return { entry, norm, tokens: tokenize(norm), releaseTime: Number.isNaN(time) ? null : time };
  });
}

export const MATCH_TIER = {
  EXACT_TITLE: 5,
  TITLE_PREFIX: 4,
  ALL_WORDS: 3,
  ANY_WORD_PREFIX: 2,
  FUZZY: 1,
} as const;

export interface MatchScore {
  tier: number;
  /** How many typed words matched something in the title. */
  matched: number;
  /** How many typed words equal a whole title word. */
  exact: number;
}

/** Scores one title against a normalized query, or returns null for no match. */
export function matchTitle(item: Pick<IndexedEntry, "norm" | "tokens">, queryNorm: string, queryTokens: string[]): MatchScore | null {
  if (queryTokens.length === 0) return null;

  let allPrefix = true;
  let anyPrefix = false;
  let anyFuzzy = false;
  let matched = 0;
  let exact = 0;

  for (const q of queryTokens) {
    let prefixHit = false;
    let exactHit = false;
    let fuzzyHit = false;
    for (const t of item.tokens) {
      if (t === q) {
        exactHit = true;
        prefixHit = true;
        break;
      }
      if (t.startsWith(q)) prefixHit = true;
      else if (!fuzzyHit && fuzzyTermMatch(q, t)) fuzzyHit = true;
    }
    if (prefixHit) {
      if (q.length >= AUTOCOMPLETE_MIN_GRAM) anyPrefix = true;
    } else {
      allPrefix = false;
    }
    if (fuzzyHit || exactHit) anyFuzzy = true;
    if (prefixHit || fuzzyHit) matched++;
    if (exactHit) exact++;
  }

  let tier: number;
  if (item.norm === queryNorm) tier = MATCH_TIER.EXACT_TITLE;
  else if (item.norm.startsWith(queryNorm)) tier = MATCH_TIER.TITLE_PREFIX;
  else if (allPrefix) tier = MATCH_TIER.ALL_WORDS;
  else if (anyPrefix) tier = MATCH_TIER.ANY_WORD_PREFIX;
  else if (anyFuzzy) tier = MATCH_TIER.FUZZY;
  else return null;

  return { tier, matched, exact };
}

// ---------------------------------------------------------------------------
// Searching by name (the Lists page)
// ---------------------------------------------------------------------------

export interface NamedIndexEntry<T> {
  item: T;
  norm: string;
  tokens: string[];
  /** The item's place in the list it was indexed from. */
  position: number;
}

/** Precomputes a name search, once per list change rather than once per keystroke. */
export function buildNamedIndex<T>(items: readonly T[], nameOf: (item: T) => string): NamedIndexEntry<T>[] {
  return items.map((item, position) => {
    const norm = normalizeText(nameOf(item));
    return { item, norm, tokens: tokenize(norm), position };
  });
}

/**
 * The items whose name matches, with the same matching as a title search
 * (accents and case folded, word prefixes, one typo), best match first and
 * equally good matches in their own order. An empty search is every item, in
 * order.
 */
export function searchNamed<T>(index: readonly NamedIndexEntry<T>[], query: string): T[] {
  const queryNorm = normalizeText(query);
  if (queryNorm.length === 0) return index.map((entry) => entry.item);
  const queryTokens = tokenize(queryNorm);
  const hits: { entry: NamedIndexEntry<T>; score: MatchScore }[] = [];
  for (const entry of index) {
    const score = matchTitle(entry, queryNorm, queryTokens);
    if (score) hits.push({ entry, score });
  }
  hits.sort(
    (a, b) =>
      b.score.tier - a.score.tier ||
      b.score.matched - a.score.matched ||
      b.score.exact - a.score.exact ||
      a.entry.position - b.entry.position
  );
  return hits.map((hit) => hit.entry.item);
}

// Relevance first, popularity only to break ties within it.
//
// The main search multiplies its relevance score by (popularity + 1). On a
// catalogue of hundreds of thousands of titles that keeps obscure junk below
// well-known films; on a list of titles the user has personally watched, the
// same multiplication would let a popular film matching one of your two words
// outrank the exact title you typed. So the order is the same — relevance,
// then popularity — without letting popularity override relevance.
function compareRelevance(
  a: { item: IndexedEntry; score: MatchScore },
  b: { item: IndexedEntry; score: MatchScore }
): number {
  return (
    b.score.tier - a.score.tier ||
    b.score.matched - a.score.matched ||
    b.score.exact - a.score.exact ||
    b.item.entry.popularity - a.item.entry.popularity ||
    b.item.entry.order - a.item.entry.order
  );
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

function compareByRule(a: IndexedEntry, b: IndexedEntry, rule: SortRule): number {
  const dir = rule.direction === "asc" ? 1 : -1;
  switch (rule.group) {
    case "alpha":
      if (a.norm === b.norm) return 0;
      return (a.norm < b.norm ? -1 : 1) * dir;
    case "release": {
      // Undated titles always go last, in either direction — they are not
      // "older than everything" or "newer than everything".
      if (a.releaseTime === b.releaseTime) return 0;
      if (a.releaseTime === null) return 1;
      if (b.releaseTime === null) return -1;
      return (a.releaseTime - b.releaseTime) * dir;
    }
    case "rating": {
      // Same rule for unrated titles.
      const ra = a.entry.rating;
      const rb = b.entry.rating;
      if (ra === rb) return 0;
      if (ra === null) return 1;
      if (rb === null) return -1;
      return (ra - rb) * dir;
    }
  }
}

// ---------------------------------------------------------------------------
// The query
// ---------------------------------------------------------------------------

export interface CollectionQuery {
  query: string;
  filters: CollectionFilters;
}

/**
 * Runs one query: filter, then search inside what the filters left, then
 * order.
 *
 * Search is applied after filtering on purpose — with "Movies" active, a
 * search only ever looks at movies. Ordering is the user's chosen sorts when
 * there are any, relevance while searching without one, and most recently
 * added first otherwise.
 */
export function queryCollection(index: IndexedEntry[], { query, filters }: CollectionQuery): CollectionEntry[] {
  const typeFilter = filters.types.length === 1 ? filters.types[0] : null;
  const rated = filters.rated;

  const subset: IndexedEntry[] = [];
  for (const item of index) {
    if (typeFilter && item.entry.type !== typeFilter) continue;
    if (rated === "rated" && item.entry.rating === null) continue;
    if (rated === "unrated" && item.entry.rating !== null) continue;
    subset.push(item);
  }

  const queryNorm = normalizeText(query);
  const sorts = filters.sorts;

  if (queryNorm.length === 0) {
    const ordered = subset.slice();
    ordered.sort((a, b) => {
      for (const rule of sorts) {
        const result = compareByRule(a, b, rule);
        if (result !== 0) return result;
      }
      return b.entry.order - a.entry.order;
    });
    return ordered.map((item) => item.entry);
  }

  const queryTokens = tokenize(queryNorm);
  const hits: { item: IndexedEntry; score: MatchScore }[] = [];
  for (const item of subset) {
    const score = matchTitle(item, queryNorm, queryTokens);
    if (score) hits.push({ item, score });
  }

  hits.sort((a, b) => {
    for (const rule of sorts) {
      const result = compareByRule(a.item, b.item, rule);
      if (result !== 0) return result;
    }
    return compareRelevance(a, b);
  });
  return hits.map((hit) => hit.item.entry);
}
