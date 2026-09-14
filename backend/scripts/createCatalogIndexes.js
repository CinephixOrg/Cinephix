// Step 1 of the catalogue cleanup on its own: builds the indexes declared in
// models/Movie.js and models/Series.js. scripts/masterCleanup.js runs this
// automatically; this script is for running or inspecting just this step.
//
// Usage (from backend/):
//   node scripts/createCatalogIndexes.js           plan: what exists, what's missing, current query plans (read-only)
//   node scripts/createCatalogIndexes.js --apply   build the missing indexes, one at a time
//
// Production notes:
//   * `background: true` isn't sent because it does nothing: since MongoDB 4.2
//     every build holds an exclusive lock only briefly at the start and end,
//     and reads and writes continue in between.
//   * On an Atlas dedicated cluster (M10+) the lowest-impact option is a
//     rolling build (Atlas UI > Collections > Indexes > "Build index via
//     rolling process"); plan mode prints the specs to use there.
//   * Existing indexes are never dropped or modified.

import "dotenv/config";
import mongoose from "mongoose";
import { connect, disconnect } from "./lib/catalogReferences.js";
import { ensureCatalogIndexes } from "./lib/cleanupSteps.js";

const APPLY = process.argv.includes("--apply");

async function main() {
  await connect();
  console.log(APPLY ? "MODE: APPLY — missing indexes will be built" : "MODE: PLAN — nothing will be built");

  const report = await ensureCatalogIndexes([mongoose.connection.model("Movie"), mongoose.connection.model("Series")], {
    apply: APPLY,
    log: console.log,
  });

  if (!APPLY) {
    if (report.missing.length > 0) {
      console.log("\nmongosh equivalent (or paste these specs into an Atlas rolling build):");
      for (const index of report.missing) {
        console.log(`  db.getSiblingDB("cleaned_db").${index.collection}.createIndex(${JSON.stringify(index.key)}, ${JSON.stringify(index.options)})`);
      }
    }
    console.log(`\nNothing was built. Re-run with --apply to build ${report.missing.length} missing index(es).`);
  } else {
    console.log(`\nBuilt ${report.built.length}, failed ${report.failed.length}.`);
    if (report.failed.length > 0) process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Index build failed:", error);
    process.exitCode = 1;
  })
  .finally(disconnect);
