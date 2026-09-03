import mongoose from "mongoose";
const { Schema } = mongoose;

// Append-only log of "user X favorited content Y at time Z" — deliberately
// separate from User.favoriteMovies/favoriteSeries (still plain, untimestamped
// ObjectId arrays), which stay untouched: those fields are read as raw id
// arrays by match-making, the leaderboard, and content-stats across a dozen+
// call sites, and migrating them to a timestamped subdocument shape would mean
// touching all of that. This log exists purely to power the network Activity
// feed's "favorited" event — written once per genuinely-new favorite-add
// (see userController.js's updateFavorites), never on removal, never on a
// re-submit of an id already present. `contentId` is stored as a real
// ObjectId (unlike Rating/Review's plain-String contentId) since this is a
// brand-new model with no legacy shape to match — keeps its own $lookup
// against movies/series simpler (no String->ObjectId $convert needed).
const favoriteEventSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  contentId: { type: Schema.Types.ObjectId, required: true },
  contentType: { type: String, enum: ["movie", "series"], required: true },
  createdAt: { type: Date, default: Date.now },
});

// Recent-events-per-user lookups (getNetworkActivity's own cutoff-windowed
// per-follower query), same shape as Rating's own `{user:1, createdAt:-1}`.
favoriteEventSchema.index({ user: 1, createdAt: -1 });

const FavoriteEvent = mongoose.model("FavoriteEvent", favoriteEventSchema);
export default FavoriteEvent;
