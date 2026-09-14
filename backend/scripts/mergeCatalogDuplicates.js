// Step 3 of the catalogue cleanup on its own: groups where a TMDB copy matches
// two or more legacy documents with the same title and release date.
// scripts/masterCleanup.js resolves these automatically (keeping the oldest
// legacy document); this script is for reviewing them, or merging with a
// different choice of document to keep.
//
// Review (read-only):
//   node scripts/mergeCatalogDuplicates.js
// prints every document in each group side by side — which fields differ and
// what references each one — and the document the automatic rule would keep.
//
// Merge with an explicit choice:
//   node scripts/mergeCatalogDuplicates.js --apply --keep <legacyId>[,<legacyId>...]
// Groups without a --keep id are left untouched. A --keep id that isn't a legacy
// document in exactly one group aborts the run before anything is written.
//
// Options: --backup-dir <path> (default ./backups)

import "dotenv/config";
import mongoose from "mongoose";
import { connect, createBackup, createdAt, disconnect, findReferences, hasTmdbId, parseArgs, rebuildCineGraphs, summarize } from "./lib/catalogReferences.js";
import { chooseOldestLegacy, findAllTwinGroups, loadDuplicateGroups, mergeDuplicateGroups } from "./lib/cleanupSteps.js";

const { EJSON } = mongoose.mongo.BSON;
const { flag, option } = parseArgs(process.argv.slice(2));
const APPLY = flag("--apply");
const KEEP = (option("--keep") ?? "").split(",").map((id) => id.trim()).filter(Boolean);
const BACKUP_DIR = option("--backup-dir") ?? "backups";

if (APPLY && KEEP.length === 0) throw new Error("--apply needs --keep <legacyId>[,<legacyId>...]. To keep the oldest legacy document automatically, run scripts/masterCleanup.js.");

const short = (value) => {
  const text = EJSON.stringify(value ?? null);
  return text.length > 70 ? `${text.slice(0, 67)}...` : text;
};

function printGroup(group, refs, choice) {
  console.log(`\n=== ${group.title} [${group.type}] — ${group.docs.length} documents ===`);
  for (const doc of group.docs) {
    const kind = hasTmdbId(doc) ? `TMDB ${doc.tmdb_id ?? doc.id?.tmdb}` : "legacy";
    const marker = choice.keeper && String(doc._id) === String(choice.keeper._id) ? "  <- automatic rule keeps this" : "";
    console.log(`  ${doc._id}  ${kind.padEnd(12)} created ${createdAt(doc._id).toISOString().slice(0, 16)}  references ${JSON.stringify(summarize(refs.get(String(doc._id))))}${marker}`);
  }

  const keys = [...new Set(group.docs.flatMap((doc) => Object.keys(doc)))].filter((k) => k !== "_id" && k !== "__v").sort();
  const identical = keys.filter((key) => new Set(group.docs.map((doc) => EJSON.stringify(doc[key] ?? null))).size === 1);
  const differing = keys.filter((key) => !identical.includes(key));
  console.log(`  identical in every document: ${identical.join(", ") || "(none)"}`);
  if (differing.length > 0) {
    console.log("  differing fields:");
    for (const key of differing) {
      console.log(`    ${key}:`);
      for (const doc of group.docs) console.log(`      ${doc._id}: ${short(doc[key])}`);
    }
  }
  console.log(choice.skip ? `  automatic rule: SKIP — ${choice.skip}` : `  automatic rule: keep ${choice.keeper._id}, merge in ${choice.others.map((d) => d._id).join(", ")}`);
}

async function main() {
  const db = await connect();
  console.log(APPLY ? "MODE: APPLY" : "MODE: REVIEW — nothing will be written");

  const { ambiguous } = await findAllTwinGroups(db);
  const groups = await loadDuplicateGroups(db, ambiguous);
  if (groups.length === 0) {
    console.log("\nNo groups with several legacy copies.");
    return;
  }

  if (!APPLY) {
    const refs = await findReferences(db, groups.flatMap((group) => group.docs.map((doc) => doc._id)));
    const automaticKeeps = [];
    for (const group of groups) {
      const choice = chooseOldestLegacy(group);
      printGroup(group, refs, choice);
      if (choice.keeper) automaticKeeps.push(String(choice.keeper._id));
    }
    console.log("\nNothing was written. scripts/masterCleanup.js applies the automatic rule above; to merge by hand with the same choices:");
    console.log(`  node scripts/mergeCatalogDuplicates.js --apply --keep ${automaticKeeps.join(",")}`);
    return;
  }

  const plans = [];
  for (const keepId of KEEP) {
    const matches = groups.filter((group) => group.docs.some((doc) => String(doc._id) === keepId));
    if (matches.length !== 1) throw new Error(`--keep ${keepId} is not a document in exactly one group. Nothing was written.`);
    const group = matches[0];
    const keeper = group.docs.find((doc) => String(doc._id) === keepId);
    if (hasTmdbId(keeper)) throw new Error(`--keep ${keepId} is the TMDB copy in "${group.title}"; keep a legacy document. Nothing was written.`);
    if (plans.some((plan) => plan.group === group)) throw new Error(`Two --keep ids are in the same group "${group.title}". Nothing was written.`);
    plans.push({ group, keeper, others: group.docs.filter((doc) => String(doc._id) !== keepId) });
  }

  const backup = createBackup(BACKUP_DIR, "merge-catalog-duplicates", { mergeGroups: [] });
  console.log(`\nBackup file: ${backup.file}`);
  const changedRaters = new Set();
  const result = await mergeDuplicateGroups(db, { plans, apply: true, backup, changedRaters, log: console.log });

  if (changedRaters.size > 0) {
    console.log(`\nRebuilding CineGraph for ${changedRaters.size} user(s) whose ratings changed...`);
    await rebuildCineGraphs(changedRaters);
  }
  console.log(`\nDone: ${result.deleted.length} document(s) deleted, ${result.kept.length} kept, across ${plans.length} group(s).`);
  for (const entry of result.kept) console.log(`  kept ${entry.doc._id}: ${entry.reason}`);
  console.log(`Backup file: ${backup.file}`);
}

main()
  .catch((error) => {
    console.error("Merge failed:", error.message);
    process.exitCode = 1;
  })
  .finally(disconnect);
