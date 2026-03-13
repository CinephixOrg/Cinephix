// backend/routes/reviewRoutes.js
import express from 'express';
import {
  getContentReviews,
  addOrUpdateReview,
  deleteMyReview
} from '../controllers/reviewController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { validateRequest, validationSchemas } from '../utils/validation.js';

const router = express.Router();

// Herkese açık: Belirli bir içeriğin yorumlarını getir
router.get('/content/:contentId', validateRequest(validationSchemas.mongoIdParam), getContentReviews);

// Sadece giriş yapanlar: Yeni yorum ekle/güncelle
router.post('/', authMiddleware, validateRequest(validationSchemas.addReview), addOrUpdateReview);

// Sadece giriş yapanlar: Kendi yorumunu sil (:reviewId -> yorumun kendi ID'si)
router.delete('/:reviewId', authMiddleware, validateRequest(validationSchemas.mongoIdParam), deleteMyReview);

export default router;