import mongoose from "mongoose";
const { Schema } = mongoose;

/**
 * Generic message model supporting both group chats and future DM conversations.
 * roomType + roomId identify the conversation:
 *   - group chat:  roomType="group",      roomId=Group._id
 *   - future DMs:  roomType="dm",         roomId=Conversation._id (or sorted user pair string)
 *   - watch party: roomType="watchparty", roomId=GroupWatchParty._id — a
 *     community's own scheduled companion chat (GroupWatchParty.js), kept
 *     separate from that community's main "group" room on purpose.
 */
const messageSchema = new Schema(
  {
    roomType: {
      type: String,
      enum: ["group", "dm", "watchparty"],
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
      enum: ["text", "recommendation", "analysis_share", "profile_share", "list_share", "community_announcement"],
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
      // A snapshot for the chat card, like the rest of profileData.
      bio: String,
      followersCount: Number,
      topGenres: [String],
    },
    // For list sharing ("check out this list") — denormalized like
    // profileData above, so a shared list still renders correctly even if
    // it's later renamed or resized.
    listData: {
      listId: { type: Schema.Types.ObjectId, ref: "CustomList" },
      name: String,
      itemCount: Number,
      previewPosters: [String],
      // Newer shares only — see utils/listShareData.js.
      description: String,
      ownerUsername: String,
    },
    // For the admin-creation auto-announcement (groupController.js's
    // postGroupAnnouncement) — a rich preview of the poll/challenge/watch
    // party just created, direct ask after the plain-text version read as
    // too easy to miss. `text` above still carries a plain fallback string
    // (for any surface that just shows `text`, e.g. a push notification
    // preview); this is what the chat bubble itself actually renders.
    communityAnnouncementData: {
      kind: { type: String, enum: ["poll", "challenge", "watchparty"] },
      groupSlug: String,
      groupName: String,
      // poll
      question: String,
      optionTexts: [String],
      // challenge
      title: String,
      itemCount: Number,
      // challenge (first item's poster) / watchparty (its own content poster)
      posterUrl: String,
      // watchparty
      partyId: { type: Schema.Types.ObjectId, ref: "GroupWatchParty" },
      scheduledAt: Date,
    },
    // Read receipts: everyone other than the sender who has read this, and
    // when. Written when a room is marked read (services/readReceipts.js),
    // shown only to the sender (utils/readReceipts.js). Absent on messages
    // from before read receipts, and on watch party messages, which aren't
    // tracked.
    readBy: [
      {
        _id: false,
        user: { type: Schema.Types.ObjectId, ref: "User" },
        at: Date,
      },
    ],
  },
  { timestamps: true }
);

messageSchema.index({ roomType: 1, roomId: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;
