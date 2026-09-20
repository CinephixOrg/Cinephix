import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
// backend/.env, wherever this is run from.
dotenv.config({ path: new URL("../.env", import.meta.url).pathname });

// Grants or revokes access to the moderation API (/api/admin). The only way
// to become an admin — no endpoint can set this.
//
//   node backend/scripts/setAdmin.js <email-or-username> <on|off>

const [, , emailOrUsername, flag] = process.argv;

if (!emailOrUsername || !["on", "off"].includes(flag)) {
  console.error("Usage: node backend/scripts/setAdmin.js <email-or-username> <on|off>");
  process.exit(1);
}

// Same database as the server; no index builds from a one-off script.
await mongoose.connect(process.env.MONGO_URI, { dbName: "cleaned_db", autoIndex: false });

const user = await User.findOneAndUpdate(
  { $or: [{ email: emailOrUsername }, { username: emailOrUsername }] },
  { $set: { isAdmin: flag === "on" } },
  { new: true }
).select("username isAdmin");

console.log(user ? `${user.username} -> isAdmin: ${user.isAdmin}` : "User not found");

await mongoose.disconnect();
