import express from "express";
import authMiddleware, { optionalAuth } from "../middleware/authMiddleware.js";
import {
  getAllGroups,
  getGroupBySlug,
  joinGroup,
  leaveGroup,
  getGroupMembers,
  getGroupMessages,
  sendGroupMessage,
  markGroupAsRead,
} from "../controllers/groupController.js";

const router = express.Router();

router.get("/", optionalAuth, getAllGroups);
router.get("/:slug", optionalAuth, getGroupBySlug);
router.get("/:slug/members", getGroupMembers);

router.post("/:slug/join", authMiddleware, joinGroup);
router.post("/:slug/leave", authMiddleware, leaveGroup);
router.post("/:groupId/markAsRead", authMiddleware, markGroupAsRead);
router.get("/:slug/messages", authMiddleware, getGroupMessages);
router.post("/:groupId/messages", authMiddleware, sendGroupMessage);

export default router;
