// backend/models/Rating.js (NEW FILE)
import mongoose from 'mongoose';
const { Schema } = mongoose;

const ratingSchema = new Schema({
    // User who gave the rating
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Rated content (movie or series ID)
    contentId: {
        type: String, // Or ObjectId, should match your watchlist
        required: true
    },
    // Content type
    contentType: {
        type: String,
        enum: ['movie', 'series'],
        required: true
    },
    // Rating given between 1-10
    value: {
        type: Number,
        required: true,
        min: 1,
        max: 10
    }
}, { timestamps: true });

// ===== DATABASE INDEXES (Issue #13) =====
// Ensure one user can rate one content only once
ratingSchema.index({ user: 1, contentId: 1 }, { unique: true });

// Fast lookups by content (for getting all ratings for a movie/series)
ratingSchema.index({ contentId: 1 });
ratingSchema.index({ contentType: 1 });

// Fast lookups by user (for getting user's all ratings)
ratingSchema.index({ user: 1 });

// Recent-ratings-per-user lookups (CineMatch's bonus signal: matchController.js's
// getSyncCandidates/getMatchWithUser/analyzeMatchWithUser all query "this user's
// ratings from the last N days") — without this, createdAt >= cutoff can only be
// applied as a post-fetch filter over every rating a user has ever given.
ratingSchema.index({ user: 1, createdAt: -1 });

const Rating = mongoose.model('Rating', ratingSchema);
export default Rating;