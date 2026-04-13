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

const Rating = mongoose.model('Rating', ratingSchema);
export default Rating;