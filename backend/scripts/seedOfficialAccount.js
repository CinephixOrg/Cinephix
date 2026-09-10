// One-time (but safely re-runnable) script that creates the single official
// Cinephix account — the poster identity officialContentService.js uses for
// every auto-posted trivia/tip/poll/etc. Share. Idempotent: skips if the
// reserved username already exists.
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

await mongoose.connect(process.env.MONGO_URI, { dbName: "cleaned_db" });

const USERNAME = "cinephix";
const EMAIL = "official@cinephix.app";

const existing = await User.findOne({ username: USERNAME });
if (existing) {
  console.log(`Official account already exists (_id: ${existing._id}). Nothing to do.`);
} else {
  // Random, unusable password — this account never logs in through the
  // normal auth flow, only ever posts via officialContentService directly
  // against the model.
  const randomPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(randomPassword, salt);

  const official = await User.create({
    username: USERNAME,
    email: EMAIL,
    password: hashedPassword,
    isEmailVerified: true,
    isOfficial: true,
    // Deliberately NOT "premium"/"plus" — the official account isn't a paid
    // tier, it's a distinct identity marked only by isOfficial/the
    // checkmark badge. An earlier version set this to "premium" for the
    // gold-border post styling, but the user explicitly rejected that:
    // official posts shouldn't look like a Premium user's, so this stays
    // "free" until/unless a dedicated official visual treatment is designed.
    accountTier: "free",
    bio: "The official Cinephix account. Trivia, tips, polls and more. 🎬",
    visibility: "public",
  });
  console.log(`Created official account: ${official.username} (_id: ${official._id})`);
}

await mongoose.disconnect();
console.log("Done.");
