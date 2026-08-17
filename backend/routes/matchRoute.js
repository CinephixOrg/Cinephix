import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  findMatches,
  getMatchWithUser,
  analyzeMatchWithUser,
  getSwipeQueue,
  swipeMatch,
  getRejectedMatches,
} from "../controllers/matchController.js";
import { validateRequest, validationSchemas } from "../middleware/validation.js";

const router = express.Router();

// POST because we're sending filters
router.post("/", authMiddleware, validateRequest(validationSchemas.findMatches), findMatches);

// Swipe UI — registered before "/:targetUserId" so "/swipe/..." isn't
// swallowed by that param route.
router.get("/swipe/queue", authMiddleware, getSwipeQueue);
router.get("/swipe/rejected", authMiddleware, getRejectedMatches);
router.post("/swipe", authMiddleware, validateRequest(validationSchemas.swipeMatch), swipeMatch);

// NEW: Calculate match with single user
router.post("/:targetUserId", authMiddleware, getMatchWithUser);
// Analyze match (LLM) - mock by default
router.post("/:targetUserId/analyze", authMiddleware, analyzeMatchWithUser);

export default router;
