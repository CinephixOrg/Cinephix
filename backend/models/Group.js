import mongoose from "mongoose";
const { Schema } = mongoose;

const memberSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    joinedAt: { type: Date, default: Date.now },
    // Stamped once, at join time (groupController.js's joinGroup), from
    // the group's own memberCount at that moment vs. FOUNDING_MEMBER_CUTOFF
    // — never recomputed later, so it stays true for that member even as
    // the group grows past the cutoff. Community-scoped only: shown next to
    // this member's name inside the group (chat/member list), never folded
    // into the app-wide profile Badges tab, which already has its own
    // separate, unrelated "Founding Cinephile" badge (badgeController.js).
    isFoundingMember: { type: Boolean, default: false },
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
    // true for the app's own seeded topic rooms (seedGroups.js); false for
    // a partner-owned community (owner set below). Reused rather than
    // adding a second "kind" flag — the two have always been mutually
    // exclusive in practice (a seeded room has no owner, a partner
    // community is never one of the seeded presets).
    isPreset: { type: Boolean, default: true },

    // Set only for a partner community — the Instagram/TikTok account this
    // group was created for. Admin powers (identity customization, pinned
    // list/poll, challenges) all check this field, never a generic "is
    // admin" role — deliberately NOT self-serve: only set by the team,
    // per-partner, never by a user creating their own group.
    owner: { type: Schema.Types.ObjectId, ref: "User", default: null },
    // A single accent color (hex), the owner's own light customization —
    // shown on the group's header and bleeds into its pinned list's own
    // accent, direct ask ("co-branded"). Deliberately not a full theme:
    // just this one token, same "light identity layer, not a Discord
    // server" scope as the cover image/bio (name/description already
    // existed on this schema).
    accentColor: { type: String, default: null },
    // Owner's own outward links, shown as small icons on the group header
    // — direct ask: a user who finds this community organically (not via
    // the owner's own Instagram/TikTok) might not otherwise know the
    // owner has one.
    socialLinks: {
      instagram: { type: String, default: null },
      tiktok: { type: String, default: null },
      youtube: { type: String, default: null },
    },
    // Up to 3 of this community's own lists (CustomList docs with their
    // own groupId set to this group — see that model's own comment),
    // featured on Overview's "Featured Lists" rail. A community can have
    // more lists than this; the admin picks which ones surface here from
    // the community's own list page ("See all" — groupController.js's
    // listGroupLists/setFeaturedLists). Direct ask, replacing the old
    // single pinnedListId — one featured list at a time left every other
    // list the admin made invisible.
    pinnedListIds: { type: [{ type: Schema.Types.ObjectId, ref: "CustomList" }], default: [] },
    // The group's current pinned poll — reuses Share's own "poll" shape
    // (see Share.js's groupId field) rather than a second model. Only one
    // active at a time; creating a new one just repoints this (the old
    // Share doc is left in place, simply no longer pinned/surfaced).
    pinnedPollId: { type: Schema.Types.ObjectId, ref: "Share", default: null },
    // The group's current challenge (GroupChallenge.js) — only one active
    // at a time, same single-pin convention as pinnedPollId above.
    activeChallengeId: { type: Schema.Types.ObjectId, ref: "GroupChallenge", default: null },

    // Opt-in: auto-post a GroupAnnouncement (Discover's "Community
    // Announcements" rail, member-only) whenever one of the selected
    // categories happens here — a new challenge/watch party/list, or the
    // weekly leaderboard result. Off and empty by default; the admin picks
    // both the switch and which categories from Settings.
    feedAnnouncements: {
      enabled: { type: Boolean, default: false },
      categories: {
        type: [{ type: String, enum: ["challenge", "watchparty", "list", "leaderboard"] }],
        default: [],
      },
    },

    // Chat-related fields
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: null },
    lastMessageSenderId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    
    // Per-member unread counts: { "<userId>": <count> }
    unreadCounts: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

// (Index removed as slug is unique and automatically indexed)
groupSchema.index({ category: 1 });
groupSchema.index({ "members.user": 1 });
// Fast lookups for user's groups sorted by recent activity
groupSchema.index({ "members.user": 1, lastMessageAt: -1 });

const Group = mongoose.model("Group", groupSchema);
export default Group;
