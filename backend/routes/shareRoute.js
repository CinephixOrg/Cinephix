import express from "express";
import {
  createShare,
  getShareFeed,
  toggleShareLike,
  registerShareView,
  voteOnPoll,
  getUserShares,
  getShareById,
  deleteShare,
  getSharedBadges,
} from "../controllers/shareController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/feed", authMiddleware, getShareFeed);
router.get("/user/:userId", authMiddleware, getUserShares);
router.get("/badges/shared", authMiddleware, getSharedBadges);
// After the fixed paths above, so "/feed"/"/badges" aren't read as a share id.
router.get("/:id", authMiddleware, getShareById);
router.post("/", authMiddleware, createShare);
router.post("/:id/like", authMiddleware, toggleShareLike);
router.post("/:id/view", authMiddleware, registerShareView);
router.post("/:id/vote", authMiddleware, voteOnPoll);
router.delete("/:id", authMiddleware, deleteShare);

export default router;
