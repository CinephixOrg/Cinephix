// ID matching layer.
//
// Stage 3 of the pipeline: Upload -> Normalize -> **Match** -> Save.
//
// Resolves normalized items against catalogue documents. Pure and
// synchronous: it is handed the documents to match against rather than
// querying for them, which is what lets the accuracy of the matcher be
// tested exhaustively without a database.
//
// Precedence is strictly external id first, then title+year, then title
// alone. An id match is a fact; a title match is an inference, and the
// confidence it reports is what the controller uses to decide whether a
// result is good enough to write.

import { foldTitle, foldTitleLoose } from "./normalize.js";

export const CONFIDENCE = {
  ID: 1,
  TITLE_YEAR: 0.9,
  TITLE_YEAR_NEAR: 0.75,
  TITLE_LOOSE: 0.6,
  TITLE_ONLY: 0.5,
};

// The catalogue has accumulated several id shapes over time — nested under
// `id`, flat with a `_id` suffix, and bare. Read all of them rather than
// assuming the one a given document happens to use.
export function docIds(doc) {
  const ids = {};
  const imdb = doc.id?.imdb ?? doc.imdb_id ?? doc.imdb;
  if (imdb) {
    const text = String(imdb).trim();
    if (/^tt\d+$/i.test(text)) ids.imdb = text.toLowerCase();
    else if (/^\d+$/.test(text)) ids.imdb = `tt${text}`;
  }
  for (const [key, raw] of [
    ["tmdb", doc.id?.tmdb ?? doc.tmdb_id ?? doc.tmdb],
    ["tvdb", doc.id?.tvdb ?? doc.tvdb_id ?? doc.tvdb],
  ]) {
    if (raw === null || raw === undefined || raw === "") continue;
    const id = parseInt(String(raw), 10);
    if (Number.isFinite(id) && id > 0) ids[key] = id;
  }
  return ids;
}

// Series store their name in `name` or `title` depending on how the document
// was created; movies use `title`.
export function docTitle(doc, type) {
  return type === "series" ? doc.name || doc.title || "" : doc.title || doc.name || "";
}

