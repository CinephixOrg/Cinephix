// backend/routes/feedRoute.js
import express from "express";
import { getFeed, getTopPicks, getRecommendations, getPopularThisWeek } from "../controllers/feedController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, getFeed);
router.get("/top-picks", authMiddleware, getTopPicks);
router.get("/recommendations", authMiddleware, getRecommendations);
router.get("/popular-this-week", authMiddleware, getPopularThisWeek);

export default router;
