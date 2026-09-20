import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  findMatches,
  getMatchWithUser,
  analyzeMatchWithUser,
  getSyncCandidates,
  getSharedGenreContent,
  getContentRatings,
  getRecentSharedActivity,
  getMutualConnections,
  getMutualToWatch,
} from "../controllers/matchController.js";
import { validateRequest, validationSchemas } from "../middleware/validation.js";
import { notHiddenUser } from "../middleware/blockFilter.js";

const router = express.Router();

// POST because we're sending filters
router.post("/", authMiddleware, validateRequest(validationSchemas.findMatches), findMatches);

// Registered before "/:targetUserId" so "/sync/candidates" isn't swallowed by
// that param route. CineMatch is browse-and-follow now, not swipe-to-decide
// — no accept/reject/rejected-list routes anymore.
router.get("/sync/candidates", authMiddleware, getSyncCandidates);

// NEW: Calculate match with single user
router.post("/:targetUserId", authMiddleware, notHiddenUser("targetUserId"), getMatchWithUser);
// Analyze match (LLM) - mock by default
router.post("/:targetUserId/analyze", authMiddleware, notHiddenUser("targetUserId"), analyzeMatchWithUser);
// Shared-genre "you both loved this" titles, for the analysis panel's tappable genre chips
router.post("/:targetUserId/shared-genre-content", authMiddleware, notHiddenUser("targetUserId"), getSharedGenreContent);
// Both users' own rating (if any) for an arbitrary set of content ids — the Favorites card's detail box
router.post("/:targetUserId/content-ratings", authMiddleware, notHiddenUser("targetUserId"), getContentRatings);
// Titles both sides rated within the last 30 days — the Activity card's poster feed
router.post("/:targetUserId/recent-activity", authMiddleware, notHiddenUser("targetUserId"), getRecentSharedActivity);
// Paginated list of users both the requester and targetUserId follow — the Social Overlap card's avatar grid
router.get("/:targetUserId/mutual-connections", authMiddleware, notHiddenUser("targetUserId"), getMutualConnections);
// Titles sitting in both sides' own to-watch queue right now — the "Watch Together" card
router.get("/:targetUserId/mutual-to-watch", authMiddleware, notHiddenUser("targetUserId"), getMutualToWatch);

export default router;
