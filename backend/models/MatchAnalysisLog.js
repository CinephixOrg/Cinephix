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
});

// "Most recent analysis of this exact pair" is the only query this model
// ever serves.
matchAnalysisLogSchema.index({ user: 1, targetUser: 1, createdAt: -1 });

const MatchAnalysisLog = mongoose.model("MatchAnalysisLog", matchAnalysisLogSchema);
export default MatchAnalysisLog;
