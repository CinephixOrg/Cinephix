import mongoose from "mongoose";
import { normalizeTitle } from "./tmdbMatch.js";

// Legacy-aware catalogue writes for TMDB results.
//
// The catalogue holds two generations of documents. Legacy documents (the
// bulk-imported majority) carry a title, release date, poster and genres but
// no TMDB id. Later code wrote TMDB results keyed only by TMDB id, so a film
// that existed only as a legacy document got a second, "rich" document the
// moment it was looked up — and user lists, ratings and favorites then split
// between the two twins.
//
// Every TMDB result now resolves in this order:
//   1. a document that already carries this TMDB id
//   2. a legacy document (no TMDB id) with the same title and release date,
//      or failing that the only legacy document with that title and year —
//      "the same title" loosely (see sameTitle below), since legacy records
//      spell titles their own way —
//      which is enriched in place with the TMDB id and any metadata it lacks,
//      keeping its _id, and so every reference already pointing at it
//   3. otherwise a new document
//
// A whole batch resolves in two reads and one bulk write, rather than one
// round trip per film against a collection with no index on title.

const TMDB_ID_PATHS = ["id.tmdb", "tmdb_id", "tmdb"];

// Filled on a document already matched by TMDB id where it has none: records
// created before these were kept would otherwise never get the name and
// language the app picks a displayed title by (utils/catalogTitles.js).
const BACKFILL_ON_MATCH = ["original_title", "original_name", "original_language", "origin_country"];

const METADATA_KEYS = {
  movie: ["title", "original_title", "original_language", "release_date", "poster_path", "backdrop_path", "overview", "vote_average", "vote_count", "popularity", "genre_ids", "type"],
  series: ["name", "title", "original_name", "original_language", "origin_country", "first_air_date", "poster_path", "backdrop_path", "overview", "vote_average", "vote_count", "popularity", "genre_ids", "type"],
};

export function catalogShape(type) {
  return type === "series"
    ? { titleFields: ["name", "title"], dateField: "first_air_date" }
    : { titleFields: ["title"], dateField: "release_date" };
}

/** The TMDB id a document carries in any of the shapes the catalogue uses, or null. */
export function readTmdbId(doc) {
  const raw = doc?.id?.tmdb ?? doc?.tmdb_id ?? doc?.tmdb;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const isBlank = (value) =>
  value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

/** A TMDB search/list result reduced to the fields the catalogue stores. */
export function metadataFromTmdb(hit, type) {
  const raw =
    type === "series"
      ? { name: hit.name, title: hit.name, original_name: hit.original_name, first_air_date: hit.first_air_date, origin_country: hit.origin_country }
      : { title: hit.title, original_title: hit.original_title, release_date: hit.release_date };
  // The original name is only worth keeping with the language it is in —
  // that pair is what the app picks a title's displayed name by
  // (utils/catalogTitles.js).
  raw.original_language = hit.original_language;
  Object.assign(raw, {
    poster_path: hit.poster_path,
    backdrop_path: hit.backdrop_path,
    overview: hit.overview,
    vote_average: hit.vote_average,
    vote_count: hit.vote_count,
    popularity: hit.popularity,
    genre_ids: Array.isArray(hit.genre_ids) ? hit.genre_ids : undefined,
    type,
  });
  const meta = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isBlank(value)) meta[key] = value;
  }
  return meta;
}

/**
 * Every name a document or TMDB result goes by, reduced for comparing.
 *
 * A strict comparison (trimmed, lower-cased) let the Turkish-catalogue
 * backfill of 2026-10-28 (TC-140) create 245 twins of legacy records it
 * should have enriched. The legacy import spelled titles its own way, and
 * TMDB has since renamed some:
 *   - case and accents:  "Wild heart" / "Wild Heart", "Recep İvedik" / "Recep Ivedik"
 *   - punctuation:       "Yor, the Hunter…" / "Yor: The Hunter…"
 *   - a leading "The":   "The Valley of The Wolves" / "Valley of the Wolves"
 *   - the original name: a legacy "Deniz Yıldızı" is TMDB's "Starfish",
 *     original name "Deniz Yıldızı"
 * So both sides offer their title, series name and original name, each
 * normalized (utils/tmdbMatch.js) with a leading "the" dropped, and one
 * shared name is a title match. The date rules in findLegacyTwin still have
 * to agree, which is what keeps two different films apart.
 */
function titleKeys(doc) {
  const keys = new Set();
  for (const value of [doc.title, doc.name, doc.original_title, doc.original_name]) {
    const key = normalizeTitle(value).replace(/^the /, "");
    if (key) keys.add(key);
  }
  return keys;
}
const sharesTitle = (a, b) => [...a].some((key) => b.has(key));
const yearOf = (date) => (typeof date === "string" && /^\d{4}/.test(date) ? date.slice(0, 4) : null);
const byOldestId = (a, b) => (String(a._id) < String(b._id) ? -1 : 1);

