import mongoose from "mongoose";
const { Schema } = mongoose;

// One doc per pool-backed OfficialContent category — tracks the current
// shuffled "lap" order and how far through it officialContentService has
// posted, so no content repeats within a lap and a fresh shuffle only
// happens once the whole pool has been posted through.
const officialContentLapStateSchema = new Schema({
  category: { type: String, required: true, unique: true },
  order: [{ type: Schema.Types.ObjectId, ref: "OfficialContent" }],
  position: { type: Number, default: 0 },
});

const OfficialContentLapState = mongoose.model("OfficialContentLapState", officialContentLapStateSchema);
export default OfficialContentLapState;
