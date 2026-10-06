// backend/routes/feedRoute.js
import express from "express";
import {
  getFeed,
  getTopPicks,
  getRecommendations,
  getNewReleases,
  getCurrentlyWatchingFeed,
  getCommunityAnnouncements,
  getPopularThisWeek,
  getPopularWithFriends,
  getLeaderboard,
  getPeopleLeaderboard,
  getMyPodiumPlacements,
} from "../controllers/feedController.js";
import { getNetworkActivity } from "../controllers/activityController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, getFeed);
router.get("/top-picks", authMiddleware, getTopPicks);
router.get("/recommendations", authMiddleware, getRecommendations);
router.get("/new-releases", authMiddleware, getNewReleases);
router.get("/currently-watching", authMiddleware, getCurrentlyWatchingFeed);
router.get("/community-announcements", authMiddleware, getCommunityAnnouncements);
router.get("/popular-this-week", authMiddleware, getPopularThisWeek);
router.get("/popular-with-friends", authMiddleware, getPopularWithFriends);
router.get("/leaderboard", authMiddleware, getLeaderboard);
router.get("/people-leaderboard", authMiddleware, getPeopleLeaderboard);
router.get("/my-podium-placements", authMiddleware, getMyPodiumPlacements);
router.get("/activity", authMiddleware, getNetworkActivity);

export default router;
