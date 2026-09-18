import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { getIo } from "../services/socketService.js";
import { roomKey } from "../sockets/chatSocket.js";
import Group from "../models/Group.js";
import Message from "../models/Message.js";

// Same value/reasoning as shareController.js's own RECOMMENDATION_COOLDOWN_MS
// (Medya) and conversationController.js's own copy (DMs) — see
// sendGroupMessage's own recommendation branch below for the direct ask
// this satisfies. Kept as 3 independent per-file constants rather than one
// shared import, matching this codebase's existing convention for cooldown
// constants (see shareController.js's REVIEW_SHARE_COOLDOWN_MS).
const RECOMMENDATION_COOLDOWN_MS = 60 * 60 * 1000;

// How many of the people the viewer follows are members of each group
// (matching `match`), keyed by group id — for the app's "Friends Joined"
// sort. One aggregation over the member arrays, which never leave the
// database; nobody signed in, or following nobody, skips it entirely.
async function friendsJoinedByGroup(user, match = {}) {
  const followingIds = user?.following ?? [];
  if (followingIds.length === 0) return new Map();
  const rows = await Group.aggregate([
    { $match: match },
    { $project: { friendsJoined: { $size: { $setIntersection: [{ $ifNull: ["$members.user", []] }, followingIds] } } } },
  ]);
  return new Map(rows.map((row) => [row._id.toString(), row.friendsJoined]));
}

// GET /api/groups
export const getAllGroups = asyncHandler(async (req, res) => {
  // Independent queries — parallelized instead of sequential round trips.
  const [groups, joined, friendsJoined] = await Promise.all([
    // Not members or unreadCounts: the list only needs each group's own
    // details, and unreadCounts holds every member's private unread count.
    Group.find({})
      .select("-members -unreadCounts")
      .sort({ memberCount: -1 })
      .lean(),
    req.user
      ? Group.find({ "members.user": req.user._id })
          .select("_id")
          .lean()
      : Promise.resolve([]),
    friendsJoinedByGroup(req.user),
  ]);
  const joinedIds = new Set(joined.map((g) => g._id.toString()));

  const result = groups.map((g) => ({
    ...g,
    isMember: joinedIds.has(g._id.toString()),
    friendsJoined: friendsJoined.get(g._id.toString()) ?? 0,
  }));

  sendSuccess(res, result, "Groups fetched");
});

// GET /api/groups/:slug
export const getGroupBySlug = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug })
    .select("-members -unreadCounts")
    .lean();
  if (!group) return sendError(res, "Group not found", 404);

  const [isMember, friendsJoined] = await Promise.all([
    req.user ? Group.exists({ slug: req.params.slug, "members.user": req.user._id }).then(Boolean) : false,
    friendsJoinedByGroup(req.user, { _id: group._id }),
  ]);

  sendSuccess(
    res,
    { ...group, isMember, friendsJoined: friendsJoined.get(group._id.toString()) ?? 0 },
    "Group fetched"
  );
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
  const { text, type = "text", contentId, contentType, contentData, analysisData, listData } = req.body;

  // Validate message based on type
  if (type === "recommendation") {
    if (!text?.trim() || text.length > 1000)
      return sendError(res, "Invalid message text", 400);
    if (!contentId || !contentType || !["movie", "series"].includes(contentType))
      return sendError(res, "Invalid recommendation data", 400);
  } else if (type === "analysis_share") {
    if (!analysisData) return sendError(res, "Missing analysis data", 400);
  } else if (type === "list_share") {
    if (!listData?.listId || !listData?.name) return sendError(res, "Missing list data", 400);
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

  // Anti-spam cooldown, same shape/window as shareController.js's own
  // RECOMMENDATION_COOLDOWN_MS for a Medya recommendation and
  // conversationController.js's own copy for a DM — direct ask:
  // recommending the same title to Medya, a person, and a group in one
  // sitting must all still work independently, only re-recommending the
  // SAME title to this SAME group within the window is blocked.
  if (type === "recommendation") {
    const recentRecommendationInThisGroup = await Message.findOne({
      roomType: "group",
      roomId: group._id,
      sender: req.user._id,
      type: "recommendation",
      contentId,
      contentType,
      createdAt: { $gte: new Date(Date.now() - RECOMMENDATION_COOLDOWN_MS) },
    })
      .sort({ createdAt: -1 })
      .select("createdAt")
      .lean();
    if (recentRecommendationInThisGroup) {
      const retryAfterMs = recentRecommendationInThisGroup.createdAt.getTime() + RECOMMENDATION_COOLDOWN_MS - Date.now();
      return sendError(res, "You just recommended this to this group. Try again later.", 429, { retryAfterMs });
    }
  }

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
  } else if (type === "list_share") {
    messageData.listData = {
      listId: listData.listId,
      name: listData.name,
      itemCount: listData.itemCount || 0,
      previewPosters: listData.previewPosters || [],
    };
  }

  const message = await Message.create(messageData);

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

  // populated (re-fetches `message` by its already-known id) and the Group
  // update are independent — parallelized instead of 2 sequential round trips.
  const [populated] = await Promise.all([
    Message.findById(message._id)
      .populate("sender", "username profile_pic_url accountTier")
      .lean(),
    Group.findByIdAndUpdate(group._id, {
      lastMessage: previewText,
      lastMessageAt,
      lastMessageSenderId: senderId,
      ...(Object.keys(incrObj).length > 0 && { $inc: incrObj }),
    }),
  ]);

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
      // Lets an open inbox label the preview ("ana: …") without refetching.
      senderUsername: req.user.username,
    };
    memberIds.forEach((memberId) => {
      io.to(`user:${memberId}`).emit("conversation-updated", payload);
    });
    io.to(`user:${senderId}`).emit("conversation-updated", payload);
  }

  sendSuccess(res, populated, "Message sent", 201);
});
