import mongoose from "mongoose";
const { Schema } = mongoose;

// Append-only log of "user X ran a Sync search at time Z" — enforces the
// per-day sync-search quota (config/tiers.js's syncSearchesPerDay: 1 for
// Free, 3 for Plus, a generous 15 for Premium purely as an LLM-cost safety
// cap). One entry per getSyncCandidates call, regardless of contentType —
// movies and series deliberately share a single daily quota rather than
// each getting their own, since Free can't even pick a type (no
// canUseMatchFilters) and the quota is about how many fresh candidate
// queues you pull per day, not about movies vs series specifically.
const syncSearchLogSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

// "How many has this user run since midnight" is the only query this model
// ever serves.
syncSearchLogSchema.index({ user: 1, createdAt: -1 });

const SyncSearchLog = mongoose.model("SyncSearchLog", syncSearchLogSchema);
export default SyncSearchLog;
