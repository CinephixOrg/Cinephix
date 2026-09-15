// The whole catalogue cleanup in one unattended command, from backend/:
//
//   node scripts/masterCleanup.js
//
// No flags, no prompts, no manual review. In order, it:
//   1. builds the catalogue indexes declared on the Movie and Series models;
//   2. cleans up every twin pair (a legacy document plus one TMDB copy with the
//      same title and release date): moves every reference onto the legacy
//      document and deletes the TMDB copy;
//   3. resolves every group with several legacy copies automatically: keeps the
//      oldest legacy document, moves every reference onto it, deletes the rest;
//   4. rebuilds CineGraph for every user whose ratings moved;
//   5. verifies the result.
//
// It exits 0 only if the catalogue is verifiably clean, and 1 otherwise, with
// the reasons printed last — so it can run from a job runner as well as by hand.
//
// What stands in for manual review:
//   * A single backup file (backups/master-cleanup-<time>.json, Extended JSON)
//     receives every document before it is changed or deleted.
//   * Legacy documents that are kept are never written.
//   * Nothing is deleted while anything still references it: references are
//     counted again immediately before every delete.
//   * A group is merged automatically only when its legacy copies are identical
//     (title, date, poster, overview, genres). Legacy documents that differ could
//     be different films sharing a title and date; such a group is skipped and
//     reported instead of merged, and the run exits 1.
//   * Re-running is safe and finishes anything a previous run left behind.
//
// Deploy the fixed TMDB sync (services/tmdbSyncService.js) before running it,
// otherwise the old daily sync can create new twins afterwards; the script
// warns if twins were created in the last 48 hours.
//
// `--dry-run` runs every step's planning and writes nothing.

import "dotenv/config";
import mongoose from "mongoose";
import { connect, createBackup, describe, disconnect, rebuildCineGraphs } from "./lib/catalogReferences.js";
import {
  chooseOldestLegacy,
  cleanUpTwinPairs,
  ensureCatalogIndexes,
  findAllTwinGroups,
  loadDuplicateGroups,
  mergeDuplicateGroups,
  recentTwins,
  verifyCleanup,
} from "./lib/cleanupSteps.js";

const DRY_RUN = process.argv.includes("--dry-run");
const APPLY = !DRY_RUN;
const BACKUP_DIR = "backups";

const log = (line = "") => console.log(line);
const section = (title) => log(`\n=== ${title} ===`);

