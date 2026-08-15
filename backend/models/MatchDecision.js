import mongoose from 'mongoose';

const { Schema } = mongoose;

// One row per swipe action — never updated in place, so the history of
// swipes (needed for the daily swipe-count limit) and the *current* verdict
// on a person (the most recent row for that user/targetUser/contentType
// triple) can both be read from the same collection.
const matchDecisionSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetUser: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contentType: {
    type: String,
    enum: ['movie', 'series'],
    required: true
  },
  decision: {
    type: String,
    enum: ['accept', 'reject'],
    required: true
  },
  // Captured at swipe time so the Rejected list can render a percentage
  // without re-running the full scoring pass against every rejected user.
  matchPercentage: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Daily swipe-count queries: "how many rows did this user create today".
matchDecisionSchema.index({ user: 1, createdAt: -1 });
// Latest-decision-per-target lookups: candidate exclusion, rejected list,
// re-swipe (accept from the rejected list) — always scoped to one user.
matchDecisionSchema.index({ user: 1, targetUser: 1, createdAt: -1 });

const MatchDecision = mongoose.model('MatchDecision', matchDecisionSchema);

export default MatchDecision;
