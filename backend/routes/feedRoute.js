// backend/routes/feedRoute.js
import express from "express";
import { getFeed, getTopPicks } from "../controllers/feedController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, getFeed);
router.get("/top-picks", authMiddleware, getTopPicks);

export default router;