async function main() {
  const started = Date.now();
  const db = await connect();
  const problems = [];

  log(DRY_RUN ? "Catalogue cleanup — DRY RUN, nothing will be written" : "Catalogue cleanup");
  const backup = APPLY ? createBackup(BACKUP_DIR, "master-cleanup", { twinPairs: [], mergeGroups: [] }) : null;
  if (backup) log(`Backup file: ${backup.file}`);

  // ---- 1. Indexes ----------------------------------------------------------
  section("Step 1/5 — indexes");
  const indexes = await ensureCatalogIndexes([mongoose.connection.model("Movie"), mongoose.connection.model("Series")], { apply: APPLY, log });
  log(APPLY ? `  built ${indexes.built.length}, failed ${indexes.failed.length}` : `  ${indexes.missing.length} index(es) would be built`);
  // The cleanup itself doesn't depend on the indexes, so a failed build is
  // reported rather than allowed to stop the cleanup.
  for (const failure of indexes.failed) problems.push(`index ${failure.collection}.${failure.options.name} failed to build: ${failure.error}`);

  // ---- 2. Twin pairs -------------------------------------------------------
  section("Step 2/5 — twin pairs");
  const found = await findAllTwinGroups(db);
  log(`  ${found.pairs.length} twin pair(s); ${found.ambiguous.length} group(s) with several legacy copies (step 3)`);
  const recent = recentTwins(found.pairs);
  if (recent.length > 0) {
    log(`  WARNING: ${recent.length} twin(s) were created in the last 48 hours — if the fixed TMDB sync isn't deployed, new ones will follow.`);
  }
  for (const entry of found.skipped) {
    log(`  skipped ${describe(entry.type, entry.rich)}: ${entry.reason}`);
    problems.push(`${describe(entry.type, entry.rich)} (${entry.rich._id}) was not cleaned up: ${entry.reason}`);
  }

  const changedRaters = new Set();
  const twins = await cleanUpTwinPairs(db, { pairs: found.pairs, apply: APPLY, backup, changedRaters, log });
  log(`  references ${APPLY ? "moved" : "to move"} (documents per collection): ${JSON.stringify(twins.references)}`);
  log(`  users with both copies in their watched list: ${twins.conflicts.bothWatched}; users who rated both: ${twins.conflicts.bothRated}`);
  if (APPLY) log(`  TMDB copies deleted: ${twins.deleted.length}; kept: ${twins.kept.length}`);
  for (const entry of twins.kept) problems.push(`${describe(entry.type, entry.doc)} (${entry.doc._id}) was kept: ${entry.reason}`);

  // ---- 3. Groups with several legacy copies --------------------------------
  section("Step 3/5 — groups with several legacy copies");
  const groups = await loadDuplicateGroups(db, found.ambiguous);
  const plans = [];
  for (const group of groups) {
    const choice = chooseOldestLegacy(group);
    if (choice.skip) {
      log(`  skipped ${group.title}: ${choice.skip}`);
      problems.push(`${group.title} was not merged: ${choice.skip}`);
      continue;
    }
    log(`  ${group.title}: keep oldest legacy ${choice.keeper._id}; merge in ${choice.others.map((doc) => doc._id).join(", ")}`);
    plans.push({ group, ...choice });
  }
  const merged = await mergeDuplicateGroups(db, { plans, apply: APPLY, backup, changedRaters, log });
  if (!APPLY) {
    for (const entry of merged.perDocument) log(`    ${entry.doc._id} references to move: ${JSON.stringify(entry.summary)}`);
  } else {
    log(`  documents deleted: ${merged.deleted.length}; kept: ${merged.kept.length}`);
  }
  for (const entry of merged.kept) problems.push(`${describe(entry.type, entry.doc)} (${entry.doc._id}) was kept: ${entry.reason}`);

  // ---- 4. CineGraph --------------------------------------------------------
  section("Step 4/5 — CineGraph");
  if (!APPLY) {
    log("  not run in a dry run");
  } else if (changedRaters.size === 0) {
    log("  no ratings changed");
  } else {
    const failed = await rebuildCineGraphs(changedRaters);
    log(`  rebuilt for ${changedRaters.size - failed} user(s)${failed ? `, ${failed} failed` : ""}`);
    if (failed > 0) problems.push(`CineGraph rebuild failed for ${failed} user(s); it corrects itself on their next rating`);
  }

  // ---- 5. Verification -----------------------------------------------------
  section("Step 5/5 — verification");
  if (!APPLY) {
    log("  not run in a dry run");
  } else {
    const deleted = [...twins.deleted, ...merged.deleted];
    const check = await verifyCleanup(db, { deleted });
    const skippedGroups = groups.length - plans.length;
    log(`  twin pairs left: ${check.pairs}`);
    log(`  groups with several legacy copies left: ${check.ambiguous} (${skippedGroups} skipped on purpose)`);
    log(`  deleted documents still present: ${check.stillPresent}`);
    log(`  references still pointing at deleted documents: ${check.dangling}`);
    if (check.pairs > 0) problems.push(`${check.pairs} twin pair(s) remain`);
    if (check.ambiguous > skippedGroups) problems.push(`${check.ambiguous - skippedGroups} unexpected group(s) remain`);
    if (check.stillPresent > 0) problems.push(`${check.stillPresent} deleted document(s) are still present`);
    if (check.dangling > 0) problems.push(`${check.dangling} reference(s) point at deleted documents`);
  }

  // ---- Result --------------------------------------------------------------
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  section("Result");
  if (backup) log(`Backup file: ${backup.file}`);
  if (DRY_RUN) {
    log(`Dry run finished in ${seconds}s. Nothing was written.`);
    if (problems.length > 0) {
      log("A real run would report:");
      for (const problem of problems) log(`  - ${problem}`);
    }
    return;
  }
  if (problems.length === 0) {
    log(`The catalogue is clean. Finished in ${seconds}s.`);
    return;
  }
  log(`Finished in ${seconds}s with ${problems.length} issue(s):`);
  for (const problem of problems) log(`  - ${problem}`);
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("\nCleanup stopped with an error:", error);
    console.error("Everything changed so far is in the backup file, and re-running finishes the job.");
    process.exitCode = 1;
  })
  .finally(disconnect);
