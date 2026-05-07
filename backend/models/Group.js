import mongoose from "mongoose";
const { Schema } = mongoose;

const memberSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const groupSchema = new Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["director", "genre", "era", "style"],
      required: true,
    },
    tags: [{ type: String, trim: true }],
    coverImage: { type: String, default: "" },
    members: [memberSchema],
    memberCount: { type: Number, default: 0 },
    isPreset: { type: Boolean, default: true },
    
    // Chat-related fields
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: null },
    lastMessageSenderId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    
    // Per-member unread counts: { "<userId>": <count> }
    unreadCounts: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

groupSchema.index({ slug: 1 });
groupSchema.index({ category: 1 });
groupSchema.index({ "members.user": 1 });
// Fast lookups for user's groups sorted by recent activity
groupSchema.index({ "members.user": 1, lastMessageAt: -1 });

const Group = mongoose.model("Group", groupSchema);
export default Group;
