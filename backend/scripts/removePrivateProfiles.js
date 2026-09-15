// One-time cleanup after removing private accounts and follow requests —
// every profile is public. From backend/:
//
//   node scripts/removePrivateProfiles.js
//   node scripts/removePrivateProfiles.js --dry-run
//
//   * removes the old `visibility` field from every user
//   * drops the followrequests collection
//   * deletes follow_request and follow_accepted notifications
//
// Safe to re-run. Replaces setAllProfilesPublic.js, which only hid the feature.

import "dotenv/config";
import { connect, disconnect } from "./lib/catalogReferences.js";

const DRY_RUN = process.argv.includes("--dry-run");
const LEGACY_TYPES = ["follow_request", "follow_accepted"];

async function main() {
  const db = await connect();
  const users = db.collection("users");
  const notifications = db.collection("notifications");

  const [withVisibility, legacyNotifications, requestCollections] = await Promise.all([
    users.countDocuments({ visibility: { $exists: true } }),
    notifications.countDocuments({ type: { $in: LEGACY_TYPES } }),
    db.listCollections({ name: "followrequests" }).toArray(),
  ]);
  const requestCount = requestCollections.length > 0 ? await db.collection("followrequests").countDocuments() : null;

  console.log(DRY_RUN ? "DRY RUN — nothing will be written." : "Removing private-profile data.");
  console.log(`  users with a visibility field:   ${withVisibility}`);
  console.log(`  follow requests:                 ${requestCount === null ? "none (no collection)" : requestCount}`);
  console.log(`  request notifications to delete: ${legacyNotifications}`);
  if (DRY_RUN) return;

  await users.updateMany({ visibility: { $exists: true } }, { $unset: { visibility: "" } });
  if (requestCount !== null) await db.collection("followrequests").drop();
  await notifications.deleteMany({ type: { $in: LEGACY_TYPES } });
  console.log("Done.");
}

main()
  .catch((error) => {
    console.error("Cleanup failed:", error.message);
    process.exitCode = 1;
  })
  .finally(disconnect);
