// The catalogue cleanup steps, as functions.
//
// scripts/masterCleanup.js runs all of them unattended; createCatalogIndexes.js,
// rollbackCatalogTwins.js and mergeCatalogDuplicates.js each run one step on
// its own. Both paths call these same functions, so there is one
// implementation of each step however it's run.
//
// Every step takes `apply`. With apply false it plans and reports and never
// writes, which is what the dry-run modes use.

import {
  createdAt,
  deleteUnreferenced,
  describe,
  findReferences,
  findTwinGroups,
  HAS_TMDB,
  hasTmdbId,
  moveReferences,
  NO_TMDB,
  referenceTotal,
  SHAPE,
  summarize,
  toOid,
} from "./catalogReferences.js";

// Everyone who rated one of the kept documents. CineGraph is rebuilt for all of
// them rather than only the users whose ratings moved in this run, so a re-run
// also rebuilds users whose ratings moved in a run that stopped early.
async function addRatersOf(db, ids, changedRaters) {
  if (ids.length === 0) return;
  const users = await db.collection("ratings").distinct("user", { contentId: { $in: ids.flatMap((id) => [String(id), toOid(id)]) } });
  for (const user of users) changedRaters.add(String(user));
}

export const formatChanges = (changed) =>
  Object.entries(changed)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => `${key} ${n}`)
    .join(", ") || "no references";

// ---------------------------------------------------------------------------
// Step 1 — indexes
// ---------------------------------------------------------------------------

// Queries shaped like the ones the app issues, explained to show whether they
// can be answered from an index.
const PROBES = {
  Movie: [
    ["title lookup", { title: { $in: ["The Truman Show"] } }],
    ["TMDB id lookup", { $or: ["id.tmdb", "tmdb_id", "tmdb"].map((p) => ({ [p]: { $in: [37165] } })) }],
    [
      "external id lookup",
      { $or: ["id.imdb", "imdb_id", "imdb", "id.tmdb", "tmdb_id", "tmdb", "id.tvdb", "tvdb_id", "tvdb"].map((p) => ({ [p]: { $in: ["tt0120382", 37165, 1] } })) },
    ],
  ],
  Series: [
    ["title lookup", { $or: [{ title: { $in: ["Silo"] } }, { name: { $in: ["Silo"] } }] }],
    ["TMDB id lookup", { $or: ["id.tmdb", "tmdb_id", "tmdb"].map((p) => ({ [p]: { $in: [125988] } })) }],
  ],
};

function planStages(plan, out = new Set()) {
  if (!plan || typeof plan !== "object") return out;
  if (plan.stage) out.add(plan.stage);
  for (const child of [plan.inputStage, ...(plan.inputStages ?? [])]) planStages(child, out);
  return out;
}

/**
 * Builds every index declared on the models that doesn't exist yet, one at a
 * time. Existing indexes are never dropped or modified; an index whose key
 * already exists under another name is skipped. A failed build is recorded
 * and the rest continue.
 */
