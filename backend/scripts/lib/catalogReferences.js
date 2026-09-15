// Shared by scripts/rollbackCatalogTwins.js and scripts/mergeCatalogDuplicates.js:
// finding duplicate catalogue documents, finding everything that references
// them, and moving those references safely from one document to another.
//
// Kept in one place so the two cleanup scripts can never disagree about what
// counts as a reference or how one is moved.

import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import "../../models/User.js";
import "../../models/Rating.js";
import { createMovieModel } from "../../models/Movie.js";
import { createSeriesModel } from "../../models/Series.js";
import { rebuildUserCineGraph } from "../../utils/cineGraph.js";
import { planRatingMerge } from "./ratingMerge.js";

// Backups are written as canonical Extended JSON so ObjectIds and Dates come
// back as ObjectIds and Dates on restore, not as strings.
const { EJSON } = mongoose.mongo.BSON;
if (typeof EJSON?.stringify !== "function") {
  throw new Error("EJSON is unavailable from the MongoDB driver, so backups could not be written. Aborting before any work.");
}

// ---------------------------------------------------------------------------
// Catalogue shape
// ---------------------------------------------------------------------------

export const TMDB_PATHS = ["id.tmdb", "tmdb_id", "tmdb"];
export const HAS_TMDB = { $or: TMDB_PATHS.map((p) => ({ [p]: { $exists: true } })) };
export const NO_TMDB = { $and: TMDB_PATHS.map((p) => ({ [p]: { $exists: false } })) };

export const SHAPE = {
  movie: { collection: "movies", titleOf: (d) => d.title ?? d.name, dateField: "release_date" },
  series: { collection: "series", titleOf: (d) => d.name ?? d.title, dateField: "first_air_date" },
};

export const toOid = (value) => (value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(String(value)));
export const createdAt = (id) => new Date(parseInt(String(id).slice(0, 8), 16) * 1000);
export const day = (date) => date.toISOString().slice(0, 10);
export const describe = (type, doc) => `${SHAPE[type].titleOf(doc)} (${doc[SHAPE[type].dateField] ?? "no date"})`;
export const hasTmdbId = (doc) => doc?.tmdb_id != null || doc?.tmdb != null || doc?.id?.tmdb != null;

export async function connect() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: "cleaned_db" });
  createMovieModel(mongoose.connection);
  createSeriesModel(mongoose.connection);
  return mongoose.connection.db;
}

export const disconnect = () => mongoose.disconnect();

export function parseArgs(argv) {
  const flag = (name) => argv.includes(name);
  const option = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return { flag, option };
}

