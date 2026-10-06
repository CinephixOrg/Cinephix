import mongoose from "mongoose";
const { Schema } = mongoose;

const listItemSchema = new Schema(
  {
    itemId: { type: Schema.Types.ObjectId, required: true },
    itemType: { type: String, enum: ["movie", "series"], required: true },
    addedAt: { type: Date, default: Date.now },
    // Who actually added this title — absent on anything added before
    // this field existed. Only meaningful on a community list
    // (CustomList.groupId's own comment): groupController.js's
    // getGroupLeaderboard counts a member's own additions here as one of
    // the weekly leaderboard's signals, so this is the one field that
    // makes that per-item attribution possible at all.
    addedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }
);

const customListSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300, default: "" },
    isPublic: { type: Boolean, default: false },
    items: { type: [listItemSchema], default: [] },
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    views: { type: Number, default: 0 },
    // Manual drag-reorder position among this owner's lists — higher shows
    // first. Not backfilled by a migration; /me lazily assigns real values
    // to any list still at the schema default the first time it's fetched.
    order: { type: Number, required: true, default: 0 },
    // Set only on a list created through a community's "Pin a List" admin
    // action (groupController.js's createGroupList) — `owner` stays the
    // admin who created it (schema still requires one), but a groupId'd
    // list is the COMMUNITY's, not theirs personally: GET /lists/me
    // excludes it, so it never shows on the admin's own profile. Direct
    // ask, after the old flow (pinning one of the admin's own existing
    // lists by reference) left it ambiguous whose list it actually was.
    groupId: { type: Schema.Types.ObjectId, ref: "Group", default: null },
    // Only meaningful when groupId is set — lets any member of that
    // community add titles (never remove, never touch name/description/
    // visibility, all of which stay admin-only) via the same POST
    // /:id/items a personal list's owner already uses.
    allowMemberAdd: { type: Boolean, default: false },
  },
  { timestamps: true }
);

customListSchema.index({ owner: 1 });
customListSchema.index({ isPublic: 1 });
customListSchema.index({ owner: 1, order: 1 });
customListSchema.index({ groupId: 1 });

const CustomList = mongoose.model("CustomList", customListSchema);
export default CustomList;
