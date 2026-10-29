import mongoose from "mongoose";
const { Schema } = mongoose;

// Singleton doc (one row total, no `category` key needed — there's only
// ever one daily-guessing-game pool, unlike OfficialContentLapState which
// is keyed per content category) tracking the current shuffled "lap"
// order of eligible Movie/Series ids and how far dailyPuzzleService.js has
// walked through it — same shuffle+position-pointer shape as
// OfficialContentLapState.js, so no title repeats within a lap and a
// fresh shuffle only happens once the whole pool has been used.
const dailyPuzzleLapStateSchema = new Schema({
  order: [
    {
      contentId: { type: Schema.Types.ObjectId, required: true },
      contentType: { type: String, enum: ["movie", "series"], required: true },
      _id: false,
    },
  ],
  position: { type: Number, default: 0 },
});

const DailyPuzzleLapState = mongoose.model("DailyPuzzleLapState", dailyPuzzleLapStateSchema);
export default DailyPuzzleLapState;
