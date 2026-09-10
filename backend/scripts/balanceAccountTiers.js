// One-off, re-runnable dev/test-database script — NOT for production.
// Direct ask: distribute real free/plus/premium tiers across the user base
// so the tier-gated UI (podium blur, avatar rings, gradient usernames,
// Premium gold post-frame, etc.) has all three tiers actually visible
// while testing, not just the handful of accounts someone happened to set
// by hand before. Most users had no accountTier set at all (schema default
// 'free' never actually got backfilled onto them at the DB level), so this
// is a real, needed distribution, not just a rebalance.
// Leaves untouched: the 3 real `dev`-tier accounts (Peter.Altenwerth29467,
// Nurelski, furkangg07 — internal/dev markers, not part of the free/plus/
// premium spectrum) and Zachary.Macejkovic73330 specifically, since he's
// one of this project's two standing named test accounts and other rounds
// of testing assume his current tier (premium) — reassigning him at
// random here would silently break that assumption elsewhere.
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import User from "../models/User.js";

await mongoose.connect(process.env.MONGO_URI);

const ZACHARY_ID = "691f53a845194a18bc31db24";

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const users = await User.find({ accountTier: { $ne: "dev" }, _id: { $ne: ZACHARY_ID } })
  .select("_id")
  .lean();
const ids = shuffle(users.map((u) => u._id.toString()));

const third = Math.ceil(ids.length / 3);
const freeIds = ids.slice(0, third);
const plusIds = ids.slice(third, third * 2);
const premiumIds = ids.slice(third * 2);

const now = new Date();
await User.updateMany({ _id: { $in: freeIds } }, { $set: { accountTier: "free", tierUpdatedAt: now } });
await User.updateMany({ _id: { $in: plusIds } }, { $set: { accountTier: "plus", tierUpdatedAt: now } });
await User.updateMany({ _id: { $in: premiumIds } }, { $set: { accountTier: "premium", tierUpdatedAt: now } });

console.log(`Distributed ${ids.length} users: ${freeIds.length} free, ${plusIds.length} plus, ${premiumIds.length} premium (dev accounts and Zachary left untouched).`);

await mongoose.disconnect();
