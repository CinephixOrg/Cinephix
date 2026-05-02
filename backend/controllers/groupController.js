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
    .populate("members.user", "username profile_pic_url")
    .lean();
  if (!group) return sendError(res, "Group not found", 404);

  const members = group.members.sort(
    (a, b) => new Date(a.joinedAt) - new Date(b.joinedAt)
  );
  sendSuccess(res, members, "Members fetched");
});

// GET /api/groups/:slug/messages
export const getGroupMessages = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug })
    .select("_id members")
    .lean();
  if (!group) return sendError(res, "Group not found", 404);

  const isMember = group.members.some(
    (m) => m.user.toString() === req.user._id.toString()
  );
  if (!isMember) return sendError(res, "Not a member of this group", 403);

  const messages = await Message.find({ roomType: "group", roomId: group._id })
    .populate("sender", "username profile_pic_url")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  sendSuccess(res, messages.reverse(), "Messages fetched");
});

// POST /api/groups/:slug/messages
export const sendGroupMessage = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text?.trim() || text.length > 1000) {
    return sendError(res, "Invalid message text", 400);
  }

  const group = await Group.findOne({ slug: req.params.slug })
    .select("_id members")
    .lean();
  if (!group) return sendError(res, "Group not found", 404);

  const isMember = group.members.some(
    (m) => m.user.toString() === req.user._id.toString()
  );
  if (!isMember) return sendError(res, "Not a member of this group", 403);

  const message = await Message.create({
    roomType: "group",
    roomId: group._id,
    sender: req.user._id,
    text: text.trim(),
  });

  const populated = await Message.findById(message._id)
    .populate("sender", "username profile_pic_url")
    .lean();

  // Broadcast to all connected room members in real-time
  const io = getIo();
  if (io) {
    io.to(roomKey("group", group._id.toString())).emit("new-message", populated);
  }

  sendSuccess(res, populated, "Message sent", 201);
});
