// One-off, re-runnable backfill for the dev/test database — NOT for
// production. Direct ask: every existing CustomList should have a real
// description, since DiscoverListCard.tsx now only renders a description
// block when one exists, and a description-less list read as an obviously
// unfinished/empty card next to the ones the seed scripts already give a
// real description to. Only touches lists whose description is currently
// empty/missing — never overwrites a real, user-written one. Picks a
// description template based on how many items the list actually has (a
// 20-item list reads oddly with a "just a couple of favorites" line), so
// this isn't one generic sentence copy-pasted onto every list.
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import CustomList from "../models/CustomList.js";

await mongoose.connect(process.env.MONGO_URI);

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function choice(arr) {
  return arr[randInt(0, arr.length - 1)];
}

const SMALL_LIST_DESCRIPTIONS = [
  "A handful of titles I keep coming back to.",
  "Small list, big opinions — every one of these earned its spot.",
  "Not many titles yet, but each one's a real favorite.",
  "Just a few, but I'd defend every single pick here.",
];
const MEDIUM_LIST_DESCRIPTIONS = [
  "A running collection of titles worth everyone's time.",
  "Picks I keep recommending to anyone who'll listen.",
  "A mix I put together over time — a little of everything.",
  "The ones that stuck with me long after the credits rolled.",
  "Curated slowly, watched carefully — this is the result.",
];
const LARGE_LIST_DESCRIPTIONS = [
  "A big, ever-growing collection — dig in whenever you've got time.",
  "Built up over a long time; there's something here for every mood.",
  "The full archive of everything I'd actually tell you to watch.",
  "A deep list — worth scrolling through slowly, not all at once.",
];

const lists = await CustomList.find({ $or: [{ description: "" }, { description: { $exists: false } }] })
  .select("_id items")
  .lean();

let updated = 0;
for (const list of lists) {
  const count = (list.items || []).length;
  const pool = count <= 4 ? SMALL_LIST_DESCRIPTIONS : count <= 10 ? MEDIUM_LIST_DESCRIPTIONS : LARGE_LIST_DESCRIPTIONS;
  await CustomList.updateOne({ _id: list._id }, { $set: { description: choice(pool) } });
  updated++;
}

console.log(`Backfilled descriptions on ${updated} of ${lists.length} description-less lists.`);

await mongoose.disconnect();
