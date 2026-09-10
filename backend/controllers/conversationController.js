import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { getIo } from "../services/socketService.js";
import { roomKey } from "../sockets/chatSocket.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import Group from "../models/Group.js";
import Notification from "../models/Notification.js";

// How many messages ship alongside a conversation from
// getOrCreateConversation. Matches the client's own default page size, so
// the seeded page and a later "load older" fetch line up.
const INITIAL_MESSAGE_PAGE = 50;

// GET /api/conversations
// Returns all conversations (DMs) and groups for the current user, sorted by most recent message.
export const getConversations = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // DMs and groups have nothing to do with each other, so they're fetched
  // together rather than as two sequential round trips — this endpoint is on
  // the critical path for opening the Socials tab.
  const [conversations, groups] = await Promise.all([
    Conversation.find({ participants: userId })
      .populate("participants", "username profile_pic_url accountTier")
      .sort({ lastMessageAt: -1 })
      .lean(),
    Group.find({ "members.user": userId })
      .populate("lastMessageSenderId", "username")
      .sort({ lastMessageAt: -1 })
      .lean(),
  ]);

  // Attach unread count and the "other" participant for each conversation
  const dmResults = conversations.map((conv) => ({
    ...conv,
    type: "dm",
    otherUser: conv.participants.find(
      (p) => p._id.toString() !== userId.toString()
    ),
    unreadCount: conv.unreadCounts?.[userId.toString()] ?? 0,
  }));

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
  }).populate("participants", "username profile_pic_url accountTier");

  // Tracked explicitly rather than read off the document: the create branch
  // re-fetches through findById, so the result is a loaded document whose
  // own `isNew` is always false by the time we'd look at it.
  const justCreated = !conversation;
  if (!conversation) {
    // Sort IDs for a consistent order in the document
    const sorted = [userId.toString(), participantId.toString()].sort();
    conversation = await Conversation.create({
      participants: sorted,
      unreadCounts: {},
    });
    conversation = await Conversation.findById(conversation._id).populate(
      "participants",
      "username profile_pic_url accountTier"
    );
  }

  // The first page of messages ships with the conversation.
  //
  // Opening a DM from a profile used to be two sequential round trips —
  // find-or-create the conversation, then go back for its messages — with
  // the chat sitting on a skeleton for both. The client can't ask for
  // messages until it knows the conversation id, so the only way to collapse
  // that is from this end. A brand-new conversation has none, and skipping
  // the query for that case costs nothing to check.
  const messages = justCreated
    ? []
    : (
        await Message.find({ roomType: "dm", roomId: conversation._id })
          .populate("sender", "username profile_pic_url accountTier")
          .sort({ createdAt: -1 })
          .limit(INITIAL_MESSAGE_PAGE + 1)
          .lean()
      );
  const hasMore = messages.length > INITIAL_MESSAGE_PAGE;

  const result = {
    ...conversation.toObject(),
    otherUser: conversation.participants.find(
      (p) => p._id.toString() !== userId.toString()
    ),
    unreadCount: conversation.unreadCounts?.get?.(userId.toString()) ?? 0,
    // Oldest-first, matching what GET /:id/messages returns.
    messages: messages.slice(0, INITIAL_MESSAGE_PAGE).reverse(),
    messagesPagination: { hasMore, limit: INITIAL_MESSAGE_PAGE, before: null },
  };

  sendSuccess(res, result, "Conversation ready");
});

// GET /api/conversations/:id/messages
// Returns messages for the conversation. Supports cursor pagination with `before` and `limit`.
export const getMessages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const before = req.query.before ? new Date(req.query.before) : null;

  // The membership check and the message fetch are fired together rather
  // than one after the other. They don't depend on each other's data, only
  // on the check's *outcome* — so a rejected read just discards work that
  // was already in flight, while every legitimate read (the overwhelming
  // majority) stops paying for two sequential round trips.
  const dmQuery = { roomType: "dm", roomId: id };
  if (before) dmQuery.createdAt = { $lt: before };

  let [conversation, dmMessages] = await Promise.all([
    Conversation.findById(id).select("participants").lean(),
    Message.find(dmQuery)
      .populate("sender", "username profile_pic_url accountTier")
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean(),
  ]);

  if (conversation) {
    // It's a DM
    const isParticipant = conversation.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!isParticipant) return sendError(res, "Not a participant", 403);

    const messages = dmMessages;

    const hasMore = messages.length > limit;
    const result = messages.slice(0, limit).reverse();

    return res.status(200).json({
      success: true,
      message: "Messages fetched",
      data: result,
      pagination: {
        hasMore,
        limit,
        before: before ? before.toISOString() : null,
      },
    });
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

    const query = {
      roomType: "group",
      roomId: group._id,
    };

    if (before) query.createdAt = { $lt: before };

    const messages = await Message.find(query)
      .populate("sender", "username profile_pic_url accountTier")
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = messages.length > limit;
    const result = messages.slice(0, limit).reverse();

    return res.status(200).json({
      success: true,
      message: "Messages fetched",
      data: result,
      pagination: {
        hasMore,
        limit,
        before: before ? before.toISOString() : null,
      },
    });
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
  const { text, type = "text", contentId, contentType, contentData, analysisData, profileData } = req.body;

  // Validate message based on type
  if (type === "recommendation") {
    if (!text?.trim() || text.length > 1000)
      return sendError(res, "Invalid message text", 400);
    if (!contentId || !contentType || !["movie", "series"].includes(contentType))
      return sendError(res, "Invalid recommendation data", 400);
  } else if (type === "analysis_share") {
    if (!analysisData) return sendError(res, "Missing analysis data", 400);
  } else if (type === "profile_share") {
    if (!profileData?.userId || !profileData?.username)
      return sendError(res, "Missing profile data", 400);
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
  } else if (type === "analysis_share") {
    messageData.analysisData = analysisData;
  } else if (type === "profile_share") {
    messageData.profileData = {
      userId: profileData.userId,
      username: profileData.username,
      profile_pic_url: profileData.profile_pic_url || null,
      accountTier: profileData.accountTier || null,
    };
  }

  const message = await Message.create(messageData);

  const populated = await Message.findById(message._id)
    .populate("sender", "username profile_pic_url accountTier")
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
  
  // Create DB notification
  await Notification.create({
    user: otherId,
    sender: userId,
    type: 'message',
    conversationId: conversation._id
  });

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

    // Send real-time notification to the receiver
    io.to(`user:${otherId}`).emit("new-notification", {
      type: 'message',
      sender: { _id: userId, username: req.user.username },
      conversationId: conversation._id,
      createdAt: new Date()
    });
  }

  sendSuccess(res, populated, "Message sent", 201);
});