/**
 * The legacy document a TMDB result describes, or null.
 *
 * Same title and exact release date first. Several legacy documents sharing
 * both are the same film recorded more than once, so the oldest is taken
 * rather than creating yet another record. Failing an exact date, a single
 * legacy document with that title and year is accepted — sources disagree on
 * premiere versus theatrical dates — but two in the same year could be
 * different films, so that case is refused.
 */
export function findLegacyTwin(candidates, meta, type, claimed = new Set()) {
  const { dateField } = catalogShape(type);
  const keys = titleKeys(meta);
  if (keys.size === 0) return null;

  const sameTitle = candidates
    .filter((doc) => !claimed.has(String(doc._id)) && readTmdbId(doc) === null && sharesTitle(keys, titleKeys(doc)))
    .sort(byOldestId);

  const date = meta[dateField] ?? null;
  if (!date) {
    const undated = sameTitle.filter((doc) => isBlank(doc[dateField]));
    return undated.length === 1 ? undated[0] : null;
  }

  const exact = sameTitle.filter((doc) => doc[dateField] === date);
  if (exact.length > 0) return exact[0];

  const year = yearOf(date);
  const sameYear = year ? sameTitle.filter((doc) => yearOf(doc[dateField]) === year) : [];
  return sameYear.length === 1 ? sameYear[0] : null;
}

const pick = (source, keys) => {
  const out = {};
  for (const key of keys) if (source[key] !== undefined) out[key] = source[key];
  return out;
};

/**
 * Pure planning step: which bulk-write operations resolve these hits, and
 * which document each TMDB id ends up on. No I/O, so it is unit-tested
 * directly (catalogUpsert.test.js).
 *
 * `refreshFields` are overwritten on matched documents on every call (the
 * daily sync uses it to keep popularity current). Everything else is only
 * ever filled where the matched document has nothing.
 */
export function planCatalogWrites({
  type,
  hits,
  existingByTmdb,
  legacyCandidates,
  refreshFields = [],
  now = new Date(),
  createId = () => new mongoose.Types.ObjectId(),
}) {
  const ops = [];
  const resolved = new Map();
  const claimed = new Set();

  for (const hit of hits) {
    const tmdbId = readTmdbId({ tmdb_id: hit?.id });
    if (tmdbId === null || resolved.has(tmdbId)) continue;

    const meta = metadataFromTmdb(hit, type);
    const refresh = pick(meta, refreshFields);

    const existing = existingByTmdb.get(tmdbId);
    if (existing) {
      resolved.set(tmdbId, { _id: existing._id, via: "tmdb" });
      const backfill = {};
      for (const key of BACKFILL_ON_MATCH) {
        if (meta[key] !== undefined && isBlank(existing[key])) backfill[key] = meta[key];
      }
      const set = { ...backfill, ...refresh };
      if (Object.keys(set).length > 0) {
        ops.push({ updateOne: { filter: { _id: existing._id }, update: { $set: { ...set, updated_at: now } } } });
      }
      continue;
    }

    const legacy = findLegacyTwin(legacyCandidates, meta, type, claimed);
    if (legacy) {
      claimed.add(String(legacy._id));
      resolved.set(tmdbId, { _id: legacy._id, via: "legacy" });

      const fill = {};
      for (const [key, value] of Object.entries(meta)) {
        if (isBlank(legacy[key])) fill[key] = value;
      }
      const set = { ...fill, ...refresh, tmdb_id: tmdbId, updated_at: now };
      // Some records store a scalar in `id`. Writing "id.tmdb" into one of
      // those would fail the whole write, so the nested copy is only added
      // where `id` is absent or already an object.
      const idIsNestable = legacy.id === undefined || legacy.id === null || (typeof legacy.id === "object" && !Array.isArray(legacy.id));
      if (idIsNestable) set["id.tmdb"] = tmdbId;

      ops.push({
        updateOne: {
          // Re-checks "still has no TMDB id" at write time, so a concurrent
          // enrichment can't be overwritten with a different id.
          filter: { _id: legacy._id, $and: TMDB_ID_PATHS.map((path) => ({ [path]: { $exists: false } })) },
          update: { $set: set },
        },
      });
      continue;
    }

    const _id = createId();
    resolved.set(tmdbId, { _id, via: "created" });
    ops.push({
      insertOne: { document: { _id, ...meta, id: { tmdb: tmdbId }, tmdb_id: tmdbId, updated_at: now } },
    });
  }

  return { ops, resolved };
}

