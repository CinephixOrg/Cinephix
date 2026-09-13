import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getGenreBadges,
  getVolumeBadges,
  getRatingCountBadge,
  getReviewCountBadge,
  getListCountBadge,
  getFollowersBadge,
  getInfluencerBadge,
  getFirstSyncBadge,
  getHighMatchBadge,
  getSyncExplorerBadge,
  getFoundingCinephileBadge,
  getMembershipBadge,
  getStreakBadge,
  getTimeTravelerBadge,
  getEclecticTasteBadge,
  getDayOneViewerBadge,
  getHiddenGemBadge,
  getPollParticipantBadge,
  getHalloweenViewerBadge,
  getNewYearViewerBadge,
} from "../controllers/badgeController.js";
// "podium" is the one badge family that lives in feedController.js, not
// badgeController.js — see computePodiumBadge's own doc comment there for
// why (it's built entirely out of that file's own podium ranking, and
// importing it back the other way would be circular).
import { getPodiumBadge } from "../controllers/feedController.js";

const router = express.Router();

// Own-profile only for now (req.user.id, no :id param) — badges are being
// built out one category at a time, starting with genre badges shown on
// the viewer's own Profile page. Extending this to public profiles is a
// deliberate later step, not an oversight here.
router.get("/genres", authMiddleware, getGenreBadges);
router.get("/volume", authMiddleware, getVolumeBadges);
router.get("/rating-count", authMiddleware, getRatingCountBadge);
router.get("/review-count", authMiddleware, getReviewCountBadge);
router.get("/list-count", authMiddleware, getListCountBadge);
router.get("/followers", authMiddleware, getFollowersBadge);
router.get("/influencer", authMiddleware, getInfluencerBadge);
router.get("/podium", authMiddleware, getPodiumBadge);
router.get("/first-sync", authMiddleware, getFirstSyncBadge);
router.get("/high-match", authMiddleware, getHighMatchBadge);
router.get("/sync-explorer", authMiddleware, getSyncExplorerBadge);
router.get("/founding-cinephile", authMiddleware, getFoundingCinephileBadge);
router.get("/membership", authMiddleware, getMembershipBadge);
router.get("/streak", authMiddleware, getStreakBadge);
router.get("/time-traveler", authMiddleware, getTimeTravelerBadge);
router.get("/eclectic-taste", authMiddleware, getEclecticTasteBadge);
router.get("/day-one-viewer", authMiddleware, getDayOneViewerBadge);
router.get("/hidden-gem", authMiddleware, getHiddenGemBadge);
router.get("/poll-participant", authMiddleware, getPollParticipantBadge);
router.get("/halloween-viewer", authMiddleware, getHalloweenViewerBadge);
router.get("/new-year-viewer", authMiddleware, getNewYearViewerBadge);

export default router;
