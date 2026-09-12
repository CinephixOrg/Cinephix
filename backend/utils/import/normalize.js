// Normalization layer.
//
// Stage 2 of the pipeline: Upload -> **Normalize** -> Match -> Save.
//
// Every source, whatever its file format, is reduced here to one shape so
// that matching and saving are written once instead of once per platform.
// Nothing in this file touches the database, the network, or the filesystem,
// which is what lets the whole stage be tested directly.
//
// The normalized item:
//   {
//     type:      "movie" | "series"
//     title:     string            display title, trimmed
//     fold:      string            punctuation/diacritic-free match key
//     year:      number | null
//     ids:       { tmdb, imdb, tvdb, mal, anilist, kitsu, trakt, simkl }
//     watched:   boolean
//     watchlist: boolean
//     favorite:  boolean
//     rating:    number | null     always 1-10, integer
//     watchedAt: Date | null
//     episodes:  number            watched episode count (series only)
//   }

// Titles are matched on a folded form so that "WALL·E", "Wall-E" and "wall e"
// all collide. Diacritics are stripped via NFD so "Amélie" matches "Amelie".
// Unicode punctuation and symbols, rather than a hand-written list: the
// hand-written one missed U+00B7 (WALL·E) and would have kept missing
// whatever the next export used.
const PUNCT = /[\p{P}\p{S}]/gu;
const COMBINING = /[̀-ͯ]/g;

