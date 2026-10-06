import mongoose from "mongoose";
const { Schema } = mongoose;

// A community's own auto-posted event — surfaced only in Discover's
// "Community Announcements" rail (feedController.js's
// getCommunityAnnouncements), member-only, never the Shares/Media feed.
// Deliberately NOT a Share: that model carries like/report/view plumbing
// built for personal posts, none of which applies to an automated event
// log. Same flat "group + createdBy + type-specific fields" convention as
// GroupChallenge.js/GroupWatchParty.js.
//
// Naming note: "community_announcement" is already a Message type (chat-
// only, see groupController.js's postGroupAnnouncement) — unrelated to
// this model, which is intentionally named differently to avoid confusion
// between the two.
const groupAnnouncementSchema = new Schema(
  {
    group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
    // null for the weekly leaderboard cron's own posts — no admin triggered those.
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    category: { type: String, enum: ["challenge", "watchparty", "list", "leaderboard"], required: true },

    // challenge / watchparty / list
    title: String,
    // watchparty only
    posterUrl: String,
    // challenge only — up to 6 posters, same grid Overview's own challenge
    // card shows (CommunityHubTab.tsx's challengePosterGrid).
    posterUrls: [String],
    itemCount: Number,
    // watchparty only
    partyId: { type: Schema.Types.ObjectId, ref: "GroupWatchParty" },
    scheduledAt: Date,
    // list only — a snapshot at creation time (name/description/preview
    // posters), same "never a live reference" convention Share.listData
    // already uses for its own list-type posts, so this card never needs
    // a second request just to render.
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

    // leaderboard only — a snapshot, not a live reference: whoever was
    // top 3 when the week ended, regardless of later changes.
    leaderboardTop: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        username: String,
        profilePicUrl: String,
        score: Number,
      },
    ],
  },
  { timestamps: true }
);

groupAnnouncementSchema.index({ group: 1, createdAt: -1 });

const GroupAnnouncement = mongoose.model("GroupAnnouncement", groupAnnouncementSchema);
export default GroupAnnouncement;
