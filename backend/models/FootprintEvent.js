import mongoose from "mongoose";
const { Schema } = mongoose;

// When someone followed a person or liked a list — for their own Activity
// page. User.following and CustomList.likes are plain id arrays with no
// times, and every other consumer reads them as such, so this log sits
// beside them rather than changing their shape (the same approach as
// FavoriteEvent). One row per current follow/like: written when it happens,
// removed when it's undone, so the page never shows a follow or like that
// no longer stands.
const footprintEventSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["followed", "list_liked"], required: true },
  targetUser: { type: Schema.Types.ObjectId, ref: "User" },
  list: { type: Schema.Types.ObjectId, ref: "CustomList" },
  createdAt: { type: Date, default: Date.now },
});

// The Activity page's newest-first read, per type.
footprintEventSchema.index({ user: 1, type: 1, createdAt: -1 });

const FootprintEvent = mongoose.model("FootprintEvent", footprintEventSchema);
export default FootprintEvent;

/** Records a follow or list like, replacing an earlier record of the same one. */
export async function recordFootprint(user, type, target) {
  const filter = { user, type, ...(type === "followed" ? { targetUser: target } : { list: target }) };
  await FootprintEvent.findOneAndUpdate(filter, { $set: { createdAt: new Date() } }, { upsert: true });
}

/** Removes the record of a follow or list like that was undone. */
export async function clearFootprint(user, type, target) {
  await FootprintEvent.deleteMany({ user, type, ...(type === "followed" ? { targetUser: target } : { list: target }) });
}
