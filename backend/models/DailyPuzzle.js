import mongoose from "mongoose";
const { Schema } = mongoose;

// The resolved, cached answer for one calendar day (UTC) — written once by
// dailyPuzzleService.js's pickTodaysPuzzle() so every request that day
// reads the same stored doc instead of recomputing/reselecting. `title`/
// `posterPath` are copied in at pick time (not re-read from Movie/Series
// on every request) so the puzzle stays stable even if the underlying
// catalog doc is later edited.
const dailyPuzzleSchema = new Schema(
  {
    date: { type: String, required: true, unique: true }, // "YYYY-MM-DD", UTC
    contentId: { type: Schema.Types.ObjectId, required: true },
    contentType: { type: String, enum: ["movie", "series"], required: true },
    title: { type: String, required: true },
    posterPath: { type: String },
    // Tracks who the "current leader" push notification last announced
    // for this date, so dailyLeaderboardNotifier.js only sends again once
    // the real leader actually changes — not on every periodic cron tick.
    lastAnnouncedLeaderId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

const DailyPuzzle = mongoose.model("DailyPuzzle", dailyPuzzleSchema);
export default DailyPuzzle;
