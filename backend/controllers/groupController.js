import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { getIo } from "../services/socketService.js";
import { roomKey } from "../sockets/chatSocket.js";
import Group from "../models/Group.js";
import Message from "../models/Message.js";

// GET /api/groups
export const getAllGroups = asyncHandler(async (req, res) => {
  const groups = await Group.find({})
    .select("-members")
    .sort({ memberCount: -1 })
    .lean();

  let joinedIds = new Set();
  if (req.user) {
    const joined = await Group.find({ "members.user": req.user._id })
      .select("_id")
      .lean();
    joinedIds = new Set(joined.map((g) => g._id.toString()));
  }

  const result = groups.map((g) => ({
    ...g,
    isMember: joinedIds.has(g._id.toString()),
  }));

  sendSuccess(res, result, "Groups fetched");
});

// GET /api/groups/:slug
export const getGroupBySlug = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug })
    .select("-members")
    .lean();
  if (!group) return sendError(res, "Group not found", 404);

  const isMember = req.user
    ? !!(await Group.exists({
        slug: req.params.slug,
        "members.user": req.user._id,
      }))
    : false;

  sendSuccess(res, { ...group, isMember }, "Group fetched");
});

// POST /api/groups/:slug/join
export const joinGroup = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug });
  if (!group) return sendError(res, "Group not found", 404);

  const alreadyMember = group.members.some(
    (m) => m.user.toString() === req.user._id.toString()
  );
  if (alreadyMember) return sendError(res, "Already a member", 400);

  await Group.findByIdAndUpdate(group._id, {
    $push: { members: { user: req.user._id } },
    $inc: { memberCount: 1 },
  });

  sendSuccess(res, null, "Joined group");
});

// POST /api/groups/:slug/leave
export const leaveGroup = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug });
  if (!group) return sendError(res, "Group not found", 404);

  const isMember = group.members.some(
    (m) => m.user.toString() === req.user._id.toString()
  );
  if (!isMember) return sendError(res, "Not a member", 400);

  await Group.findByIdAndUpdate(group._id, {
    $pull: { members: { user: req.user._id } },
    $inc: { memberCount: -1 },
  });

  sendSuccess(res, null, "Left group");
});

// GET /api/groups/:slug/members
export const getGroupMembers = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug })
    .populate("members.user", "username profile_pic_url accountTier")
    .lean();
  if (!group) return sendError(res, "Group not found", 404);

  const members = group.members.sort(
    (a, b) => new Date(a.joinedAt) - new Date(b.joinedAt)
  );
  sendSuccess(res, members, "Members fetched");
});

// GET /api/groups/:slug/messages
// Supports cursor pagination with `before` and `limit`.
export const getGroupMessages = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const before = req.query.before ? new Date(req.query.before) : null;

  const group =
    (await Group.findOne({ slug: req.params.slug })
      .select("_id members")
      .lean()) ||
    (await Group.findById(req.params.slug).select("_id members").lean());

  if (!group) return sendError(res, "Group not found", 404);

  const isMember = group.members.some(
    (m) => m.user.toString() === req.user._id.toString()
  );
  if (!isMember) return sendError(res, "Not a member of this group", 403);

  const query = { roomType: "group", roomId: group._id };
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
});

// POST /api/groups/:groupId/markAsRead
export const markGroupAsRead = asyncHandler(async (req, res) => {
  const group = await Group.findById(req.params.groupId);
  if (!group) return sendError(res, "Group not found", 404);

  const isMember = group.members.some(
    (m) => m.user.toString() === req.user._id.toString()
  );
  if (!isMember) return sendError(res, "Not a member of this group", 403);

  // Reset unread count for this user
  const userId = req.user._id.toString();
  group.unreadCounts.set(userId, 0);
  await group.save();

  sendSuccess(res, null, "Group marked as read");
});

// POST /api/groups/:slug/messages
export const sendGroupMessage = asyncHandler(async (req, res) => {
  const { text, type = "text", contentId, contentType, contentData, analysisData } = req.body;

  // Validate message based on type
  if (type === "recommendation") {
    if (!text?.trim() || text.length > 1000)
      return sendError(res, "Invalid message text", 400);
    if (!contentId || !contentType || !["movie", "series"].includes(contentType))
      return sendError(res, "Invalid recommendation data", 400);
  } else if (type === "analysis_share") {
    if (!analysisData) return sendError(res, "Missing analysis data", 400);
  } else {
    // text message
    if (!text?.trim() || text.length > 1000) {
      return sendError(res, "Invalid message text", 400);
    }
  }

  // Accept both groupId (ID) and slug
  const groupId = req.params.groupId;
  let group;
  
  // Try as ID first
  group = await Group.findById(groupId).select("_id members").lean();
  
  // If not found by ID, try as slug
  if (!group) {
    group = await Group.findOne({ slug: groupId }).select("_id members").lean();
  }

  if (!group) return sendError(res, "Group not found", 404);

  const isMember = group.members.some(
    (m) => m.user.toString() === req.user._id.toString()
  );
  if (!isMember) return sendError(res, "Not a member of this group", 403);

  // Create message with optional recommendation fields
  const messageData = {
    roomType: "group",
    roomId: group._id,
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
  }

  const message = await Message.create(messageData);

  const populated = await Message.findById(message._id)
    .populate("sender", "username profile_pic_url accountTier")
    .lean();

  // This REST path (used for one-off sends like recommendation/analysis-share
  // that don't go through the socket) has no socket equivalent to update the
  // group's inbox preview, unlike plain-text group messages — mirror
  // chatSocket.js's group handling here so the sender's and members' inboxes
  // don't go stale after a share.
  const senderId = req.user._id.toString();
  const memberIds = group.members
    .map((m) => m.user.toString())
    .filter((id) => id !== senderId);
  const incrObj = {};
  memberIds.forEach((memberId) => {
    incrObj[`unreadCounts.${memberId}`] = 1;
  });
  const previewText = text.trim();
  const lastMessageAt = new Date();
  await Group.findByIdAndUpdate(group._id, {
    lastMessage: previewText,
    lastMessageAt,
    lastMessageSenderId: senderId,
    ...(Object.keys(incrObj).length > 0 && { $inc: incrObj }),
  });

  // Broadcast to all connected room members in real-time
  const io = getIo();
  if (io) {
    io.to(roomKey("group", group._id.toString())).emit("new-message", populated);

    const payload = {
      roomType: "group",
      groupId: group._id.toString(),
      lastMessage: previewText,
      lastMessageAt,
      senderId,
    };
    memberIds.forEach((memberId) => {
      io.to(`user:${memberId}`).emit("conversation-updated", payload);
    });
    io.to(`user:${senderId}`).emit("conversation-updated", payload);
  }

  sendSuccess(res, populated, "Message sent", 201);
});
