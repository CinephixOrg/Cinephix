import mongoose from "mongoose";
const { Schema } = mongoose;

const conversationSchema = new Schema(
  {
    // Always exactly two participants
    participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],

    // Denormalized for inbox preview — updated on every new message
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: null },

    // Per-user unread counts: { "<userId>": <count> }
    unreadCounts: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

// Fast lookup: "all conversations this user is part of"
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;
