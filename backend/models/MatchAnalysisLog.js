import mongoose from "mongoose";
const { Schema } = mongoose;

// Append-only log of "user X ran a CineMatch Analyze against user Y at time
// Z" — purely to enforce a per-pair cooldown on analyzeMatchWithUser
// (matchController.js), which previously had none at all: unlike Profile
// Analysis (userController.js:getProfileAnalysis, gated by
// analysisCooldownHours + ProfileAnalysis), the CineMatch "Analyze" button
// could be spammed with zero throttling, each tap burning a real LLM call
// (Groq/Gemini/etc.) for what's usually an identical result — the underlying
// data (CineGraph, ratings, favorites, social graph) rarely changes minute
// to minute. Deliberately scoped per (user, targetUser) pair, not one
// cooldown per user globally — the legitimate use case is analyzing several
// *different* candidates in one browsing session, only re-analyzing the
// *same* one repeatedly should be throttled. No `result` field stored (unlike
// ProfileAnalysis, which reuses its last result in the next prompt) — this
// endpoint has no such continuity today, this log exists purely for timing.
const matchAnalysisLogSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  targetUser: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
  // Snapshotted matchPercentage (0-100) at analyze time — added for the
  // "High Match" badge (badgeController.js), which needs to know the best
  // score a user has EVER reached, not just their most recent one. Optional
  // and absent on every log row created before this field existed; the
  // badge's own compute function treats a missing score the same as any
  // other row that didn't clear the threshold, not an error.
  score: { type: Number, min: 0, max: 100 },
  // Which UI entry point triggered this analysis — "sync" (the Sync page's
  // own Analyze button, the default) or "profile" (a public profile's Sync
  // Score card ⓘ). Added so analyzeMatchWithUser can enforce a SEPARATE,
  // stricter Free/Plus/Premium gate on the "profile" entry point (direct
  // ask: block Free entirely, cap Plus per week) without touching the Sync
  // page's own existing per-pair-cooldown gate, which stays exactly as it
  // was for every tier. Absent on every row created before this field
  // existed — those are all "sync" in effect (this field didn't exist yet
  // to distinguish anything), so the query that counts "profile" rows for
  // the weekly quota naturally never counts them.
  source: { type: String, enum: ["sync", "profile"], default: "sync" },
});

// "Most recent analysis of this exact pair" is the only query this model
// ever serves.
matchAnalysisLogSchema.index({ user: 1, targetUser: 1, createdAt: -1 });
// The weekly "profile" quota's own query shape — every profile-sourced row
// for one user within the current week.
matchAnalysisLogSchema.index({ user: 1, source: 1, createdAt: -1 });

const MatchAnalysisLog = mongoose.model("MatchAnalysisLog", matchAnalysisLogSchema);
export default MatchAnalysisLog;