export function foldTitle(value) {
  if (!value) return "";
  return String(value)
    .normalize("NFD")
    .replace(COMBINING, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(PUNCT, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// A leading article changes nothing about which film is meant but breaks
// exact-match lookups between sources that disagree ("The Thing" vs
// "Thing, The" — the latter is how Kodi and some Plex exports store it).
export function foldTitleLoose(value) {
  const folded = foldTitle(value);
  if (!folded) return "";
  // foldTitle has already removed the comma, so "Thing, The" arrives as
  // "thing the" — move a trailing article back to the front, then strip it.
  const swapped = folded.replace(/^(.+)\s+(the|a|an)$/, "$2 $1");
  return swapped.replace(/^(the|a|an)\s+/, "");
}

export function parseYear(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 1870 && value <= 2200 ? Math.trunc(value) : null;
  }
  // Matches a bare year, a leading ISO date, and a parenthesised "(1999)".
  const match = String(value).match(/(\d{4})/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  return year >= 1870 && year <= 2200 ? year : null;
}

export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Ratings arrive on 5-star (Letterboxd), 10-point (IMDb, Trakt, MAL, Simkl)
// and 100-point (AniList) scales, and AniList alone can be configured to any
// of them. Everything is stored 1-10.
export function normalizeRating(value, scale = 10) {
  if (value === null || value === undefined || value === "") return null;
  const raw = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const scaled = scale === 10 ? raw : (raw / scale) * 10;
  const rounded = Math.round(scaled);
  return Math.max(1, Math.min(10, rounded));
}

// When a source doesn't declare its scale (AniList's user-configurable
// scoring, generic CSVs), infer it from the largest value present. A library
// whose top score is 4.5 is a 5-star scale; one topping out at 87 is /100.
export function inferScale(values) {
  let max = 0;
  let fractional = false;
  for (const value of values) {
    const raw = typeof value === "number" ? value : parseFloat(value);
    if (!Number.isFinite(raw)) continue;
    if (raw > max) max = raw;
    if (!Number.isInteger(raw)) fractional = true;
  }
  if (max === 0) return 10;
  if (max > 10) return 100;
  // 5-star scales are the only common ones using halves, and a 10-point
  // library whose maximum happens to be 5 is indistinguishable from a
  // 5-star one — treating it as /10 there merely keeps the values as given.
  if (max <= 5 && fractional) return 5;
  return 10;
}

const MOVIE_WORDS = new Set(["movie", "movies", "film", "films", "feature", "tvmovie", "video", "short"]);
const SERIES_WORDS = new Set([
  "series", "show", "shows", "tv", "tvseries", "tvminiseries", "miniseries",
  "tvshow", "season", "episode", "tvepisode", "anime", "ova", "ona", "special",
]);

export function normalizeType(value, fallback = "movie") {
  if (!value) return fallback;
  const key = String(value).toLowerCase().replace(/[\s_-]/g, "");
  if (MOVIE_WORDS.has(key)) return "movie";
  if (SERIES_WORDS.has(key)) return "series";
  return fallback;
}

// External ids, cleaned to the canonical form each provider uses. Anything
// unrecognised becomes undefined rather than a falsy-but-present value,
// because the matcher treats "has an id" as a reason to skip title matching.
export function cleanImdbId(value) {
  if (!value) return undefined;
  const text = String(value).trim();
  const match = text.match(/tt(\d{5,})/i);
  if (match) return `tt${match[1]}`;
  // Some exports drop the prefix and store the bare digits.
  if (/^\d{5,}$/.test(text)) return `tt${text}`;
  return undefined;
}

export function cleanNumericId(value) {
  if (value === null || value === undefined || value === "") return undefined;
  const text = String(value).trim();
  // "-1" is TV Time's explicit "unknown" marker and appears in real exports.
  if (text === "-1" || text === "0") return undefined;
  const match = text.match(/(\d+)/);
  if (!match) return undefined;
  const id = parseInt(match[1], 10);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

export function cleanIds(raw = {}) {
  const ids = {};
  const imdb = cleanImdbId(raw.imdb);
  if (imdb) ids.imdb = imdb;
  for (const key of ["tmdb", "tvdb", "mal", "anilist", "kitsu", "trakt", "simkl"]) {
    const id = cleanNumericId(raw[key]);
    if (id !== undefined) ids[key] = id;
  }
  return ids;
}

// Case- and punctuation-insensitive column lookup, built once per file. A
// source profile can then name a column "Your Rating" and still match a file
// that spells it "your_rating" or "YOUR RATING".
export function buildHeaderIndex(row) {
  const index = new Map();
  for (const key of Object.keys(row)) {
    const folded = foldTitle(key);
    if (folded && !index.has(folded)) index.set(folded, key);
  }
  return index;
}

// Folds a list of candidate column names once, so the per-row lookup below
// is a plain Map hit. Folding them inside the lookup instead cost ~90 fold
// operations per row — 3.6M of them on a 40k-row import, which dominated the
// entire normalization stage.
export function foldCandidates(candidates) {
  const seen = new Set();
  for (const candidate of candidates || []) {
    const folded = foldTitle(candidate);
    if (folded) seen.add(folded);
  }
  return Array.from(seen);
}

// First candidate column that exists and holds a non-empty value. Candidates
// must already be folded — see foldCandidates.
export function pickFolded(row, index, folded) {
  if (!folded) return undefined;
  for (const candidate of folded) {
    const key = index.get(candidate);
    if (key === undefined) continue;
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return undefined;
}

// Ergonomic form that folds as it goes. Fine for one-off lookups; the
// adapters use the pre-folded path above.
export function pickField(row, index, candidates) {
  return pickFolded(row, index, foldCandidates(candidates));
}

// Values that mean "yes" in a CSV column. Exports are inconsistent enough
// that treating any non-empty string as true would wrongly flag "false".
const TRUTHY = new Set(["1", "true", "yes", "y", "watched", "completed", "seen"]);
// "" is deliberately absent: an empty cell means "not set", which is the
// caller's fallback, not a definite no.
const FALSY = new Set(["0", "false", "no", "n", "unwatched", "plantowatch"]);

export function parseBoolean(value, fallback = false) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  const text = String(value).trim();
  // Counters rather than flags: Plex's "View Count", Kodi's "playcount" and
  // Trakt's "plays" all answer "watched?" with a number, and any value past
  // the single digit 1 would otherwise miss the vocabulary below.
  if (/^\d+(\.\d+)?$/.test(text)) return parseFloat(text) > 0;
  const key = text.toLowerCase().replace(/[\s_-]/g, "");
  if (TRUTHY.has(key)) return true;
  if (FALSY.has(key)) return false;
  return fallback;
}

// Library status vocabularies, shared by the profile adapter and the
// AniList/Kitsu adapter. Compared after spaces and separators are removed,
// so "Plan to Watch", "PLANNING" and "plan_to_watch" all land together.
export const WATCHED_STATUSES = new Set([
  "completed", "current", "watching", "repeating", "rewatching", "watched", "seen", "finished",
]);
export const PLANNED_STATUSES = new Set(["planning", "plantowatch", "planned", "ptw"]);

export function foldStatus(value) {
  return value ? String(value).toLowerCase().replace(/[\s_-]/g, "") : "";
}

export function makeItem(fields = {}) {
  const title = String(fields.title ?? "").trim();
  return {
    type: fields.type === "series" ? "series" : "movie",
    title,
    fold: foldTitle(title),
    year: fields.year ?? null,
    ids: fields.ids ?? {},
    watched: fields.watched === true,
    watchlist: fields.watchlist === true,
    favorite: fields.favorite === true,
    rating: fields.rating ?? null,
    watchedAt: fields.watchedAt ?? null,
    episodes: fields.episodes ?? 0,
  };
}

// Dedupe key. Two rows describing the same title must collapse even when
// they came from different files in the same archive (Letterboxd splits one
// film across watched.csv, ratings.csv and likes/films.csv).
//
// An external id is authoritative when present; otherwise fold+year is the
// best available identity, and a yearless row joins the yearful one for the
// same title rather than becoming a second entry.
export function itemKey(item) {
  const { ids = {} } = item;
  if (ids.imdb) return `imdb:${ids.imdb}`;
  if (ids.tmdb) return `${item.type}:tmdb:${ids.tmdb}`;
  if (ids.tvdb) return `${item.type}:tvdb:${ids.tvdb}`;
  if (ids.mal) return `mal:${ids.mal}`;
  if (ids.anilist) return `anilist:${ids.anilist}`;
  if (ids.kitsu) return `kitsu:${ids.kitsu}`;
  if (ids.trakt) return `${item.type}:trakt:${ids.trakt}`;
  if (ids.simkl) return `${item.type}:simkl:${ids.simkl}`;
  return `${item.type}:${item.fold}`;
}

// Merges a later record into an earlier one. Flags are sticky (any file
// saying "watched" wins), ids union, and the most specific/most recent value
// wins for everything else.
export function mergeItems(base, next) {
  base.watched = base.watched || next.watched;
  base.watchlist = base.watchlist || next.watchlist;
  base.favorite = base.favorite || next.favorite;
  if (next.rating !== null && next.rating !== undefined) base.rating = next.rating;
  if (next.year !== null && base.year === null) base.year = next.year;
  if (next.title && !base.title) {
    base.title = next.title;
    base.fold = next.fold;
  }
  if (next.episodes > base.episodes) base.episodes = next.episodes;
  // Keep the earliest known watch date: it's the one that reflects when the
  // user actually saw it, and re-imports shouldn't march it forward.
  if (next.watchedAt && (!base.watchedAt || next.watchedAt < base.watchedAt)) {
    base.watchedAt = next.watchedAt;
  }
  base.ids = { ...next.ids, ...base.ids };
  // A series type beats the movie default: only a source that knows it's a
  // show says so, while "movie" is what every unlabelled row falls back to.
  if (next.type === "series") base.type = "series";
  return base;
}

// Collapses a raw item list into unique titles. Two passes, because an id
// only becomes known once some file supplies it: the first pass merges on
// whatever key each row has, the second re-merges title-keyed leftovers into
// id-keyed entries for the same title+year.
export function dedupe(items) {
  const byKey = new Map();
  for (const item of items) {
    if (!item.title && Object.keys(item.ids).length === 0) continue;
    const key = itemKey(item);
    const existing = byKey.get(key);
    if (existing) mergeItems(existing, item);
    else byKey.set(key, item);
  }

  const byTitle = new Map();
  for (const item of byKey.values()) {
    if (!item.fold) continue;
    const titleKey = `${item.type}:${item.fold}`;
    const bucket = byTitle.get(titleKey);
    if (!bucket) {
      byTitle.set(titleKey, [item]);
      continue;
    }
    // Same title, and a year that doesn't contradict: an unknown year is
    // compatible with any, so the id-bearing row from one file absorbs the
    // yearless row from another instead of surviving as a second entry.
    const compatible = bucket.find(
      (other) => other.year === null || item.year === null || other.year === item.year
    );
    if (compatible) {
      mergeItems(compatible, item);
      // mergeItems mutates `compatible`, so `item`'s own key is still the
      // one it was stored under.
      byKey.delete(itemKey(item));
    } else {
      // A genuine remake — same title, different years. Keep both.
      bucket.push(item);
    }
  }

  return Array.from(byKey.values());
}
