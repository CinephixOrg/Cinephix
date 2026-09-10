import mongoose from "mongoose";
const { Schema } = mongoose;

// A Medya post — always a snapshot of an existing analysis/review/
// recommendation at the moment it was shared (mirrors Message.analysisData/
// contentData's existing snapshot convention elsewhere in this codebase),
// never a live reference. Editing/deleting the underlying analysis or
// review afterwards has no effect on an already-created share.
const shareSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["analysis", "review", "recommendation", "list", "official", "poll"], required: true },

    // Denormalized at creation time by officialContentService (the poster
    // is known to be official right when the doc is created) so getShareFeed
    // can boost these in its score $addFields without an extra $lookup.
    isOfficialPost: { type: Boolean, default: false },

    // type: "analysis"
    analysisData: { type: Schema.Types.Mixed },

    // type: "review"
    reviewText: { type: String },
    reviewRating: { type: Number },

    // type: "recommendation"
    note: { type: String, trim: true, maxlength: 300 },

    // type: "review" | "recommendation" | "official" (trivia/highlight/
    // on-this-day posts that reference a specific title reuse this same
    // generic content snapshot rather than a dedicated field set)
    contentId: { type: String },
    contentType: { type: String, enum: ["movie", "series"] },
    contentData: {
      title: String,
      posterUrl: String,
      releaseYear: Number,
    },

    // type: "list"
    listId: { type: Schema.Types.ObjectId, ref: "CustomList" },
    listData: {
      name: String,
      description: String,
      itemCount: Number,
      previewItems: [
        {
          itemId: String,
          itemType: { type: String, enum: ["movie", "series"] },
          title: String,
          poster_path: String,
        },
      ],
    },

    // type: "official" — the official Cinephix account's own auto-posted
    // content (see backend/services/officialContentService.js)
    officialCategory: {
      type: String,
      enum: ["trivia", "tip", "highlight", "on_this_day", "stats", "announcement"],
    },
    officialText: { type: String, maxlength: 500 },
    // "official" only — zero or more words inside officialText rendered as
    // tappable in-app links (ShareCard.tsx's renderTextWithLinks). Tips
    // carry at most one absolute-route link (`href`, mirrors
    // OfficialContent.linkWord/linkHref, see that model's own comment).
    // Trivia's title-referencing templates instead carry a `contentId`/
    // `contentType` pair per link — resolved client-side against whichever
    // stack (`basePath`) the card happens to be rendered in, same as the
    // existing single contentId/contentType fields' own goToContent already
    // does, rather than a hardcoded absolute path. Same-day-release trivia
    // needs two of these at once (one per title) — an array rather than a
    // single field pair specifically to support that two-link case.
    officialLinks: [{ word: String, href: String, contentId: String, contentType: { type: String, enum: ["movie", "series"] } }],

    // type: "poll" — closed-option only (never open-ended/comment-inviting,
    // since this app has no comment-writing feature); Instagram-style live
    // percentage results, one vote per user, revoting swaps the vote rather
    // than adding a second one.
    pollData: {
      question: String,
      options: [
        {
          text: String,
          votes: [{ type: Schema.Types.ObjectId, ref: "User" }],
        },
      ],
    },

    // Instagram-style single like, not a multi-emoji reaction. Cached count
    // mirrors Group.memberCount's existing cached-counter pattern, avoids
    // counting likes.length on every feed row for the Popular sort.
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    likeCount: { type: Number, default: 0 },

    // Unique-viewer tracking (not a raw impression counter) — a plain ref
    // array so it populates the same way `likes` would, needed since the
    // card also shows a few viewer avatars, not just a number.
    views: [{ type: Schema.Types.ObjectId, ref: "User" }],
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

shareSchema.index({ createdAt: -1 });
shareSchema.index({ user: 1, createdAt: -1 });
shareSchema.index({ likeCount: -1, createdAt: -1 });

const Share = mongoose.model("Share", shareSchema);
export default Share;
