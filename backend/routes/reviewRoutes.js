import express from 'express';
import {
  getContentReviews,
  addOrUpdateReview,
  deleteMyReview
} from '../controllers/reviewController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { validateRequest, validationSchemas } from '../middleware/validation.js';

const router = express.Router();

// Public: Get reviews for specific content
router.get('/content/:contentId', getContentReviews);

// Auth required: Add/update review
router.post('/', authMiddleware, validateRequest(validationSchemas.createReview), addOrUpdateReview);

// Auth required: Delete my own review
router.delete('/:reviewId', authMiddleware, deleteMyReview);

export default router;