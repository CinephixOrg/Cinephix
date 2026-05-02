import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Message from "../models/Message.js";
import Group from "../models/Group.js";
import Conversation from "../models/Conversation.js";
import { setIo } from "../services/socketService.js";

/**
 * Generic socket handler for all chat rooms.
 * Room naming convention:  "<roomType>:<roomId>"
 *   - group chat:  "group:<groupId>"
 *   - DMs:         "dm:<conversationId>"
 *   - user inbox:  "user:<userId>"  (receives conversation-updated events)
 *
 * Client events:
 *   join-room              { roomType, roomId }
 *   leave-room             { roomType, roomId }
 *   send-message           { roomType, roomId, text }
 *   join-inbox             (subscribe to personal inbox updates)
 *
 * Server events:
 *   new-message            <Message doc with populated sender>
 *   conversation-updated   { conversationId, lastMessage, lastMessageAt, senderId }
 *   error                  { message: string }
 */
export const setupChat = (io) => {
  setIo(io);

  // Authenticate every socket connection via JWT
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id)
        .select("_id username profile_pic_url")
        .lean();
      if (!user) return next(new Error("User not found"));
      socket.user = user;
      next();
    } catch {
      next(new Error("Token verification failed"));
    }
  });

  io.on("connection", (socket) => {
    // Auto-join the user's personal inbox room so they receive DM notifications
    socket.join(`user:${socket.user._id}`);

    // ── Join a chat room ──────────────────────────────────────────────────
    socket.on("join-room", async ({ roomType, roomId }) => {
      const authorized = await canAccessRoom(socket.user._id, roomType, roomId);
      if (!authorized) {
        socket.emit("error", { message: "Not authorized to join this room" });
        return;
      }
      socket.join(roomKey(roomType, roomId));
    });

    // ── Leave a chat room ─────────────────────────────────────────────────
    socket.on("leave-room", ({ roomType, roomId }) => {
      socket.leave(roomKey(roomType, roomId));
    });

    // ── Send a message ────────────────────────────────────────────────────
    socket.on("send-message", async ({ roomType, roomId, text }) => {
      try {
        if (!text?.trim() || text.length > 1000) {
          socket.emit("error", { message: "Invalid message" });
          return;
        }

        const authorized = await canAccessRoom(
          socket.user._id,
          roomType,
          roomId
        );
        if (!authorized) {
          socket.emit("error", { message: "Not a member of this room" });
          return;
        }

        const message = await Message.create({
          roomType,
          roomId,
          sender: socket.user._id,
          text: text.trim(),
        });

        const populated = await Message.findById(message._id)
          .populate("sender", "username profile_pic_url")
          .lean();

        io.to(roomKey(roomType, roomId)).emit("new-message", populated);

        // For DMs: update conversation preview + push inbox notification
        if (roomType === "dm") {
          const userId = socket.user._id.toString();
          const conversation = await Conversation.findById(roomId).select(
            "participants"
          );
          if (conversation) {
            const otherId = conversation.participants
              .find((p) => p.toString() !== userId)
              ?.toString();

            await Conversation.findByIdAndUpdate(roomId, {
              lastMessage: text.trim(),
              lastMessageAt: new Date(),
              ...(otherId && { $inc: { [`unreadCounts.${otherId}`]: 1 } }),
            });

            const payload = {
              conversationId: roomId,
              lastMessage: text.trim(),
              lastMessageAt: new Date(),
              senderId: userId,
            };
            if (otherId) io.to(`user:${otherId}`).emit("conversation-updated", payload);
            io.to(`user:${userId}`).emit("conversation-updated", payload);
          }
        }
      } catch {
        socket.emit("error", { message: "Failed to send message" });
      }
    });
  });
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export const roomKey = (roomType, roomId) => `${roomType}:${roomId}`;

async function canAccessRoom(userId, roomType, roomId) {
  if (roomType === "group") {
    const group = await Group.findById(roomId).select("members").lean();
    if (!group) return false;
    return group.members.some((m) => m.user.toString() === userId.toString());
  }

  if (roomType === "dm") {
    const conversation = await Conversation.findById(roomId)
      .select("participants")
      .lean();
    if (!conversation) return false;
    return conversation.participants.some(
      (p) => p.toString() === userId.toString()
    );
  }

  return false;
}
