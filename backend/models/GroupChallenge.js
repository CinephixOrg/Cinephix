import mongoose from "mongoose";
const { Schema } = mongoose;

// Snapshot shape (itemId as String) matches Rating.contentId's own type —
// deliberately NOT CustomList's listItemSchema (ObjectId itemId), since a
// challenge's whole point is comparing its own item list directly against
// each member's Rating documents for progress, with no extra $convert step.
const challengeItemSchema = new Schema(
  {
    itemId: { type: String, required: true },
    itemType: { type: String, enum: ["movie", "series"], required: true },
    title: String,
    posterUrl: String,
  },
  { _id: false }
);

// A community's own admin-created challenge ("30 Günde 30 Korku Filmi") —
// a fixed list of titles the owner picked from the catalog (reusing
// shareController.js's hydrateContentData, same as a Group poll's own
// options) plus a deadline. Progress is never stored here: it's computed
// on read by intersecting `items` against a member's own Rating documents
// (groupController.js's getGroupChallenge) — Rating already doubles as
// this app's "watched" signal everywhere else (badgeController.js's genre/
// volume badges), so no separate progress-tracking write path is needed.
const groupChallengeSchema = new Schema(
  {
    group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    items: { type: [challengeItemSchema], required: true },
    deadline: { type: Date, required: true },
  },
  { timestamps: true }
);

groupChallengeSchema.index({ group: 1, createdAt: -1 });

const GroupChallenge = mongoose.model("GroupChallenge", groupChallengeSchema);
export default GroupChallenge;
