// backend/models/Review.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const reviewSchema = new Schema({
  // User who wrote the review
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Reference to User model
    required: true
  },
  // Review content (movie or series ID)
  // Should be same type as contentId in Rating.js (String or ObjectId)
  contentId: {
    type: String, // Or Schema.Types.ObjectId
    required: true
  },
  // Content type
  contentType: {
    type: String,
    enum: ['movie', 'series'],
    required: true
  },
  // Review text
  text: {
    type: String,
    required: [true, 'Review text cannot be empty.'],
    trim: true,
    maxlength: 2000
  },
  likes: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
  }],
  // Additive alongside `likes` — every existing consumer of likes/likeCount/
  // hasLiked keeps working unchanged. Only the personal-activity feature
  // reads this, for per-like timestamps `likes` alone can't provide.
  likeEvents: [{
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    likedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true }); // Auto-adds createdAt and updatedAt fields

// ===== DATABASE INDEXES (Issue #13) =====
// Ensure one user can review one content only once
reviewSchema.index({ user: 1, contentId: 1 }, { unique: true });

// Fast lookups by content (for getting all reviews for a movie/series)
reviewSchema.index({ contentId: 1 });
reviewSchema.index({ contentType: 1 });

// Fast lookups by user (for getting user's all reviews)
reviewSchema.index({ user: 1 });

// Compound index for sorting reviews by creation time
reviewSchema.index({ contentId: 1, createdAt: -1 });

const Review = mongoose.model('Review', reviewSchema);
export default Review;