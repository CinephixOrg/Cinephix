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
    type: { type: String, enum: ["analysis", "review", "recommendation", "list"], required: true },

    // type: "analysis"
    analysisData: { type: Schema.Types.Mixed },

    // type: "review"
    reviewText: { type: String },
    reviewRating: { type: Number },

    // type: "recommendation"
    note: { type: String, trim: true, maxlength: 300 },

    // type: "review" | "recommendation"
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
