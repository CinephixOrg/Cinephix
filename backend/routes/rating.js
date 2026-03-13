// backend/routes/rating.js (YENİ DOSYA)
import express from 'express';
import { addOrUpdateRating, getMyRating } from '../controllers/ratingController.js';
import authMiddleware from '../middleware/authMiddleware.js'; // authMiddleware'iniz
import { validateRequest, validationSchemas } from '../utils/validation.js';

const router = express.Router();

// Giriş koruması ekliyoruz
router.post('/', authMiddleware, validateRequest(validationSchemas.addRating), addOrUpdateRating);
router.get('/me/:contentId', authMiddleware, validateRequest(validationSchemas.mongoIdParam), getMyRating);

export default router;