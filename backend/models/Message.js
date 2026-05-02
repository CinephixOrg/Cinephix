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
  },
  { timestamps: true }
);

messageSchema.index({ roomType: 1, roomId: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;
