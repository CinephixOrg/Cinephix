// One-off, re-runnable dev/test-database fix — NOT for production. Direct
// bug report: list-type Shares in Medya only ever showed ~5 posters in
// their film strip even when the underlying list had far more, and there
// was nothing to scroll to reveal the rest. Root cause: seedMedyaActivity.js's
// own list-share creation step built `listData.previewItems` with a
// hardcoded `.slice(0, 5)`, unlike the real `POST /shares` list-share
// endpoint (shareController.js), which already deliberately uses
// `hydratePreviewItems(list, 20)` — "Bigger limit than the default 5...
// not a fixed small preview count," per that endpoint's own comment. So
// this was never a real ShareCard.tsx scroll bug (its film strip already
// correctly uses a react-native-gesture-handler ScrollView); the box just
// never had more than 5 items to scroll through in the first place.
// Re-hydrates every existing `type: "list"` Share's `listData.previewItems`
// using the exact same `hydratePreviewItems` helper the real endpoint
// uses, so seeded posts end up with the identical shape a real user's
// list-share would have gotten.
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Share from "../models/Share.js";
import CustomList from "../models/CustomList.js";
import { hydratePreviewItems } from "../routes/customListRoute.js";

await mongoose.connect(process.env.MONGO_URI);

const listShares = await Share.find({ type: "list" }).select("_id listId listData").lean();
let updated = 0,
  skippedMissingList = 0;

for (const share of listShares) {
  const list = await CustomList.findById(share.listId).lean();
  if (!list) {
    skippedMissingList++;
    continue;
  }
  const [hydrated] = await hydratePreviewItems([list], 20);
  await Share.updateOne(
    { _id: share._id },
    {
      $set: {
        "listData.previewItems": hydrated.previewItems,
        "listData.itemCount": list.items.length,
        "listData.description": list.description,
      },
    }
  );
  updated++;
}

console.log(`Re-hydrated previewItems on ${updated} list-shares (${skippedMissingList} skipped — underlying list no longer exists).`);
await mongoose.disconnect();
