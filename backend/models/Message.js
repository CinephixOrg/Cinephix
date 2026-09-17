import mongoose from "mongoose";
const { Schema } = mongoose;

/**
 * Generic message model supporting both group chats and future DM conversations.
 * roomType + roomId identify the conversation:
 *   - group chat: roomType="group", roomId=Group._id
 *   - future DMs:  roomType="dm",    roomId=Conversation._id (or sorted user pair string)
 */
const messageSchema = new Schema(
  {
    roomType: {
      type: String,
      enum: ["group", "dm"],
      required: true,
      default: "group",
    },
    roomId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    type: {
      type: String,
      enum: ["text", "recommendation", "analysis_share", "profile_share", "list_share"],
      default: "text",
    },
    // For recommendation messages
    contentId: {
      type: Schema.Types.ObjectId,
      // No ref field - can reference Movie or Series
    },
    contentType: {
      type: String,
      enum: ["movie", "series"],
    },
    // Recommendation content details for display
    contentData: {
      title: String,
      posterUrl: String,
      genres: [String],
      releaseYear: Number,
      overview: String,
      rating: Number,
    },
    // For analysis sharing
    analysisData: Schema.Types.Mixed,
    // For profile sharing ("hey, do you know this person?") — denormalized
    // like contentData above rather than just an ObjectId ref, so a shared
    // profile still renders correctly (username/avatar/tier at share time)
    // even if the user later changes their username or avatar.
    profileData: {
      userId: { type: Schema.Types.ObjectId, ref: "User" },
      username: String,
      profile_pic_url: String,
      accountTier: String,
    },
    // For list sharing ("check out this list") — denormalized like
    // profileData above, so a shared list still renders correctly even if
    // it's later renamed or resized.
    listData: {
      listId: { type: Schema.Types.ObjectId, ref: "CustomList" },
      name: String,
      itemCount: Number,
      previewPosters: [String],
    },
  },
  { timestamps: true }
);

messageSchema.index({ roomType: 1, roomId: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;