export function docYear(doc) {
  const raw = doc.release_date || doc.first_air_date || doc.year || doc.premiered;
  if (!raw) return null;
  const year = parseInt(String(raw).slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

/**
 * Builds the lookup structure a match pass runs against. One pass over the
 * documents; every subsequent lookup is O(1) on a Map rather than a scan.
 */
export function buildCatalogIndex(docs, type) {
  const byImdb = new Map();
  const byTmdb = new Map();
  const byTvdb = new Map();
  const byFold = new Map();
  const byLoose = new Map();

  const push = (map, key, doc) => {
    if (key === undefined || key === null || key === "") return;
    const existing = map.get(key);
    if (existing) existing.push(doc);
    else map.set(key, [doc]);
  };

  for (const doc of docs) {
    const ids = docIds(doc);
    // First writer wins for ids: they are supposed to be unique, and a
    // duplicate means a catalogue dedupe problem, not a matching one.
    if (ids.imdb && !byImdb.has(ids.imdb)) byImdb.set(ids.imdb, doc);
    if (ids.tmdb && !byTmdb.has(ids.tmdb)) byTmdb.set(ids.tmdb, doc);
    if (ids.tvdb && !byTvdb.has(ids.tvdb)) byTvdb.set(ids.tvdb, doc);

    const title = docTitle(doc, type);
    if (!title) continue;
    const fold = foldTitle(title);
    push(byFold, fold, doc);
    const loose = foldTitleLoose(title);
    if (loose && loose !== fold) push(byLoose, loose, doc);
  }

  return { byImdb, byTmdb, byTvdb, byFold, byLoose, type, size: docs.length };
}

// Of several documents with the same title, the one whose year is closest to
// the item's. Ties go to the earlier release, which is the original rather
// than a remake or a re-release record.
function closestByYear(candidates, targetYear) {
  let best = null;
  let bestDistance = Infinity;
  for (const doc of candidates) {
    const year = docYear(doc);
    if (year === null) continue;
    const distance = Math.abs(year - targetYear);
    if (distance < bestDistance || (distance === bestDistance && best && year < docYear(best))) {
      best = doc;
      bestDistance = distance;
    }
  }
  return best ? { doc: best, distance: bestDistance } : null;
}

/**
 * Resolves one item. Returns `{ doc, via, confidence }` or null.
 *
 * `via` names the rule that fired, which the import summary surfaces so a
 * user can see how their library was matched rather than only how much of it.
 */
export function matchItem(item, index) {
  const ids = item.ids || {};

  if (ids.imdb) {
    const doc = index.byImdb.get(ids.imdb);
    if (doc) return { doc, via: "imdb", confidence: CONFIDENCE.ID };
  }
  if (ids.tmdb) {
    const doc = index.byTmdb.get(ids.tmdb);
    if (doc) return { doc, via: "tmdb", confidence: CONFIDENCE.ID };
  }
  if (ids.tvdb) {
    const doc = index.byTvdb.get(ids.tvdb);
    if (doc) return { doc, via: "tvdb", confidence: CONFIDENCE.ID };
  }

  const fold = item.fold || foldTitle(item.title);
  if (!fold) return null;

  const exact = index.byFold.get(fold);
  if (exact && exact.length > 0) {
    if (item.year === null) {
      // No year to disambiguate with. A single candidate is safe; several
      // means a remake, and guessing between them would be worse than
      // reporting the title as ambiguous.
      if (exact.length === 1) return { doc: exact[0], via: "title", confidence: CONFIDENCE.TITLE_ONLY };
    } else {
      const best = closestByYear(exact, item.year);
      if (best) {
        if (best.distance === 0) return { doc: best.doc, via: "title+year", confidence: CONFIDENCE.TITLE_YEAR };
        // A year off by one is routine: sources disagree on festival vs
        // theatrical vs regional release dates.
        if (best.distance <= 1) {
          return { doc: best.doc, via: "title+year~", confidence: CONFIDENCE.TITLE_YEAR_NEAR };
        }
        // A usable year that contradicts by more than that means this is a
        // different film that happens to share a title. Fall through rather
        // than accepting it on the strength of the title alone.
      } else if (exact.length === 1) {
        // No candidate carried a usable year at all, so the title is the
        // only evidence there is.
        return { doc: exact[0], via: "title", confidence: CONFIDENCE.TITLE_ONLY };
      }
    }
  }

  // Article-insensitive last resort ("The Thing" / "Thing, The").
  const loose = foldTitleLoose(item.title);
  if (loose) {
    const candidates = index.byLoose.get(loose) || index.byFold.get(loose);
    if (candidates && candidates.length > 0) {
      if (item.year !== null) {
        const best = closestByYear(candidates, item.year);
        if (best && best.distance <= 1) {
          return { doc: best.doc, via: "title~", confidence: CONFIDENCE.TITLE_LOOSE };
        }
      } else if (candidates.length === 1) {
        return { doc: candidates[0], via: "title~", confidence: CONFIDENCE.TITLE_LOOSE };
      }
    }
  }

  return null;
}

/**
 * Matches a batch. `minConfidence` lets the caller refuse weak inferences —
 * writing the wrong film into someone's watched list is worse than leaving
 * it out, so the controller sets this deliberately rather than taking
 * whatever the matcher will offer.
 */
export function matchAll(items, index, minConfidence = 0) {
  const matched = [];
  const unmatched = [];
  const byRule = Object.create(null);

  for (const item of items) {
    const result = matchItem(item, index);
    if (result && result.confidence >= minConfidence) {
      matched.push({ item, doc: result.doc, via: result.via, confidence: result.confidence });
      byRule[result.via] = (byRule[result.via] || 0) + 1;
    } else {
      unmatched.push(item);
    }
  }

  return { matched, unmatched, byRule };
}

/**
 * The distinct lookup values a catalogue query needs in order to cover these
 * items — used to fetch only the documents that could possibly match,
 * instead of loading the collection.
 */
export function collectLookupKeys(items) {
  const imdb = new Set();
  const tmdb = new Set();
  const tvdb = new Set();
  const titles = new Set();

  for (const item of items) {
    if (item.ids?.imdb) imdb.add(item.ids.imdb);
    if (item.ids?.tmdb) tmdb.add(item.ids.tmdb);
    if (item.ids?.tvdb) tvdb.add(item.ids.tvdb);
    if (item.title) titles.add(item.title.trim());
  }

  return {
    imdb: Array.from(imdb),
    tmdb: Array.from(tmdb),
    tvdb: Array.from(tvdb),
    titles: Array.from(titles),
  };
}
