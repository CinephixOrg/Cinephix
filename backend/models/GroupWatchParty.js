import mongoose from "mongoose";
const { Schema } = mongoose;

// A community's own scheduled "watch together" event — direct ask, with an
// explicit, agreed scope limit: there's no real synced video playback
// (nothing plays inside Cinephix at all), this is a companion live chat
// room (Message.js's existing generic roomType/roomId, "watchparty") that
// opens around a title + a scheduled time, while everyone actually
// watches on whatever platform/TV they already use. Framed honestly as a
// "watch-along chat," not a synced player.
//
// Who "attended" is never stored here — it's whoever posted at least once
// in this party's own chat room (Message.distinct("sender", {roomType:
// "watchparty", roomId: party._id})), computed on read, same "derive,
// don't duplicate" approach GroupChallenge.js's own progress already uses.
const groupWatchPartySchema = new Schema(
  {
    group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    contentId: { type: String, required: true },
    contentType: { type: String, enum: ["movie", "series"], required: true },
    contentTitle: String,
    contentPosterUrl: String,
    scheduledAt: { type: Date, required: true },
    // How long after scheduledAt this still reads as "live" (the hero
    // treatment on Overview/the LiveBanner/Currently Watching's own
    // watch-party rail) — the admin's own choice at scheduling time,
    // defaulting to the same 4 hours the personal "currently watching"
    // status already uses (feedController.js's CURRENTLY_WATCHING_TTL_MS)
    // when they don't pick one. A community event can run longer than one
    // person's own sitting (a marathon, a slower-arriving group), so this
    // is configurable up to 12h rather than sharing that fixed constant.
    durationMinutes: { type: Number, default: 240 },
    rsvps: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        rsvpAt: { type: Date, default: Date.now },
      },
    ],
    // Which of the 3 scheduled reminder pushes (30min/10min/started —
    // services/watchPartyReminders.js) have already gone out, so the cron
    // checking this every minute never double-sends one. RSVP is the only
    // thing that matters BEFORE a party starts, so these only ever go to
    // whoever's in `rsvps` above at the moment each fires.
    remindersSent: {
      thirtyMin: { type: Boolean, default: false },
      tenMin: { type: Boolean, default: false },
      started: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

groupWatchPartySchema.index({ group: 1, scheduledAt: -1 });

const GroupWatchParty = mongoose.model("GroupWatchParty", groupWatchPartySchema);
export default GroupWatchParty;
