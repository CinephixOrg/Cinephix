// backend/routes/rating.js (YENİ DOSYA)
import express from 'express';
import { addOrUpdateRating, getMyRating } from '../controllers/ratingController.js';
import authMiddleware from '../middleware/authMiddleware.js'; // authMiddleware'iniz

const router = express.Router();

// Giriş koruması ekliyoruz
router.post('/', authMiddleware, addOrUpdateRating);
router.get('/me/:contentId', authMiddleware, getMyRating);

export default router;