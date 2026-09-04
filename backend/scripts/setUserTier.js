import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
dotenv.config();

const [, , emailOrUsername, tier] = process.argv;

if (!emailOrUsername || !["free", "plus", "premium", "dev"].includes(tier)) {
  console.error("Usage: node backend/scripts/setUserTier.js <email-or-username> <free|plus|premium|dev>");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

const user = await User.findOneAndUpdate(
  { $or: [{ email: emailOrUsername }, { username: emailOrUsername }] },
  { accountTier: tier, tierUpdatedAt: new Date() },
  { new: true }
);

console.log(user ? `${user.username} -> ${user.accountTier}` : "User not found");

await mongoose.disconnect();
