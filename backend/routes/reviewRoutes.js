import express from 'express';
import {
  getContentReviews,
  getFriendsReviews,
  getReviewsFromFriends,
  getReviewsFeed,
  addOrUpdateReview,
  deleteMyReview,
  toggleReviewLike,
  getPopularReviews,
} from '../controllers/reviewController.js';
import authMiddleware, { optionalAuth } from '../middleware/authMiddleware.js';
import { validateRequest, validationSchemas } from '../middleware/validation.js';

const router = express.Router();

// GET popular reviews globally (homepage)
router.get('/popular', authMiddleware, getPopularReviews);

// GET global "reviews from people you follow" feed (Home page Reviews tab)
router.get('/friends', authMiddleware, getReviewsFromFriends);

// GET Discover's paginated Reviews tab feed (friends' reviews first, then
// popular, one merged sort — replaces the old client-side merge of the
// two calls above for that specific screen; both calls stay in place for
// their other existing callers).
router.get('/feed', authMiddleware, getReviewsFeed);

// GET all reviews for content (optionalAuth: includes hasLiked when logged in)
router.get('/content/:contentId', optionalAuth, getContentReviews);

// GET reviews from followed users for content
router.get('/content/:contentId/friends', authMiddleware, getFriendsReviews);

// POST add/update review
router.post('/', authMiddleware, validateRequest(validationSchemas.createReview), addOrUpdateReview);

// DELETE own review
router.delete('/:reviewId', authMiddleware, deleteMyReview);

// POST toggle like on a review
router.post('/:reviewId/like', authMiddleware, toggleReviewLike);

export default router;
