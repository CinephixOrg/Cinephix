import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getConversations,
  getOrCreateConversation,
  getMessages,
  markAsRead,
  sendMessage,
} from "../controllers/conversationController.js";

const router = express.Router();

router.use(authMiddleware); // All conversation routes require auth

router.get("/", getConversations);
router.post("/", getOrCreateConversation);
router.get("/:id/messages", getMessages);
router.post("/:id/read", markAsRead);
router.post("/:id/messages", sendMessage);

export default router;
