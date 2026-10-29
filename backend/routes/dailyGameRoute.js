import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getTodayPuzzle, getPuzzleStreak, useHint, submitGuess, getLeaderboard } from "../controllers/dailyGameController.js";

const router = express.Router();

router.get("/streak", authMiddleware, getPuzzleStreak);
router.get("/today", authMiddleware, getTodayPuzzle);
router.post("/hint", authMiddleware, useHint);
router.post("/guess", authMiddleware, submitGuess);
router.get("/leaderboard", authMiddleware, getLeaderboard);

export default router;