export function parseDay(value, endOfDay) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Expected YYYY-MM-DD, got "${value}"`);
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
}

// ---------------------------------------------------------------------------
// Finding duplicates
// ---------------------------------------------------------------------------

/**
 * A "twin pair" is a document with a TMDB id and exactly one legacy document
 * (no TMDB id) with the same title and release date. When several legacy
 * documents share them, the group is ambiguous and left for
 * mergeCatalogDuplicates.js.
 */
export async function findTwinGroups(db, type, { createdFrom = null, createdTo = null } = {}) {
  const shape = SHAPE[type];
  const coll = db.collection(shape.collection);

  const rich = await coll.find(HAS_TMDB).toArray();
  const titles = [...new Set(rich.map(shape.titleOf).filter(Boolean))];
  const legacy = titles.length
    ? await coll
        .find(
          { $and: [{ $or: [{ title: { $in: titles } }, { name: { $in: titles } }] }, NO_TMDB] },
          { projection: { title: 1, name: 1, [shape.dateField]: 1 } }
        )
        .toArray()
    : [];

  const legacyByKey = new Map();
  for (const doc of legacy) {
    const key = `${shape.titleOf(doc)}|${doc[shape.dateField] ?? ""}`;
    legacyByKey.set(key, [...(legacyByKey.get(key) ?? []), doc]);
  }

  const pairs = [];
  const ambiguous = [];
  const skipped = [];
  for (const doc of rich) {
    const created = createdAt(doc._id);
    if ((createdFrom && created < createdFrom) || (createdTo && created > createdTo)) continue;
    const twins = legacyByKey.get(`${shape.titleOf(doc)}|${doc[shape.dateField] ?? ""}`) ?? [];
    // No legacy twin: a genuinely new title rather than a duplicate. Left alone.
    if (twins.length === 0) continue;
    if (twins.length > 1) {
      ambiguous.push({ type, rich: doc, legacy: twins });
      continue;
    }
    if (createdAt(twins[0]._id) >= created) {
      skipped.push({ type, rich: doc, legacy: twins[0], reason: "the TMDB document is not newer than the legacy one" });
      continue;
    }
    pairs.push({ type, rich: doc, legacy: twins[0] });
  }
  return { pairs, ambiguous, skipped };
}

// ---------------------------------------------------------------------------
// Finding references
// ---------------------------------------------------------------------------

const REFERENCE_KEYS = ["users", "ratings", "reviews", "customlists", "favoriteevents", "shares", "messages", "activitylogs"];

function emptyReferences() {
  return {
    users: new Set(), // user _ids holding it in the watched list, watchlist or favorites
    ratings: new Map(), // rating _id -> user _id
    reviews: new Map(), // review _id -> user _id
    customlists: new Set(),
    favoriteevents: new Set(),
    shares: new Set(),
    messages: new Set(),
    activitylogs: new Set(),
  };
}

/**
 * Every reference to each of `ids`, in one query per referencing collection
 * (not one per id). Returns Map<idString, references>.
 */
export async function findReferences(db, ids) {
  const oids = ids.map(toOid);
  const strs = oids.map(String);
  const mixed = [...strs, ...oids]; // Rating/Review/FavoriteEvent/Message ids appear as both types in the data
  const refs = new Map(strs.map((s) => [s, emptyReferences()]));
  const target = (value) => (value == null ? undefined : refs.get(String(value)));
  if (oids.length === 0) return refs;

  const users = await db
    .collection("users")
    .find(
      { $or: [{ "watchlist.itemId": { $in: oids } }, { "toWatchList.itemId": { $in: oids } }, { favoriteMovies: { $in: oids } }, { favoriteSeries: { $in: oids } }] },
      { projection: { "watchlist.itemId": 1, "toWatchList.itemId": 1, favoriteMovies: 1, favoriteSeries: 1 } }
    )
    .toArray();
  for (const user of users) {
    const held = [
      ...(user.watchlist ?? []).map((entry) => entry.itemId),
      ...(user.toWatchList ?? []).map((entry) => entry.itemId),
      ...(user.favoriteMovies ?? []),
      ...(user.favoriteSeries ?? []),
    ];
    for (const value of held) target(value)?.users.add(String(user._id));
  }

  for (const collection of ["ratings", "reviews"]) {
    const docs = await db.collection(collection).find({ contentId: { $in: mixed } }, { projection: { contentId: 1, user: 1 } }).toArray();
    for (const doc of docs) target(doc.contentId)?.[collection].set(String(doc._id), String(doc.user));
  }

  const lists = await db.collection("customlists").find({ "items.itemId": { $in: oids } }, { projection: { "items.itemId": 1 } }).toArray();
  for (const list of lists) for (const item of list.items ?? []) target(item.itemId)?.customlists.add(String(list._id));

  for (const collection of ["favoriteevents", "messages"]) {
    const docs = await db.collection(collection).find({ contentId: { $in: mixed } }, { projection: { contentId: 1 } }).toArray();
    for (const doc of docs) target(doc.contentId)?.[collection].add(String(doc._id));
  }

  const shares = await db
    .collection("shares")
    .find(
      { $or: [{ contentId: { $in: strs } }, { "listData.previewItems.itemId": { $in: strs } }, { "officialLinks.contentId": { $in: strs } }] },
      { projection: { contentId: 1, "listData.previewItems.itemId": 1, "officialLinks.contentId": 1 } }
    )
    .toArray();
  for (const share of shares) {
    const values = [share.contentId, ...(share.listData?.previewItems ?? []).map((i) => i.itemId), ...(share.officialLinks ?? []).map((l) => l.contentId)];
    for (const value of values) target(value)?.shares.add(String(share._id));
  }

  const logs = await db.collection("activitylogs").find({ "payload.addedWatchlistIds": { $in: strs } }, { projection: { "payload.addedWatchlistIds": 1 } }).toArray();
  for (const log of logs) for (const value of log.payload?.addedWatchlistIds ?? []) target(value)?.activitylogs.add(String(log._id));

  return refs;
}

export function summarize(references) {
  const out = {};
  for (const key of REFERENCE_KEYS) {
    const size = references?.[key]?.size ?? 0;
    if (size > 0) out[key] = size;
  }
  return out;
}

export const referenceTotal = (references) => REFERENCE_KEYS.reduce((sum, key) => sum + (references?.[key]?.size ?? 0), 0);

// ---------------------------------------------------------------------------
// Moving references
// ---------------------------------------------------------------------------

/**
 * Moves every reference from `from` onto `to`. Every write is scoped by _id to
 * the documents `references` (from findReferences) found, so nothing outside
 * them is touched.
 *
 * Where a document already references `to`, the `from` reference is removed
 * instead of creating a duplicate: a watched-list entry keeps the earlier of
 * the two dates; for ratings and reviews each user keeps their most recent one
 * across both documents, and the others are written to the backup before they
 * are deleted.
 *
 * Neither `from` nor `to` themselves are written to.
 */
export async function moveReferences(db, { from, to, references, backup, onRaterChanged = () => {} }) {
  const fromOid = toOid(from);
  const toOidValue = toOid(to);
  const fromStr = String(fromOid);
  const toStr = String(toOidValue);
  const scopeOf = (set) => ({ _id: { $in: [...set].map(toOid) } });
  const changed = {};

  if (references.users.size > 0) {
    const users = db.collection("users");
    const scope = scopeOf(references.users);

    for (const field of ["watchlist", "toWatchList"]) {
      const holders = await users
        .find({ ...scope, [`${field}.itemId`]: { $all: [fromOid, toOidValue] } }, { projection: { [field]: 1 } })
        .toArray();
      for (const user of holders) {
        const fromEntry = user[field].find((entry) => String(entry.itemId) === fromStr);
        const toEntry = user[field].find((entry) => String(entry.itemId) === toStr);
        if (fromEntry?.addedAt && (!toEntry?.addedAt || fromEntry.addedAt < toEntry.addedAt)) {
          await users.updateOne(
            { _id: user._id },
            { $set: { [`${field}.$[keep].addedAt`]: fromEntry.addedAt } },
            { arrayFilters: [{ "keep.itemId": toOidValue }] }
          );
        }
        await users.updateOne({ _id: user._id }, { $pull: { [field]: { itemId: fromOid } } });
      }
      const moved = await users.updateMany(
        { ...scope, [`${field}.itemId`]: fromOid },
        { $set: { [`${field}.$[entry].itemId`]: toOidValue } },
        { arrayFilters: [{ "entry.itemId": fromOid }] }
      );
      changed[field] = holders.length + moved.modifiedCount;
    }

    for (const field of ["favoriteMovies", "favoriteSeries"]) {
      const pulled = await users.updateMany({ ...scope, [field]: { $all: [fromOid, toOidValue] } }, { $pull: { [field]: fromOid } });
      const moved = await users.updateMany(
        { ...scope, [field]: fromOid },
        { $set: { [`${field}.$[entry]`]: toOidValue } },
        { arrayFilters: [{ entry: fromOid }] }
      );
      changed[field] = pulled.modifiedCount + moved.modifiedCount;
    }
  }

  // One per user: a user can hold ratings on `from` in both id forms and on
  // `to` as well, so planRatingMerge keeps each user's most recent one.
  for (const name of ["ratings", "reviews"]) {
    const entries = references[name];
    if (entries.size === 0) continue;
    const collection = db.collection(name);
    const fromDocs = await collection.find({ _id: { $in: [...entries.keys()].map(toOid) }, contentId: { $in: [fromStr, fromOid] } }).toArray();
    if (fromDocs.length === 0) continue;
    const raters = [...new Set(fromDocs.map((doc) => String(doc.user)))].map(toOid);
    const toDocs = await collection.find({ user: { $in: raters }, contentId: { $in: [toStr, toOidValue] } }).toArray();
    const { remove, move } = planRatingMerge(fromDocs, toDocs);

    if (remove.length > 0) {
      backup.record(name, remove); // on disk before the delete
      await collection.deleteMany({ _id: { $in: remove.map((doc) => doc._id) } });
    }
    const moved = move.length
      ? await collection.updateMany({ _id: { $in: move.map((doc) => doc._id) }, contentId: { $in: [fromStr, fromOid] } }, { $set: { contentId: toStr } })
      : { modifiedCount: 0 };
    for (const doc of fromDocs) onRaterChanged(String(doc.user));
    changed[name] = remove.length + moved.modifiedCount;
  }

  if (references.customlists.size > 0) {
    const lists = db.collection("customlists");
    const scope = scopeOf(references.customlists);
    const pulled = await lists.updateMany({ ...scope, "items.itemId": { $all: [fromOid, toOidValue] } }, { $pull: { items: { itemId: fromOid } } });
    const moved = await lists.updateMany(
      { ...scope, "items.itemId": fromOid },
      { $set: { "items.$[entry].itemId": toOidValue } },
      { arrayFilters: [{ "entry.itemId": fromOid }] }
    );
    changed.customlists = pulled.modifiedCount + moved.modifiedCount;
  }

  if (references.favoriteevents.size > 0) {
    changed.favoriteevents = (
      await db.collection("favoriteevents").updateMany(
        { ...scopeOf(references.favoriteevents), contentId: { $in: [fromOid, fromStr] } },
        { $set: { contentId: toOidValue } }
      )
    ).modifiedCount;
  }

  if (references.shares.size > 0) {
    const shares = db.collection("shares");
    const scope = scopeOf(references.shares);
    changed.shares =
      (await shares.updateMany({ ...scope, contentId: fromStr }, { $set: { contentId: toStr } })).modifiedCount +
      (
        await shares.updateMany(
          { ...scope, "listData.previewItems.itemId": fromStr },
          { $set: { "listData.previewItems.$[entry].itemId": toStr } },
          { arrayFilters: [{ "entry.itemId": fromStr }] }
        )
      ).modifiedCount +
      (
        await shares.updateMany(
          { ...scope, "officialLinks.contentId": fromStr },
          { $set: { "officialLinks.$[entry].contentId": toStr } },
          { arrayFilters: [{ "entry.contentId": fromStr }] }
        )
      ).modifiedCount;
  }

  if (references.messages.size > 0) {
    changed.messages = (
      await db.collection("messages").updateMany(
        { ...scopeOf(references.messages), contentId: { $in: [fromOid, fromStr] } },
        { $set: { contentId: toOidValue } }
      )
    ).modifiedCount;
  }

  if (references.activitylogs.size > 0) {
    changed.activitylogs = (
      await db.collection("activitylogs").updateMany(
        { ...scopeOf(references.activitylogs), "payload.addedWatchlistIds": fromStr },
        { $set: { "payload.addedWatchlistIds.$[entry]": toStr } },
        { arrayFilters: [{ entry: fromStr }] }
      )
    ).modifiedCount;
  }

  return changed;
}

/**
 * Re-checks references for `docs` and deletes only those with none left,
 * additionally filtered by `guard` (HAS_TMDB or NO_TMDB) so a document whose
 * kind changed in the meantime is kept.
 */
export async function deleteUnreferenced(db, collectionName, docs, guard) {
  if (docs.length === 0) return { deleted: [], kept: [] };
  const refs = await findReferences(db, docs.map((doc) => doc._id));
  const candidates = [];
  const kept = [];
  for (const doc of docs) {
    const references = refs.get(String(doc._id));
    if (referenceTotal(references) === 0) candidates.push(doc);
    else kept.push({ doc, reason: `still referenced ${JSON.stringify(summarize(references))}` });
  }
  if (candidates.length === 0) return { deleted: [], kept };

  const ids = candidates.map((doc) => doc._id);
  await db.collection(collectionName).deleteMany({ $and: [{ _id: { $in: ids } }, guard] });
  const survivors = new Set(
    (await db.collection(collectionName).find({ _id: { $in: ids } }, { projection: { _id: 1 } }).toArray()).map((doc) => String(doc._id))
  );
  const deleted = candidates.filter((doc) => !survivors.has(String(doc._id)));
  for (const doc of candidates.filter((d) => survivors.has(String(d._id)))) {
    kept.push({ doc, reason: "no longer matched the delete guard" });
  }
  return { deleted, kept };
}

// ---------------------------------------------------------------------------
// Backup and follow-up
// ---------------------------------------------------------------------------

/**
 * Writes an Extended JSON backup immediately and re-saves it whenever
 * something is recorded, so a crash never leaves a deletion unrecorded.
 *
 * Restore a deleted document with:
 *   const { EJSON } = mongoose.mongo.BSON;
 *   const backup = EJSON.parse(fs.readFileSync(file, "utf8"), { relaxed: false });
 *   for (const { collection, document } of backup.deletedDocuments) await db.collection(collection).insertOne(document);
 */
export function createBackup(dir, label, meta) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${label}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const data = { startedAt: new Date(), ...meta, deletedDocuments: [] };
  const save = () => fs.writeFileSync(file, EJSON.stringify(data, null, 2, { relaxed: false }));
  save();
  return {
    file,
    data,
    save,
    record(collection, documents) {
      for (const document of documents) data.deletedDocuments.push({ collection, document });
      save();
    },
  };
}

export async function rebuildCineGraphs(userIds) {
  let failed = 0;
  for (const userId of userIds) {
    try {
      await rebuildUserCineGraph(userId);
    } catch (error) {
      failed += 1;
      console.error(`  CineGraph rebuild failed for user ${userId}: ${error.message}`);
    }
  }
  return failed;
}
