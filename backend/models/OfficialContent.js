import mongoose from "mongoose";
const { Schema } = mongoose;

// The persistent pool backing officialContentService's rotation for the
// categories that need hand-authored content (trivia_rich/tip/poll/
// announcement) — highlight/on_this_day/stats are generated fresh from live
// data at post time and never stored here.
//
// status supports the agreed fixed-size rotation for trivia_rich: "active"
// docs are the current pool, "pending" docs are newly authored ones waiting
// for room to open up, "retired" docs are soft-removed (kept for history/
// reversibility, never hard-deleted) once replaced. Other categories
// (tip/poll/announcement) just stay "active" indefinitely and lap normally.
const officialContentSchema = new Schema(
  {
    category: { type: String, enum: ["trivia_rich", "tip", "poll", "announcement"], required: true },

    // trivia_rich / tip / announcement
    text: { type: String },

    // tip only, optional — turns one word inside `text` into a tappable
    // in-app link (e.g. "favorites" -> the viewer's own Profile favorites
    // tab). `linkWord` must appear verbatim in `text` (case-insensitive
    // match, same convention ShareCard.tsx's own renderRecommendMessage
    // helper already uses for the recommendation type's "Watchlist" link).
    // Not every tip has one — plenty of tips have no single good link
    // target and stay plain text.
    linkWord: { type: String },
    linkHref: { type: String },

    // poll only
    pollQuestion: { type: String },
    pollOptions: [{ type: String }],

    status: { type: String, enum: ["active", "pending", "retired"], default: "active" },
    addedAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date },
  },
  { timestamps: true }
);

officialContentSchema.index({ category: 1, status: 1 });

const OfficialContent = mongoose.model("OfficialContent", officialContentSchema);
export default OfficialContent;
