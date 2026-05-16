import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { getIo } from "../services/socketService.js";
import { roomKey } from "../sockets/chatSocket.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import Group from "../models/Group.js";

// GET /api/conversations
// Returns all conversations (DMs) and groups for the current user, sorted by most recent message.
export const getConversations = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Get all 1-on-1 DM conversations
  const conversations = await Conversation.find({ participants: userId })
    .populate("participants", "username profile_pic_url")
    .sort({ lastMessageAt: -1 })
    .lean();

  // Attach unread count and the "other" participant for each conversation
  const dmResults = conversations.map((conv) => ({
    ...conv,
    type: "dm",
    otherUser: conv.participants.find(
      (p) => p._id.toString() !== userId.toString()
    ),
    unreadCount: conv.unreadCounts?.[userId.toString()] ?? 0,
  }));

  // Get all groups the user is a member of
  const groups = await Group.find({
    "members.user": userId,
  })
    .populate("lastMessageSenderId", "username")
    .sort({ lastMessageAt: -1 })
    .lean();

  const groupResults = groups.map((group) => ({
    ...group,
    type: "group",
    unreadCount: group.unreadCounts?.[userId.toString()] ?? 0,
  }));

  // Merge and sort by most recent message (both DMs and groups)
  const allChats = [...dmResults, ...groupResults].sort(
    (a, b) =>
      new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
  );

  sendSuccess(res, allChats, "Conversations and groups fetched");
});

// POST /api/conversations
// Get or create a 1-on-1 conversation with another user.
// Body: { participantId }
export const getOrCreateConversation = asyncHandler(async (req, res) => {
  const { participantId } = req.body;
  const userId = req.user._id;

  if (!participantId) return sendError(res, "participantId is required", 400);
  if (participantId === userId.toString())
    return sendError(res, "Cannot DM yourself", 400);

  const other = await User.findById(participantId).select("_id").lean();
  if (!other) return sendError(res, "User not found", 404);

  // Find existing conversation between the two users (order-independent)
  let conversation = await Conversation.findOne({
    participants: { $all: [userId, participantId], $size: 2 },
  }).populate("participants", "username profile_pic_url");

  if (!conversation) {
    // Sort IDs for a consistent order in the document
    const sorted = [userId.toString(), participantId.toString()].sort();
    conversation = await Conversation.create({
      participants: sorted,
      unreadCounts: {},
    });
    conversation = await Conversation.findById(conversation._id).populate(
      "participants",
      "username profile_pic_url"
    );
  }

  const result = {
    ...conversation.toObject(),
    otherUser: conversation.participants.find(
      (p) => p._id.toString() !== userId.toString()
    ),
    unreadCount: conversation.unreadCounts?.get?.(userId.toString()) ?? 0,
  };

  sendSuccess(res, result, "Conversation ready");
});

// GET /api/conversations/:id/messages
// Returns last 50 messages for the conversation (must be a participant).
export const getMessages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Try to find as a DM conversation first
  let conversation = await Conversation.findById(id)
    .select("participants")
    .lean();

  if (conversation) {
    // It's a DM
    const isParticipant = conversation.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!isParticipant) return sendError(res, "Not a participant", 403);

    const messages = await Message.find({
      roomType: "dm",
      roomId: conversation._id,
    })
      .populate("sender", "username profile_pic_url")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return sendSuccess(res, messages.reverse(), "Messages fetched");
  }

  // Try to find as a group
  let group = await Group.findById(id)
    .select("_id members")
    .lean();

  if (group) {
    // It's a group
    const isMember = group.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );
    if (!isMember) return sendError(res, "Not a member of this group", 403);

    const messages = await Message.find({
      roomType: "group",
      roomId: group._id,
    })
      .populate("sender", "username profile_pic_url")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return sendSuccess(res, messages.reverse(), "Messages fetched");
  }

  // Neither found
  sendError(res, "Conversation or group not found", 404);
});

// POST /api/conversations/:id/read
// Resets the current user's unread count to 0.
export const markAsRead = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();

  await Conversation.findByIdAndUpdate(req.params.id, {
    $set: { [`unreadCounts.${userId}`]: 0 },
  });

  sendSuccess(res, null, "Marked as read");
});

// POST /api/conversations/:id/messages  (REST fallback)
export const sendMessage = asyncHandler(async (req, res) => {
  const { text, type = "text", contentId, contentType, contentData } = req.body;

  // Validate message based on type
  if (type === "recommendation") {
    if (!text?.trim() || text.length > 1000)
      return sendError(res, "Invalid message text", 400);
    if (!contentId || !contentType || !["movie", "series"].includes(contentType))
      return sendError(res, "Invalid recommendation data", 400);
  } else {
    // text message
    if (!text?.trim() || text.length > 1000)
      return sendError(res, "Invalid message text", 400);
  }

  const conversation = await Conversation.findById(req.params.id).select(
    "participants"
  );
  if (!conversation) return sendError(res, "Conversation not found", 404);

  const userId = req.user._id.toString();
  const isParticipant = conversation.participants.some(
    (p) => p.toString() === userId
  );
  if (!isParticipant) return sendError(res, "Not a participant", 403);

  // Create message with optional recommendation fields
  const messageData = {
    roomType: "dm",
    roomId: conversation._id,
    sender: req.user._id,
    text: text.trim(),
    type,
  };

  if (type === "recommendation") {
    messageData.contentId = contentId;
    messageData.contentType = contentType;
    if (contentData) {
      messageData.contentData = {
        title: contentData.title,
        posterUrl: contentData.posterUrl,
        genres: contentData.genres || [],
        releaseYear: contentData.releaseYear || null,
        overview: contentData.overview || '',
        rating: contentData.rating || null,
      };
    }
  }

  const message = await Message.create(messageData);

  const populated = await Message.findById(message._id)
    .populate("sender", "username profile_pic_url")
    .lean();

  // Update conversation preview + unread count for the other participant
  const otherId = conversation.participants
    .find((p) => p.toString() !== userId)
    .toString();

  await Conversation.findByIdAndUpdate(conversation._id, {
    lastMessage: text.trim(),
    lastMessageAt: new Date(),
    $inc: { [`unreadCounts.${otherId}`]: 1 },
  });

  // Broadcast via Socket.io
  const io = getIo();
  if (io) {
    io.to(roomKey("dm", conversation._id.toString())).emit(
      "new-message",
      populated
    );
    // Notify both participants so their inbox updates in real-time
    [userId, otherId].forEach((pid) => {
      io.to(`user:${pid}`).emit("conversation-updated", {
        conversationId: conversation._id,
        lastMessage: text.trim(),
        lastMessageAt: new Date(),
        senderId: userId,
      });
    });
  }

  sendSuccess(res, populated, "Message sent", 201);
});