export async function ensureCatalogIndexes(models, { apply, log }) {
  const report = { missing: [], built: [], failed: [], probes: [] };

  for (const Model of models) {
    const collection = Model.collection;
    const name = collection.collectionName;
    const existingByKey = new Map((await collection.indexes()).map((index) => [JSON.stringify(index.key), index.name]));

    const missing = [];
    for (const [key, declared] of Model.schema.indexes()) {
      // Mongoose adds `background: true` to every declared index by itself.
      // MongoDB has ignored it since 4.2, so it isn't sent.
      const { background: _ignored, ...options } = declared;
      const present = existingByKey.get(JSON.stringify(key));
      if (present) {
        log(`  ${name}: exists  ${JSON.stringify(key)} (as "${present}")`);
      } else {
        missing.push({ collection: name, key, options });
        log(`  ${name}: missing ${JSON.stringify(key)} ${JSON.stringify(options)}`);
      }
    }
    report.missing.push(...missing);

    if (apply) {
      for (const index of missing) {
        const started = Date.now();
        try {
          await collection.createIndex(index.key, index.options);
          report.built.push(index);
          log(`  ${name}: built   ${index.options.name} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
        } catch (error) {
          report.failed.push({ ...index, error: error.message });
          log(`  ${name}: FAILED  ${index.options.name}: ${error.message}`);
        }
      }
    }

    for (const [probeName, filter] of PROBES[Model.modelName] ?? []) {
      const explained = await collection.find(filter).explain("queryPlanner");
      const stages = [...planStages(explained.queryPlanner.winningPlan)];
      const usesIndex = !stages.includes("COLLSCAN");
      report.probes.push({ collection: name, name: probeName, stages, usesIndex });
      log(`  ${name}: ${probeName} -> ${usesIndex ? "uses an index" : "COLLECTION SCAN"} (${stages.join(" > ")})`);
    }
  }

  return report;
}

// ---------------------------------------------------------------------------
// Step 2 — twin pairs (one legacy document + one TMDB copy)
// ---------------------------------------------------------------------------

export async function findAllTwinGroups(db, { types = ["movie", "series"], createdFrom = null, createdTo = null } = {}) {
  const all = { pairs: [], ambiguous: [], skipped: [] };
  for (const type of types) {
    const found = await findTwinGroups(db, type, { createdFrom, createdTo });
    all.pairs.push(...found.pairs);
    all.ambiguous.push(...found.ambiguous);
    all.skipped.push(...found.skipped);
  }
  return all;
}

/** Twins created recently mean something is still creating them. */
export const recentTwins = (pairs, hours = 48) =>
  pairs.filter((pair) => Date.now() - createdAt(pair.rich._id).getTime() < hours * 3600 * 1000);

// Users holding both copies in their watched list, and users who rated both:
// the cases where a reference is removed rather than moved.
async function countConflicts(db, pairs, refs) {
  const userIds = new Set();
  for (const pair of pairs) for (const id of refs.get(String(pair.rich._id)).users) userIds.add(id);
  const users = userIds.size
    ? await db.collection("users").find({ _id: { $in: [...userIds].map(toOid) } }, { projection: { "watchlist.itemId": 1 } }).toArray()
    : [];
  const watched = new Map(users.map((u) => [String(u._id), new Set((u.watchlist ?? []).map((e) => String(e.itemId)))]));

  const legacyRatings = await db
    .collection("ratings")
    .find({ contentId: { $in: pairs.flatMap((pair) => [String(pair.legacy._id), pair.legacy._id]) } }, { projection: { contentId: 1, user: 1 } })
    .toArray();
  const legacyRaters = new Map();
  for (const rating of legacyRatings) {
    const key = String(rating.contentId);
    legacyRaters.set(key, (legacyRaters.get(key) ?? new Set()).add(String(rating.user)));
  }

  let bothWatched = 0;
  let bothRated = 0;
  for (const pair of pairs) {
    const rich = String(pair.rich._id);
    const legacy = String(pair.legacy._id);
    const references = refs.get(rich);
    for (const user of references.users) if (watched.get(user)?.has(rich) && watched.get(user)?.has(legacy)) bothWatched += 1;
    const raters = legacyRaters.get(legacy) ?? new Set();
    for (const user of references.ratings.values()) if (raters.has(user)) bothRated += 1;
  }
  return { bothWatched, bothRated };
}

/**
 * Moves every reference from each TMDB copy onto its legacy twin, then deletes
 * the TMDB copies nothing references any more. Legacy documents are never
 * written.
 */
export async function cleanUpTwinPairs(db, { pairs, apply, backup, changedRaters, log }) {
  const result = { references: {}, conflicts: { bothWatched: 0, bothRated: 0 }, perPair: [], deleted: [], kept: [] };
  if (pairs.length === 0) return result;

  const refs = await findReferences(db, pairs.map((pair) => pair.rich._id));
  for (const pair of pairs) {
    const summary = summarize(refs.get(String(pair.rich._id)));
    result.perPair.push({ pair, summary });
    for (const [key, n] of Object.entries(summary)) result.references[key] = (result.references[key] ?? 0) + n;
  }
  result.conflicts = await countConflicts(db, pairs, refs);
  if (!apply) return result;

  if (!backup) throw new Error("Refusing to clean up twin pairs without a backup.");
  (backup.data.twinPairs ??= []).push(
    ...result.perPair.map(({ pair, summary }) => ({ type: pair.type, legacyId: pair.legacy._id, rich: pair.rich, referencesBefore: summary }))
  );
  backup.save(); // every TMDB copy is on disk before any reference moves

  for (const pair of pairs) {
    const changed = await moveReferences(db, {
      from: pair.rich._id,
      to: pair.legacy._id,
      references: refs.get(String(pair.rich._id)),
      backup,
      onRaterChanged: (user) => changedRaters.add(user),
    });
    log(`  moved   ${describe(pair.type, pair.rich)}: ${formatChanges(changed)}`);
  }
  await addRatersOf(db, pairs.map((pair) => pair.legacy._id), changedRaters);

  for (const type of new Set(pairs.map((pair) => pair.type))) {
    const docs = pairs.filter((pair) => pair.type === type).map((pair) => pair.rich);
    const { deleted, kept } = await deleteUnreferenced(db, SHAPE[type].collection, docs, HAS_TMDB);
    result.deleted.push(...deleted.map((doc) => ({ type, doc })));
    result.kept.push(...kept.map((entry) => ({ type, ...entry })));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Step 3 — groups with several legacy copies
// ---------------------------------------------------------------------------

export async function loadDuplicateGroups(db, ambiguous) {
  const groups = [];
  for (const entry of ambiguous) {
    const ids = [entry.rich._id, ...entry.legacy.map((doc) => doc._id)];
    const docs = await db.collection(SHAPE[entry.type].collection).find({ _id: { $in: ids } }).sort({ _id: 1 }).toArray();
    groups.push({ type: entry.type, title: describe(entry.type, entry.rich), docs });
  }
  return groups;
}

// What makes two catalogue records "the same film" for an automatic merge.
const identityOf = (type, doc) =>
  JSON.stringify([
    SHAPE[type].titleOf(doc) ?? null,
    doc[SHAPE[type].dateField] ?? null,
    doc.poster_path ?? null,
    doc.overview ?? null,
    [...(doc.genre_ids ?? [])].sort((a, b) => a - b),
  ]);

/**
 * The automatic rule for a group: keep the oldest legacy document and merge
 * the rest into it.
 *
 * With nobody reviewing, it only does so when the legacy copies are the same
 * record — identical title, date, poster, overview and genres. Two legacy
 * documents that differ in any of those could be different films sharing a
 * title and release date, and merging those would move one film's ratings and
 * watch history onto another. Such a group is skipped and reported.
 */
export function chooseOldestLegacy(group) {
  const legacy = group.docs
    .filter((doc) => !hasTmdbId(doc))
    .sort((a, b) => (String(a._id) < String(b._id) ? -1 : 1));
  if (legacy.length < 2) return { skip: "it no longer has two or more legacy documents" };
  if (new Set(legacy.map((doc) => identityOf(group.type, doc))).size !== 1) {
    return { skip: "its legacy documents differ in title, date, poster, overview or genres, so they may be different films" };
  }
  const keeper = legacy[0];
  return { keeper, others: group.docs.filter((doc) => String(doc._id) !== String(keeper._id)) };
}

/**
 * For each plan ({ group, keeper, others }): moves every reference from the
 * other documents onto the keeper, then deletes the others nothing references
 * any more. The keeper is never written.
 */
export async function mergeDuplicateGroups(db, { plans, apply, backup, changedRaters, log }) {
  const result = { perDocument: [], deleted: [], kept: [] };
  if (plans.length === 0) return result;

  const refs = await findReferences(db, plans.flatMap((plan) => plan.others.map((doc) => doc._id)));
  for (const plan of plans) {
    for (const other of plan.others) {
      result.perDocument.push({ plan, doc: other, summary: summarize(refs.get(String(other._id))) });
    }
  }
  if (!apply) return result;

  if (!backup) throw new Error("Refusing to merge duplicate groups without a backup.");
  (backup.data.mergeGroups ??= []).push(
    ...plans.map((plan) => ({ type: plan.group.type, title: plan.group.title, keepId: plan.keeper._id, documents: plan.group.docs }))
  );
  backup.save(); // every document in every merged group is on disk first

  for (const plan of plans) {
    for (const other of plan.others) {
      const changed = await moveReferences(db, {
        from: other._id,
        to: plan.keeper._id,
        references: refs.get(String(other._id)),
        backup,
        onRaterChanged: (user) => changedRaters.add(user),
      });
      log(`  moved   ${plan.group.title}: ${other._id} -> ${plan.keeper._id}: ${formatChanges(changed)}`);
    }
    const collection = SHAPE[plan.group.type].collection;
    for (const [docs, guard] of [
      [plan.others.filter(hasTmdbId), HAS_TMDB],
      [plan.others.filter((doc) => !hasTmdbId(doc)), NO_TMDB],
    ]) {
      const { deleted, kept } = await deleteUnreferenced(db, collection, docs, guard);
      result.deleted.push(...deleted.map((doc) => ({ type: plan.group.type, doc })));
      result.kept.push(...kept.map((entry) => ({ type: plan.group.type, ...entry })));
    }
  }
  await addRatersOf(db, plans.map((plan) => plan.keeper._id), changedRaters);
  return result;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * After a run: are there still duplicates, are the deleted documents really
 * gone, and does anything still reference a deleted document?
 */
export async function verifyCleanup(db, { deleted }) {
  const after = await findAllTwinGroups(db);

  let stillPresent = 0;
  for (const type of new Set(deleted.map((entry) => entry.type))) {
    const ids = deleted.filter((entry) => entry.type === type).map((entry) => entry.doc._id);
    stillPresent += await db.collection(SHAPE[type].collection).countDocuments({ _id: { $in: ids } });
  }

  let dangling = 0;
  if (deleted.length > 0) {
    const refs = await findReferences(db, deleted.map((entry) => entry.doc._id));
    for (const references of refs.values()) dangling += referenceTotal(references);
  }

  return { pairs: after.pairs.length, ambiguous: after.ambiguous.length, stillPresent, dangling };
}
