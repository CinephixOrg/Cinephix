import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getConversations,
  getOrCreateConversation,
  getMessages,
  getMessageReaders,
  markAsRead,
  sendMessage,
} from "../controllers/conversationController.js";

const router = express.Router();

router.use(authMiddleware); // All conversation routes require auth

router.get("/", getConversations);
router.post("/", getOrCreateConversation);
router.get("/:id/messages", getMessages);
// Any room's message (DM or group), so it sits here with the other chat routes.
router.get("/messages/:messageId/readers", getMessageReaders);
router.post("/:id/read", markAsRead);
router.post("/:id/messages", sendMessage);

export default router;
