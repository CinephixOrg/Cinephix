// One-time migration for the private/public account feature's UI removal —
// forces every existing user to 'public' and clears any still-pending
// FollowRequest rows (the only kind left; accept/reject already delete the
// row on resolution) so no stray "Requests" tab or locked-profile screen
// can show up for anyone. The User.visibility field and its backend
// enforcement (isAuthorizedToView, followUser's private branch, etc.) are
// intentionally left in place — only the mobile UI entry points were
// removed, not the underlying capability.
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import FollowRequest from "../models/FollowRequest.js";
dotenv.config();

await mongoose.connect(process.env.MONGO_URI);

const userResult = await User.updateMany({ visibility: { $ne: "public" } }, { visibility: "public" });
const requestResult = await FollowRequest.deleteMany({});

console.log(`Set ${userResult.modifiedCount} user(s) to public.`);
console.log(`Cleared ${requestResult.deletedCount} pending follow request(s).`);

await mongoose.disconnect();
