import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { findMatches, getMatchWithUser } from "../controllers/matchController.js";
import { validateRequest, validationSchemas } from "../middleware/validation.js";

const router = express.Router();

// POST çünkü filtre göndereceğiz
router.post("/", authMiddleware, validateRequest(validationSchemas.findMatches), findMatches);

// YENİ: Tek bir kullanıcıyla match hesapla
router.post("/:targetUserId", authMiddleware, getMatchWithUser);

export default router;
