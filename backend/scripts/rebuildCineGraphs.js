// Repairs every user's CineGraph in one unattended command, from backend/:
//
//   node scripts/rebuildCineGraphs.js
//
// 1. Normalizes rating and review contentIds to the String the schema
//    declares. About 2,800 seeded ratings store an ObjectId instead, and every
//    Mongoose query casts its filter to String, so the app could never find
//    them: not on removal, not on a title's page, not in the CineGraph pie.
//    Where a user has the same title rated in both forms, their most recent
//    rating is kept; the other is written to the backup, then deleted.
// 2. Rebuilds every user's CineGraph from their Watched List and ratings
//    (utils/cineGraph.js), clearing the drift the old incremental updates left.
// 3. Verifies: no ObjectId contentIds left, every user rebuilt.
//
// Exits 0 when everything verifies, 1 otherwise. Safe to re-run.
// `--dry-run` reports what would change and writes nothing.

import "dotenv/config";
import { connect, createBackup, disconnect, toOid } from "./lib/catalogReferences.js";
import { planRatingMerge } from "./lib/ratingMerge.js";
import { rebuildUserCineGraph } from "../utils/cineGraph.js";

const DRY_RUN = process.argv.includes("--dry-run");
const APPLY = !DRY_RUN;
const COLLECTIONS = ["ratings", "reviews"];

const log = (line = "") => console.log(line);

async function normalizeContentIds(db, name, { backup }) {
  const collection = db.collection(name);
  const objectIdDocs = await collection.find({ contentId: { $type: "objectId" } }).toArray();
  if (objectIdDocs.length === 0) return { objectIdDocs: 0, groupsInBothForms: 0, removed: 0, converted: 0 };

  const users = [...new Set(objectIdDocs.map((doc) => String(doc.user)))].map(toOid);
  const stringDocs = await collection
    .find({ user: { $in: users }, contentId: { $in: [...new Set(objectIdDocs.map((doc) => String(doc.contentId)))] } })
    .toArray();

  // Per user and title: the ObjectId-form documents, and any String-form ones.
  const groups = new Map();
  const groupOf = (doc) => {
    const key = `${doc.user}|${doc.contentId}`;
    if (!groups.has(key)) groups.set(key, { from: [], to: [] });
    return groups.get(key);
  };
  for (const doc of objectIdDocs) groupOf(doc).from.push(doc);
  for (const doc of stringDocs) groupOf(doc).to.push(doc);

  const remove = [];
  let groupsInBothForms = 0;
  for (const group of groups.values()) {
    // The String-form lookup above also returns a user's ratings for titles
    // where only some other user has an ObjectId-form rating. Those groups
    // have nothing to convert, so they're skipped rather than counted.
    if (group.from.length === 0) continue;
    if (group.to.length > 0) groupsInBothForms += 1;
    remove.push(...planRatingMerge(group.from, group.to).remove);
  }
  const removedIds = new Set(remove.map((doc) => String(doc._id)));
  const convert = objectIdDocs.filter((doc) => !removedIds.has(String(doc._id)));

  if (APPLY) {
    if (remove.length > 0) {
      backup.record(name, remove); // on disk before the delete
      await collection.deleteMany({ _id: { $in: remove.map((doc) => doc._id) } });
    }
    if (convert.length > 0) {
      await collection.updateMany(
        { _id: { $in: convert.map((doc) => doc._id) }, contentId: { $type: "objectId" } },
        [{ $set: { contentId: { $toString: "$contentId" } } }]
      );
    }
  }
  return { objectIdDocs: objectIdDocs.length, groupsInBothForms, removed: remove.length, converted: convert.length };
}

async function main() {
  const started = Date.now();
  const db = await connect();
  const problems = [];
  log(DRY_RUN ? "CineGraph repair — DRY RUN, nothing will be written" : "CineGraph repair");
  const backup = APPLY ? createBackup("backups", "rebuild-cinegraphs", {}) : null;
  if (backup) log(`Backup file: ${backup.file}`);

  log("\n=== Step 1/3 — rating and review contentIds ===");
  for (const name of COLLECTIONS) {
    const result = await normalizeContentIds(db, name, { backup });
    log(
      `  ${name}: ${result.objectIdDocs} stored as ObjectId; ${result.groupsInBothForms} also rated in String form; ` +
        `${APPLY ? "removed" : "would remove"} ${result.removed} older duplicate(s), ${APPLY ? "converted" : "would convert"} ${result.converted}`
    );
  }

  log("\n=== Step 2/3 — CineGraphs ===");
  const users = await db.collection("users").find({}, { projection: { _id: 1 } }).toArray();
  if (DRY_RUN) {
    log(`  would rebuild ${users.length} user(s)`);
  } else {
    let failed = 0;
    for (const user of users) {
      try {
        await rebuildUserCineGraph(user._id);
      } catch (error) {
        failed += 1;
        log(`  FAILED for user ${user._id}: ${error.message}`);
      }
    }
    log(`  rebuilt ${users.length - failed} of ${users.length} user(s)`);
    if (failed > 0) problems.push(`CineGraph rebuild failed for ${failed} user(s)`);
  }

  log("\n=== Step 3/3 — verification ===");
  if (DRY_RUN) {
    log("  not run in a dry run");
  } else {
    for (const name of COLLECTIONS) {
      const left = await db.collection(name).countDocuments({ contentId: { $type: "objectId" } });
      log(`  ${name} still stored as ObjectId: ${left}`);
      if (left > 0) problems.push(`${left} ${name} still store an ObjectId contentId`);
    }
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  log("\n=== Result ===");
  if (backup) log(`Backup file: ${backup.file}`);
  if (DRY_RUN) {
    log(`Dry run finished in ${seconds}s. Nothing was written.`);
  } else if (problems.length === 0) {
    log(`Every CineGraph is rebuilt and every contentId is a String. Finished in ${seconds}s.`);
  } else {
    log(`Finished in ${seconds}s with ${problems.length} issue(s):`);
    for (const problem of problems) log(`  - ${problem}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("\nRepair stopped with an error:", error);
    console.error("Anything deleted so far is in the backup file, and re-running finishes the job.");
    process.exitCode = 1;
  })
  .finally(disconnect);
