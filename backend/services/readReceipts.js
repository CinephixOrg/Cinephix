import Message from "../models/Message.js";
import { getIo } from "./socketService.js";
import { groupBySender } from "../utils/readReceipts.js";

/**
 * Someone has read a room up to now: their unread messages there get a read
 * receipt, and each sender is told which of their messages were read, so
 * the ticks turn as it happens.
 *
 * `unread` is the reader's unread count from just before it was reset —
 * exactly the room's newest messages from other people that they hadn't
 * seen. Only those are stamped, so reading a room never marks its older
 * history (from before read receipts existed) as read just now.
 *
 * A receipt is a nicety: it never fails the read itself.
 */
export async function recordRead({ roomType, roomId, userId, unread }) {
  if (!(unread > 0)) return;
  try {
    const unreadMessages = await Message.find({
      roomType,
      roomId,
      sender: { $ne: userId },
      "readBy.user": { $ne: userId },
    })
      .sort({ createdAt: -1 })
      .limit(unread)
      .select("_id sender")
      .lean();
    if (unreadMessages.length === 0) return;

    const at = new Date();
    await Message.updateMany(
      { _id: { $in: unreadMessages.map((message) => message._id) }, "readBy.user": { $ne: userId } },
      { $push: { readBy: { user: userId, at } } }
    );

    const io = getIo();
    if (!io) return;
    for (const [senderId, messageIds] of groupBySender(unreadMessages)) {
      io.to(`user:${senderId}`).emit("messages-read", {
        roomType,
        roomId: String(roomId),
        userId: String(userId),
        at: at.toISOString(),
        messageIds,
      });
    }
  } catch (error) {
    console.error("Read receipt failed:", error?.message);
  }
}
