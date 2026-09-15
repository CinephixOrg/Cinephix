// Step 2 of the catalogue cleanup on its own: removes duplicate TMDB copies of
// legacy catalogue documents without breaking anything that points at either.
// scripts/masterCleanup.js runs this automatically; this script is for running
// or inspecting just this step.
//
// A twin pair is one legacy document (no TMDB id) and one later document with a
// TMDB id sharing its title and release date. Every reference to the TMDB copy
// is moved onto the legacy document (where a user already referenced both, the
// duplicate is removed and a duplicate rating or review is backed up first),
// then the TMDB copy is deleted once nothing references it. Legacy documents
// are never written.
//
// Usage (from backend/):
//   node scripts/rollbackCatalogTwins.js                      dry run: report only, no writes
//   node scripts/rollbackCatalogTwins.js --apply --limit 5    clean up the first 5 pairs
//   node scripts/rollbackCatalogTwins.js --apply              clean up every pair
// Options:
//   --type movie|series|all      default all
//   --created-from YYYY-MM-DD    only TMDB copies created on or after this day
//   --created-to YYYY-MM-DD      only TMDB copies created on or before this day
//   --limit N                    only the first N pairs
//   --backup-dir <path>          default ./backups

import "dotenv/config";
import { connect, createBackup, createdAt, day, describe, disconnect, parseArgs, parseDay, rebuildCineGraphs } from "./lib/catalogReferences.js";
import { cleanUpTwinPairs, findAllTwinGroups, recentTwins } from "./lib/cleanupSteps.js";

const { flag, option } = parseArgs(process.argv.slice(2));
const APPLY = flag("--apply");
const TYPE_OPTION = option("--type") ?? "all";
const LIMIT = option("--limit") ? Number(option("--limit")) : Infinity;
const BACKUP_DIR = option("--backup-dir") ?? "backups";
const CREATED_FROM = parseDay(option("--created-from"), false);
const CREATED_TO = parseDay(option("--created-to"), true);

if (!["movie", "series", "all"].includes(TYPE_OPTION)) throw new Error("--type must be movie, series or all");
if (!(LIMIT > 0)) throw new Error("--limit must be a positive number");
const TYPES = TYPE_OPTION === "all" ? ["movie", "series"] : [TYPE_OPTION];

async function main() {
  const db = await connect();
  console.log(APPLY ? "MODE: APPLY — references will be moved and TMDB copies deleted" : "MODE: DRY RUN — nothing will be written");

  const found = await findAllTwinGroups(db, { types: TYPES, createdFrom: CREATED_FROM, createdTo: CREATED_TO });
  for (const type of TYPES) {
    const pairs = found.pairs.filter((pair) => pair.type === type);
    const days = {};
    for (const pair of pairs) days[day(createdAt(pair.rich._id))] = (days[day(createdAt(pair.rich._id))] ?? 0) + 1;
    console.log(`\n[${type}] twin pairs: ${pairs.length}   TMDB copies created on: ${JSON.stringify(days)}`);
  }
  for (const group of found.ambiguous) {
    console.log(`SKIPPED (several legacy copies — step 3): ${describe(group.type, group.rich)}, TMDB ${group.rich._id} vs legacy ${group.legacy.map((d) => d._id).join(", ")}`);
  }
  for (const entry of found.skipped) console.log(`SKIPPED ${describe(entry.type, entry.rich)}: ${entry.reason}`);

  let pairs = found.pairs;
  if (pairs.length > LIMIT) pairs = pairs.slice(0, LIMIT);
  const recent = recentTwins(pairs);
  if (recent.length > 0) {
    console.log(`\nWARNING: ${recent.length} TMDB copy(ies) were created in the last 48 hours. If the fixed TMDB sync isn't deployed yet, new ones will keep appearing.`);
  }
  if (pairs.length === 0) {
    console.log("\nNo twin pairs to clean up.");
    return;
  }

  const backup = APPLY
    ? createBackup(BACKUP_DIR, "rollback-catalog-twins", {
        options: { TYPES, LIMIT: Number.isFinite(LIMIT) ? LIMIT : null, CREATED_FROM, CREATED_TO },
        twinPairs: [],
      })
    : null;
  if (backup) console.log(`\nBackup file: ${backup.file}`);

  const changedRaters = new Set();
  const result = await cleanUpTwinPairs(db, { pairs, apply: APPLY, backup, changedRaters, log: console.log });

  if (!APPLY) {
    console.log(`\nWould clean up ${pairs.length} pair(s).`);
    console.log(`References to move (documents per collection): ${JSON.stringify(result.references)}`);
    console.log(`Users with both copies in their watched list (duplicate removed, earliest date kept): ${result.conflicts.bothWatched}`);
    console.log(`Users who rated both copies (most recent rating kept, the other backed up, then removed): ${result.conflicts.bothRated}`);
    console.log("\nPairs:");
    for (const { pair, summary } of result.perPair) {
      console.log(`  ${describe(pair.type, pair.rich)}  TMDB ${pair.rich._id} (${day(createdAt(pair.rich._id))}) -> legacy ${pair.legacy._id}  ${JSON.stringify(summary)}`);
    }
    console.log("\nNothing was written. Re-run with --apply to perform the cleanup.");
    return;
  }

  if (changedRaters.size > 0) {
    console.log(`\nRebuilding CineGraph for ${changedRaters.size} user(s) whose ratings changed...`);
    await rebuildCineGraphs(changedRaters);
  }
  console.log(`\nDone: ${result.deleted.length} TMDB copy(ies) deleted, ${result.kept.length} kept.`);
  for (const entry of result.kept) console.log(`  kept ${describe(entry.type, entry.doc)} ${entry.doc._id}: ${entry.reason}. Re-run to finish it.`);
  console.log(`Backup file: ${backup.file}`);
}

main()
  .catch((error) => {
    console.error("Rollback failed:", error);
    process.exitCode = 1;
  })
  .finally(disconnect);
