import mongoose from "mongoose";
const { Schema } = mongoose;

// One doc per user per calendar day — created lazily on that user's first
// GET /daily-game/today of the day. `revealedLetters` is server-authoritative
// (only hint-reveals are persisted here, never the player's own in-progress
// typing — see dailyGameController.js's own comment on why that split is
// enough) so a killed/reopened app restores exactly what hints were spent,
// without needing to persist free-typing at all.
const dailyPuzzleAttemptSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD", UTC — matches DailyPuzzle.date
    contentId: { type: Schema.Types.ObjectId, required: true },
    contentType: { type: String, enum: ["movie", "series"], required: true },
    hintsUsed: { type: Number, default: 0 },
    blurLevel: { type: Number, default: 4 }, // counts down to 0 (clearest) as blur-hints are spent
    revealedLetters: [
      {
        index: { type: Number, required: true }, // position within the normalized (letters/digits-only) title
        letter: { type: String, required: true },
        _id: false,
      },
    ],
    guessesCount: { type: Number, default: 0 },
    solved: { type: Boolean, default: false },
    score: { type: Number, default: 100 },
    // Set once, at the moment of a correct guess — the leaderboard's own
    // tiebreak sort key (faster solve wins a tie on score). Deliberately
    // its own field rather than reusing `updatedAt` (timestamps:true),
    // since any later, unrelated write to this doc would otherwise shift it.
    solvedAt: { type: Date },
  },
  { timestamps: true }
);

dailyPuzzleAttemptSchema.index({ user: 1, date: 1 }, { unique: true });

const DailyPuzzleAttempt = mongoose.model("DailyPuzzleAttempt", dailyPuzzleAttemptSchema);
export default DailyPuzzleAttempt;
