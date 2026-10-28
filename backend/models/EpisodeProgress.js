// backend/models/EpisodeProgress.js
import mongoose from "mongoose";
const { Schema } = mongoose;

// A user's watched episodes of one series (TC-141) — one document per user
// and series rather than one per episode: ~40 bytes an episode instead of
// ~230 with its own document and indexes, on a database with a 512 MB cap.
// What `eps` and `all` mean, and how they change: utils/episodeProgress.js.
// Episode names and air dates are never stored here; they come from TMDB
// live (services/episodeTracking.js).
const episodeSchema = new Schema(
  {
    s: { type: Number, required: true },
    e: { type: Number, required: true },
    // When it was marked — absent on episodes spelled out of an undated
    // "watched it all" (utils/episodeProgress.js), which are past viewing.
    at: { type: Date },
  },
  { _id: false }
);

const episodeProgressSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // The catalogue series' _id, as everywhere else a title is referenced.
    series: { type: Schema.Types.ObjectId, required: true },
    eps: { type: [episodeSchema], default: [] },
    all: {
      type: new Schema({ s: Number, e: Number }, { _id: false }),
      default: null,
    },
  },
  { timestamps: true }
);

// The detail page's one read, and every write. A user's monthly count reads
// all of their documents through this index's `user` prefix.
episodeProgressSchema.index({ user: 1, series: 1 }, { unique: true });

const EpisodeProgress = mongoose.model("EpisodeProgress", episodeProgressSchema, "episodeprogress");
export default EpisodeProgress;