/**
 * Legacy records released the same day as one of `hits` under a differently
 * spelled title (titleKeys) — the ones the exact-title lookup can't find,
 * since an index only looks up a title spelled exactly the same.
 *
 * By date instead, the date being indexed (models/Movie.js,
 * models/Series.js), with two limits that keep this cheap enough for a
 * user-facing request (services/listSuggestions.js):
 *   - January 1st is skipped. Legacy records that only knew their year carry
 *     YYYY-01-01, tens of thousands of them: 200 films' dates matched 51,520
 *     records and took two minutes. Those still match by exact title.
 *   - Only names and dates are read for the whole day; the full record only
 *     for the few whose name matches.
 */
async function legacySpelledDifferently(Model, type, hits, projection, noTmdbId) {
  const { dateField } = catalogShape(type);
  const dates = [
    ...new Set(hits.map((hit) => (type === "series" ? hit.first_air_date : hit.release_date)).filter((date) => date && !/-01-01$/.test(date))),
  ];
  if (dates.length === 0) return [];

  const keysByDate = new Map();
  for (const hit of hits) {
    const meta = metadataFromTmdb(hit, type);
    const date = meta[dateField];
    if (date) keysByDate.set(date, new Set([...(keysByDate.get(date) ?? []), ...titleKeys(meta)]));
  }
  const sameDay = await Model.find({ $and: [{ [dateField]: { $in: dates } }, ...noTmdbId] })
    .select(`_id title name original_title original_name ${dateField}`)
    .lean();
  const ids = sameDay.filter((doc) => keysByDate.has(doc[dateField]) && sharesTitle(keysByDate.get(doc[dateField]), titleKeys(doc))).map((doc) => doc._id);
  return ids.length > 0 ? Model.find({ _id: { $in: ids } }).select(projection).lean() : [];
}

/**
 * Resolves TMDB results to catalogue documents, enriching legacy twins
 * instead of duplicating them.
 *
 * With `write: false` nothing is written: results match documents the
 * catalogue already has (by TMDB id, or a legacy twin, left as it is), and a
 * result the catalogue doesn't have is left out rather than created.
 *
 * @returns {Promise<Map<number, {_id: mongoose.Types.ObjectId, via: "tmdb"|"legacy"|"created"}>>}
 */
export async function resolveTmdbHits(Model, type, hits, { refreshFields = [], write = true } = {}) {
  const unique = [];
  const seen = new Set();
  for (const hit of hits || []) {
    const id = readTmdbId({ tmdb_id: hit?.id });
    if (id === null || seen.has(id)) continue;
    seen.add(id);
    unique.push(hit);
  }
  if (unique.length === 0) return new Map();

  const { titleFields, dateField } = catalogShape(type);
  const tmdbIds = unique.map((hit) => Number(hit.id));
  const titles = [
    ...new Set(unique.flatMap((hit) => (type === "series" ? [hit.name, hit.original_name] : [hit.title, hit.original_title])).filter(Boolean)),
  ];
  const projection = [...new Set(["_id", "id", "tmdb_id", "tmdb", dateField, ...METADATA_KEYS[type]])].join(" ");
  const noTmdbId = TMDB_ID_PATHS.map((path) => ({ [path]: { $exists: false } }));

  const [withTmdbId, legacyByTitle, legacyByDate] = await Promise.all([
    Model.find({ $or: TMDB_ID_PATHS.map((path) => ({ [path]: { $in: tmdbIds } })) }).select(projection).lean(),
    titles.length > 0
      ? Model.find({ $and: [{ $or: titleFields.map((field) => ({ [field]: { $in: titles } })) }, ...noTmdbId] })
          .select(projection)
          .lean()
      : [],
    legacySpelledDifferently(Model, type, unique, projection, noTmdbId),
  ]);
  const legacy = [...new Map([...legacyByTitle, ...legacyByDate].map((doc) => [String(doc._id), doc])).values()];

  const existingByTmdb = new Map();
  for (const doc of withTmdbId) {
    const id = readTmdbId(doc);
    if (id !== null && !existingByTmdb.has(id)) existingByTmdb.set(id, doc);
  }

  const plan = planCatalogWrites({ type, hits: unique, existingByTmdb, legacyCandidates: legacy, refreshFields });
  if (!write) {
    return new Map([...plan.resolved].filter(([, entry]) => entry.via !== "created"));
  }
  // The raw driver, not Model.bulkWrite: Mongoose treats `id` as a virtual,
  // which is how most of the existing rich twins ended up without the
  // id.tmdb their creating code tried to write.
  if (plan.ops.length > 0) await Model.collection.bulkWrite(plan.ops, { ordered: false });
  return plan.resolved;
}
