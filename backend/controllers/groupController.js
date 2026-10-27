import { listShareData } from "../utils/listShareData.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import cloudinary from "../config/cloudinaryConfig.js";
import { getIo } from "../services/socketService.js";
import { roomKey } from "../sockets/chatSocket.js";
import Group from "../models/Group.js";
import Message from "../models/Message.js";
import Share from "../models/Share.js";
import CustomList from "../models/CustomList.js";
import User from "../models/User.js";
import Rating from "../models/Rating.js";
import GroupChallenge from "../models/GroupChallenge.js";
import GroupWatchParty from "../models/GroupWatchParty.js";
import GroupAnnouncement from "../models/GroupAnnouncement.js";
import { renderPollHighlight, renderWatchPartyHighlight } from "../services/highlightCardService.js";
import { hydrateContentData } from "./shareController.js";
import { hydratePreviewItems } from "../utils/listPreview.js";
import { normalizeListItems } from "../utils/listItems.js";
import { recordRead } from "../services/readReceipts.js";
import { receiptsForViewer } from "../utils/readReceipts.js";

// Same value/reasoning as shareController.js's own RECOMMENDATION_COOLDOWN_MS
// (Media) and conversationController.js's own copy (DMs) — see
// sendGroupMessage's own recommendation branch below for the direct ask
// this satisfies. Kept as 3 independent per-file constants rather than one
// shared import, matching this codebase's existing convention for cooldown
// constants (see shareController.js's REVIEW_SHARE_COOLDOWN_MS).
const RECOMMENDATION_COOLDOWN_MS = 60 * 60 * 1000;

// How many of a partner community's earliest joiners get the
// community-scoped "Founding Member" tag (see memberSchema.isFoundingMember
// on Group.js) — a flexible 50-100 per the agreed design; picked the
// midpoint rather than making this per-group configurable, since no admin-
// facing reason to tune it per community came up during design.
const FOUNDING_MEMBER_CUTOFF = 75;

async function isGroupOwner(group, userId) {
  return Boolean(group?.owner) && group.owner.toString() === userId.toString();
}

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
    // Explicit inclusion projection (not the old "-members -unreadCounts"
    // shorthand) so `members` can be sliced server-side instead of
    // excluded outright — MongoDB doesn't allow mixing inclusion and
    // exclusion in one projection, and `$slice` counts as inclusion.
    // unreadCounts (every member's private unread count) and the members'
    // own raw joinedAt/isFoundingMember stay un-sent either way; only up to
    // 10 member ids pass through, resolved to avatars below for Discover's
    // "Popular Communities" card (its member-avatar carousel).
    // owner IS populated here (unlike that select) — a real bug, caught
    // live: the mobile client's "am I this community's owner" check reads
    // owner._id off whichever copy of the group it currently has, and this
    // list is the FIRST copy a community's own page ever sees (per
    // useCommunity.ts's own doc comment) — an un-populated owner (just a
    // raw id string here) made every admin control silently fail to
    // render until a slower, separate re-render replaced it.
    Group.find(
      {},
      {
        slug: 1,
        name: 1,
        description: 1,
        category: 1,
        tags: 1,
        coverImage: 1,
        memberCount: 1,
        isPreset: 1,
        owner: 1,
        accentColor: 1,
        socialLinks: 1,
        pinnedListIds: 1,
        pinnedPollId: 1,
        activeChallengeId: 1,
        feedAnnouncements: 1,
        createdAt: 1,
        updatedAt: 1,
        members: { $slice: -10 },
      }
    )
      .sort({ memberCount: -1 })
      .populate("owner", "username profile_pic_url accountTier")
      .lean(),
    req.user
      ? Group.find({ "members.user": req.user._id })
          .select("_id")
          .lean()
      : Promise.resolve([]),
    friendsJoinedByGroup(req.user),
  ]);
  const joinedIds = new Set(joined.map((g) => g._id.toString()));

  const allMemberIds = [...new Set(groups.flatMap((g) => (g.members || []).map((m) => m.user.toString())))];
  const memberUsers = allMemberIds.length ? await User.find({ _id: { $in: allMemberIds } }).select("username profile_pic_url").lean() : [];
  const memberUserMap = new Map(memberUsers.map((u) => [u._id.toString(), u]));

  const result = groups.map((g) => {
    const { members, ...rest } = g;
    return {
      ...rest,
      isMember: joinedIds.has(g._id.toString()),
      friendsJoined: friendsJoined.get(g._id.toString()) ?? 0,
      previewMembers: (members || [])
        .map((m) => memberUserMap.get(m.user.toString()))
        .filter(Boolean)
        .map((u) => ({ _id: u._id, username: u.username, profilePicUrl: u.profile_pic_url })),
    };
  });

  sendSuccess(res, result, "Groups fetched");
});

// GET /api/groups/:slug
export const getGroupBySlug = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug })
    .select("-members -unreadCounts")
    .populate("owner", "username profile_pic_url accountTier")
    .lean();
  if (!group) return sendError(res, "Group not found", 404);

  const userId = req.user?._id;
  const [isMember, friendsJoined, pinnedListRows, pinnedPoll] = await Promise.all([
    userId ? Group.exists({ slug: req.params.slug, "members.user": userId }).then(Boolean) : false,
    friendsJoinedByGroup(req.user, { _id: group._id }),
    // hydratePreviewItems takes an array (its own shared shape with
    // /discover etc.) — up to 3 here now (pinnedListIds), was a single
    // element. Order preserved below to match pinnedListIds itself (the
    // admin's own chosen order from the community's list page), not
    // whatever order Mongo happens to return them in.
    (group.pinnedListIds || []).length
      ? CustomList.find({ _id: { $in: group.pinnedListIds } })
          .select("name description items likes views isPublic allowMemberAdd createdAt updatedAt")
          .lean()
          .then((rows) => hydratePreviewItems(rows, 20))
      : Promise.resolve([]),
    group.pinnedPollId ? Share.findById(group.pinnedPollId).lean() : Promise.resolve(null),
  ]);

  const pinnedListById = new Map(pinnedListRows.map((l) => [l._id.toString(), l]));
  const pinnedLists = (group.pinnedListIds || [])
    .map((id) => pinnedListById.get(id.toString()))
    .filter(Boolean)
    .map((l) => ({
      _id: l._id,
      name: l.name,
      description: l.description,
      itemCount: l.items.length,
      items: l.items,
      previewItems: l.previewItems,
      likeCount: (l.likes || []).length,
      views: l.views || 0,
      isPublic: !!l.isPublic,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      allowMemberAdd: !!l.allowMemberAdd,
    }));

  // Same "first 5 voters" avatar preview voteOnPoll's own response
  // includes — loaded here the same way, against the already-fetched lean
  // poll doc rather than a second aggregation.
  const pollVoterIds = pinnedPoll
    ? [...new Set(pinnedPoll.pollData.options.flatMap((o) => o.votes.slice(0, 5).map((id) => id.toString())))]
    : [];
  const pollVoters = pollVoterIds.length
    ? await User.find({ _id: { $in: pollVoterIds } }).select("username profile_pic_url").lean()
    : [];
  const pollVoterMap = new Map(pollVoters.map((u) => [u._id.toString(), u]));

  // Same shape voteOnPoll's own response returns, so the mobile client's
  // poll-rendering code (built against that shape already) works
  // unmodified here — voteCount/userVoteIndex instead of the raw votes
  // arrays, which would otherwise leak every voter's id to every viewer.
  const pinnedPollData = pinnedPoll
    ? {
        _id: pinnedPoll._id,
        // Read by the mobile client to show a "New" badge on a poll created
        // recently — same signal GroupChallenge's own createdAt already
        // provides for free via its lean doc spread.
        createdAt: pinnedPoll.createdAt,
        // The admin's own free-text question (createGroupPoll) — unlike a
        // personal Watchlist poll in Media, this is never synthesized
        // client-side, so it has to actually be sent here.
        question: pinnedPoll.pollData.question || "",
        expiresAt: pinnedPoll.pollData.expiresAt || null,
        isExpired: !!(pinnedPoll.pollData.expiresAt && pinnedPoll.pollData.expiresAt < new Date()),
        options: pinnedPoll.pollData.options.map((o) => ({
          text: o.text,
          contentId: o.contentId,
          contentType: o.contentType,
          posterUrl: o.posterUrl,
          voteCount: o.votes.length,
          topVoters: o.votes.slice(0, 5).map((id) => pollVoterMap.get(id.toString())).filter(Boolean),
        })),
        // null (not findIndex's own -1 "not found") — matches
        // shareHydrationStages' own userVoteIndex convention elsewhere in
        // this feature.
        userVoteIndex: (() => {
          if (!userId) return null;
          const idx = pinnedPoll.pollData.options.findIndex((o) => o.votes.some((v) => v.toString() === userId.toString()));
          return idx === -1 ? null : idx;
        })(),
      }
    : null;

  sendSuccess(
    res,
    {
      ...group,
      isMember,
      friendsJoined: friendsJoined.get(group._id.toString()) ?? 0,
      pinnedLists,
      pinnedPoll: pinnedPollData,
    },
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

  // Stamped from the group's own memberCount at THIS moment, before this
  // join is counted — joiner #75 (FOUNDING_MEMBER_CUTOFF) is still inside
  // the window, joiner #76 is not.
  const isFoundingMember = group.memberCount < FOUNDING_MEMBER_CUTOFF;

  await Group.findByIdAndUpdate(group._id, {
    $push: { members: { user: req.user._id, isFoundingMember } },
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
  const result = receiptsForViewer(messages.slice(0, limit).reverse(), req.user._id);

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

  // Reset unread count for this user, and give the messages it stood for a
  // read receipt.
  const userId = req.user._id.toString();
  const unread = group.unreadCounts.get(userId) ?? 0;
  group.unreadCounts.set(userId, 0);
  await group.save();
  await recordRead({ roomType: "group", roomId: group._id, userId: req.user._id, unread });

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
  // RECOMMENDATION_COOLDOWN_MS for a Media recommendation and
  // conversationController.js's own copy for a DM — direct ask:
  // recommending the same title to Media, a person, and a group in one
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
    messageData.listData = listShareData(listData);
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

// Posts a one-time, plain-text announcement into a community's own main
// chat — direct ask: creating a poll/challenge/watch party should land in
// Chat once, discoverably (it scrolling up and out of view later is fine,
// Overview is the lasting home for it). Mirrors sendGroupMessage's own
// broadcast/unread-count tail exactly, so this gets the same real push/
// unread-badge treatment any other group message does, not a silent
// side-channel update. `group` must be a doc with `members` loaded (every
// admin-creation endpoint below already has this from its own ownership
// check).
// `text` is always the plain-text fallback (lastMessage preview, a push
// notification's own body) — `communityAnnouncementData`, when passed,
// makes this a rich card in the chat itself instead of a plain bubble
// (ChatRoom.tsx's own CommunityAnnouncementMessageCard).
async function postGroupAnnouncement(group, sender, text, communityAnnouncementData) {
  const senderId = sender._id.toString();
  const message = await Message.create({
    roomType: "group",
    roomId: group._id,
    sender: sender._id,
    text,
    type: communityAnnouncementData ? "community_announcement" : "text",
    communityAnnouncementData,
  });
  const memberIds = group.members.map((m) => m.user.toString()).filter((id) => id !== senderId);
  const incrObj = {};
  memberIds.forEach((memberId) => {
    incrObj[`unreadCounts.${memberId}`] = 1;
  });
  const lastMessageAt = new Date();

  const [populated] = await Promise.all([
    Message.findById(message._id).populate("sender", "username profile_pic_url accountTier").lean(),
    Group.findByIdAndUpdate(group._id, {
      lastMessage: text,
      lastMessageAt,
      lastMessageSenderId: senderId,
      ...(Object.keys(incrObj).length > 0 && { $inc: incrObj }),
    }),
  ]);

  const io = getIo();
  if (io) {
    io.to(roomKey("group", group._id.toString())).emit("new-message", populated);
    const payload = { roomType: "group", groupId: group._id.toString(), lastMessage: text, lastMessageAt, senderId, senderUsername: sender.username };
    memberIds.forEach((memberId) => io.to(`user:${memberId}`).emit("conversation-updated", payload));
    io.to(`user:${senderId}`).emit("conversation-updated", payload);
  }
}

// ── Partner-community admin endpoints ──────────────────────────────────
// Every one of these checks isGroupOwner itself (not a shared middleware —
// each needs the already-fetched `group` doc for its own update anyway, so
// a separate middleware would just mean fetching it twice).

// PATCH /api/groups/:slug — the owner's own light identity customization
// (name/description/coverImage already existed on this schema; accentColor
// and socialLinks are new). Only the fields actually present in the body
// are touched, so a partial edit (e.g. just the accent color) never clears
// the others.
export const updateGroupIdentity = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug });
  if (!group) return sendError(res, "Group not found", 404);
  if (!(await isGroupOwner(group, req.user._id))) return sendError(res, "Not this community's owner", 403);

  const { name, description, coverImage, accentColor, socialLinks } = req.body;
  if (typeof name === "string" && name.trim()) group.name = name.trim();
  if (typeof description === "string") group.description = description.trim();
  if (typeof coverImage === "string") group.coverImage = coverImage;
  if (typeof accentColor === "string" || accentColor === null) group.accentColor = accentColor;
  if (socialLinks && typeof socialLinks === "object") {
    for (const key of ["instagram", "tiktok", "youtube"]) {
      if (typeof socialLinks[key] === "string" || socialLinks[key] === null) {
        group.socialLinks[key] = socialLinks[key];
      }
    }
  }
  await group.save();

  // Trimmed response, not the raw saved doc — that would leak `members`
  // and every member's own unreadCounts to the client, same exclusion
  // getGroupBySlug/getAllGroups already apply.
  sendSuccess(
    res,
    {
      name: group.name,
      description: group.description,
      coverImage: group.coverImage,
      accentColor: group.accentColor,
      socialLinks: group.socialLinks,
    },
    "Community updated"
  );
});

const FEED_ANNOUNCEMENT_CATEGORIES = ["challenge", "watchparty", "list", "leaderboard"];

// PATCH /api/groups/:slug/feed-settings — opt-in to Discover's "Community
// Announcements" rail (GroupAnnouncement.js's own comment has the full
// picture). Same partial-update shape as updateGroupIdentity above: only
// fields actually present in the body are touched.
export const updateGroupFeedSettings = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug });
  if (!group) return sendError(res, "Group not found", 404);
  if (!(await isGroupOwner(group, req.user._id))) return sendError(res, "Not this community's owner", 403);

  const { enabled, categories } = req.body;
  if (typeof enabled === "boolean") group.feedAnnouncements.enabled = enabled;
  if (Array.isArray(categories)) {
    const valid = categories.filter((c) => FEED_ANNOUNCEMENT_CATEGORIES.includes(c));
    group.feedAnnouncements.categories = [...new Set(valid)];
  }
  await group.save();

  sendSuccess(res, { feedAnnouncements: group.feedAnnouncements }, "Feed settings updated");
});

// POST /api/groups/:slug/cover-image — multipart, field "coverImage".
// Same Cloudinary upload-stream pattern as uploadProfilePic
// (userController.js), its own folder.
export const uploadGroupCoverImage = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug });
  if (!group) return sendError(res, "Group not found", 404);
  if (!(await isGroupOwner(group, req.user._id))) return sendError(res, "Not this community's owner", 403);
  if (!req.file) return sendError(res, "No file uploaded", 400);

  const result = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream({ folder: "group_covers" }, (error, uploaded) => {
      if (error) reject(error);
      else resolve(uploaded);
    });
    uploadStream.end(req.file.buffer);
  });

  group.coverImage = result.secure_url;
  await group.save();

  sendSuccess(res, { coverImage: group.coverImage }, "Cover image uploaded");
});

// POST /api/groups/:slug/list — body: { name, description?, isPublic?,
// items?, allowMemberAdd? }. Creates a brand-new list that belongs to the
// COMMUNITY, not the admin personally (groupId set — CustomList.js's own
// comment, and customListRoute.js's GET /me excludes it) — direct ask,
// replacing the old "pin one of my own existing lists" flow (pinGroupList)
// which left the pinned list stuck showing on the admin's own profile.
// This list persists as its own standalone community list regardless of
// whether it ends up featured — auto-added to pinnedListIds only if there's
// still room (<3); once full, the admin features it manually from the
// community's own list page (listGroupLists/setFeaturedLists below).
export const createGroupList = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug });
  if (!group) return sendError(res, "Group not found", 404);
  if (!(await isGroupOwner(group, req.user._id))) return sendError(res, "Not this community's owner", 403);

  const { name, description, isPublic, items, allowMemberAdd } = req.body;
  if (!name?.trim()) return sendError(res, "Name is required", 400);

  let listItems = [];
  if (items !== undefined) {
    const normalized = normalizeListItems(items, [], new Date(), req.user._id);
    if (normalized.error) return sendError(res, normalized.error, 400);
    listItems = normalized.items;
  }

  const list = await CustomList.create({
    owner: req.user._id,
    groupId: group._id,
    name: name.trim(),
    description: description?.trim() || "",
    isPublic: isPublic !== false,
    items: listItems,
    allowMemberAdd: !!allowMemberAdd,
  });

  if ((group.pinnedListIds || []).length < 3) {
    group.pinnedListIds = [...(group.pinnedListIds || []), list._id];
    await group.save();
  }
  // Unlike challenge/watch-party creation above, this flow has no chat
  // announcement today either — just the feed one, gated the same way.
  if (group.feedAnnouncements?.enabled && group.feedAnnouncements.categories.includes("list")) {
    const [hydrated] = await hydratePreviewItems([list.toObject()], 3);
    await GroupAnnouncement.create({
      group: group._id,
      createdBy: req.user._id,
      category: "list",
      title: list.name,
      listId: list._id,
      listData: {
        name: list.name,
        description: list.description,
        itemCount: list.items.length,
        previewItems: hydrated.previewItems,
      },
    }).catch(() => {});
  }

  sendSuccess(res, { list }, "List created");
});

// GET /api/groups/:slug/lists — every list belonging to this community
// (groupId set), for the "See all" page under Featured Lists. Visible to
// anyone who can see the group itself; only the admin can change which
// ones are featured (setFeaturedLists below).
export const listGroupLists = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug }).select("_id pinnedListIds").lean();
  if (!group) return sendError(res, "Group not found", 404);

  const lists = await CustomList.find({ groupId: group._id }).sort({ createdAt: -1 }).lean();
  const hydrated = await hydratePreviewItems(lists, 5);
  const featuredSet = new Set((group.pinnedListIds || []).map((id) => id.toString()));
  sendSuccess(
    res,
    hydrated.map((l) => ({ ...l, isFeatured: featuredSet.has(l._id.toString()) })),
    "Lists fetched"
  );
});

// PATCH /api/groups/:slug/featured-lists — body: { listIds }, up to 3,
// every one of them already belonging to this community. Replaces the
// whole featured set (not a toggle-one-at-a-time endpoint) — matches how
// the mobile selection mode collects taps before a single "Save".
export const setFeaturedLists = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug });
  if (!group) return sendError(res, "Group not found", 404);
  if (!(await isGroupOwner(group, req.user._id))) return sendError(res, "Not this community's owner", 403);

  const { listIds } = req.body;
  if (!Array.isArray(listIds) || listIds.length > 3) return sendError(res, "Pick up to 3 lists", 400);

  const owned = await CustomList.find({ _id: { $in: listIds }, groupId: group._id }).select("_id").lean();
  if (owned.length !== listIds.length) return sendError(res, "Invalid list ids", 400);

  group.pinnedListIds = listIds;
  await group.save();

  sendSuccess(res, { pinnedListIds: listIds }, "Featured lists updated");
});

// POST /api/groups/:slug/poll — body: { question?, items }, 2-5 options.
// Each item is EITHER a catalog pick ({contentId, contentType}, same
// snapshot shape a personal Watchlist poll in Media already uses — unlike
// that one, there's no "must be on your own Watchlist" constraint, the
// admin is curating for the whole community) OR free text ({text}) —
// direct ask: a community poll isn't always "which title," it can be
// "when should we watch," "which movie was better," or anything else the
// admin wants to ask, so an option isn't forced to resolve to a real
// title. `question` is likewise the admin's own free text now, not
// synthesized client-side the way a personal poll's is. Replaces whatever
// poll was pinned before; that older Share stays in the database (its own
// votes included) but is no longer surfaced.
const POLL_QUESTION_MAX = 150;
const POLL_OPTION_TEXT_MAX = 80;

export const createGroupPoll = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug });
  if (!group) return sendError(res, "Group not found", 404);
  if (!(await isGroupOwner(group, req.user._id))) return sendError(res, "Not this community's owner", 403);

  const { items, question, durationDays } = req.body;
  if (!Array.isArray(items) || items.length < 2 || items.length > 5) {
    return sendError(res, "A community poll needs 2 to 5 options", 400);
  }
  if (question !== undefined && question !== null && typeof question !== "string") {
    return sendError(res, "Invalid question", 400);
  }
  // null/undefined means "no end date" — same admin-controlled lifespan
  // idea as a challenge's own deadline, but optional here since not every
  // poll needs a cutoff ("hangi film daha güzel" can stay up forever).
  let expiresAt = null;
  if (durationDays !== undefined && durationDays !== null) {
    const days = Number(durationDays);
    if (!Number.isFinite(days) || days <= 0 || days > 60) return sendError(res, "Invalid durationDays", 400);
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  const seenContent = new Set();
  const options = [];
  for (const it of items) {
    if (it?.contentId && ["movie", "series"].includes(it?.contentType)) {
      const key = `${it.contentType}:${it.contentId}`;
      if (seenContent.has(key)) return sendError(res, "Each title can only appear once", 400);
      seenContent.add(key);
      const hydrated = await hydrateContentData(it.contentId, it.contentType);
      if (!hydrated) return sendError(res, "Content not found", 404);
      options.push({ text: hydrated.title, contentId: it.contentId, contentType: it.contentType, posterUrl: hydrated.posterUrl, votes: [] });
    } else if (typeof it?.text === "string" && it.text.trim()) {
      options.push({ text: it.text.trim().slice(0, POLL_OPTION_TEXT_MAX), votes: [] });
    } else {
      return sendError(res, "Each option needs either a title or your own text", 400);
    }
  }

  const share = await Share.create({
    user: req.user._id,
    type: "poll",
    groupId: group._id,
    pollData: { question: (question || "").trim().slice(0, POLL_QUESTION_MAX), options, expiresAt },
  });
  group.pinnedPollId = share._id;
  await group.save();
  // Never lets a chat-announcement hiccup fail the actual poll creation —
  // this is a nice-to-have side effect, not the critical path.
  await postGroupAnnouncement(
    group,
    req.user,
    `📊 Yeni bir anket başladı!${question ? ` "${question.trim().slice(0, POLL_QUESTION_MAX)}"` : ""}`,
    {
      kind: "poll",
      groupSlug: group.slug,
      groupName: group.name,
      question: (question || "").trim().slice(0, POLL_QUESTION_MAX),
      optionTexts: options.slice(0, 4).map((o) => o.text),
    }
  ).catch(() => {});

  sendSuccess(res, share, "Poll pinned", 201);
});

// POST /api/groups/:slug/challenge — body: { title, items: [{contentId,
// contentType}], deadline }. Same catalog-pick pattern as the poll above.
export const createGroupChallenge = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug });
  if (!group) return sendError(res, "Group not found", 404);
  if (!(await isGroupOwner(group, req.user._id))) return sendError(res, "Not this community's owner", 403);

  const { title, items, deadline } = req.body;
  if (typeof title !== "string" || !title.trim()) return sendError(res, "A challenge needs a title", 400);
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) {
    return sendError(res, "A challenge needs 1 to 50 titles", 400);
  }
  const deadlineDate = new Date(deadline);
  if (Number.isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) {
    return sendError(res, "Invalid deadline", 400);
  }
  for (const it of items) {
    if (!it?.contentId || !["movie", "series"].includes(it?.contentType)) {
      return sendError(res, "Each item needs a valid contentId and contentType", 400);
    }
  }

  const hydrated = await Promise.all(items.map((it) => hydrateContentData(it.contentId, it.contentType)));
  if (hydrated.some((h) => !h)) return sendError(res, "Content not found", 404);

  const challenge = await GroupChallenge.create({
    group: group._id,
    createdBy: req.user._id,
    title: title.trim(),
    deadline: deadlineDate,
    items: items.map((it, i) => ({
      itemId: it.contentId,
      itemType: it.contentType,
      title: hydrated[i].title,
      posterUrl: hydrated[i].posterUrl,
    })),
  });
  group.activeChallengeId = challenge._id;
  await group.save();
  await postGroupAnnouncement(group, req.user, `🏆 Yeni bir challenge başladı: "${challenge.title}"`, {
    kind: "challenge",
    groupSlug: group.slug,
    groupName: group.name,
    title: challenge.title,
    itemCount: challenge.items.length,
    posterUrl: challenge.items.find((it) => it.posterUrl)?.posterUrl || null,
  }).catch(() => {});
  if (group.feedAnnouncements?.enabled && group.feedAnnouncements.categories.includes("challenge")) {
    await GroupAnnouncement.create({
      group: group._id,
      createdBy: req.user._id,
      category: "challenge",
      title: challenge.title,
      itemCount: challenge.items.length,
      posterUrls: challenge.items.map((it) => it.posterUrl).filter(Boolean).slice(0, 6),
    }).catch(() => {});
  }

  sendSuccess(res, challenge, "Challenge created", 201);
});

// GET /api/groups/:slug/challenge — the active challenge plus the
// requester's own progress and how many members have finished it.
// Progress is computed here, not stored: a member's own Rating documents
// are this app's existing "watched" signal (same assumption
// badgeController.js's genre/volume badges already make), intersected
// against the challenge's fixed item list.
export const getGroupChallenge = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug }).select("activeChallengeId members").lean();
  if (!group) return sendError(res, "Group not found", 404);
  if (!group.activeChallengeId) return sendSuccess(res, null, "No active challenge");

  const challenge = await GroupChallenge.findById(group.activeChallengeId).lean();
  if (!challenge) return sendSuccess(res, null, "No active challenge");

  // "Completed" here means WATCHED, not rated — a member who marked a
  // challenge title watched (User.watchlist, despite its confusing name —
  // that's this app's own "already seen" list, not a plan-to-watch one)
  // without ever rating it still genuinely watched it. Direct report: the
  // original version of this only counted a Rating, which silently
  // under-counted that exact case. Rating something always adds it to
  // this same list first (userWatchlistRoute.js's own invariant), so
  // watchlist membership is the broader, correct signal on its own — the
  // leaderboard's own "ratingsGiven" signal (getGroupLeaderboard) is
  // intentionally the stricter, separate one; this isn't that.
  const pairKeys = new Set(challenge.items.map((it) => `${it.itemType}:${it.itemId.toString()}`));
  const memberIds = group.members.map((m) => m.user);

  const users = await User.find({ _id: { $in: memberIds } }).select("watchlist").lean();
  const progressByUser = new Map(
    users.map((u) => [
      u._id.toString(),
      (u.watchlist || []).filter((w) => pairKeys.has(`${w.itemType}:${w.itemId.toString()}`)).length,
    ])
  );

  const myProgress = req.user ? progressByUser.get(req.user._id.toString()) ?? 0 : 0;
  const completedCount = [...progressByUser.values()].filter((count) => count >= challenge.items.length).length;

  sendSuccess(
    res,
    {
      ...challenge,
      myProgress,
      total: challenge.items.length,
      completedCount,
      isExpired: challenge.deadline < new Date(),
    },
    "Challenge fetched"
  );
});

// GET /api/groups/:slug/challenge/detail — the same challenge, but with
// every item (not just a poster) and a per-member breakdown of exactly
// which of those items each member has rated (= watched), not just a
// count. Direct ask: the Overview card alone "hiç bilgi sunmuyor... kim
// neyi izlemiş kaç tane izlemiş" — this backs the Challenge detail screen
// that answers that, kept separate from getGroupChallenge above so the
// Overview card's own fetch (every page load) stays cheap.
export const getGroupChallengeDetail = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug })
    .select("activeChallengeId members")
    .populate("members.user", "username profile_pic_url accountTier")
    .lean();
  if (!group) return sendError(res, "Group not found", 404);
  if (!group.activeChallengeId) return sendSuccess(res, null, "No active challenge");

  const challenge = await GroupChallenge.findById(group.activeChallengeId).lean();
  if (!challenge) return sendSuccess(res, null, "No active challenge");

  // Watched, not rated — see getGroupChallenge's own comment for why
  // (User.watchlist, despite the name, is this app's "already seen" list).
  const pairKeys = new Set(challenge.items.map((it) => `${it.itemType}:${it.itemId.toString()}`));
  const memberIds = group.members.filter((m) => m.user).map((m) => m.user._id);

  const users = memberIds.length ? await User.find({ _id: { $in: memberIds } }).select("watchlist").lean() : [];
  const watchlistByUser = new Map(users.map((u) => [u._id.toString(), u.watchlist || []]));

  const members = group.members
    .filter((m) => m.user)
    .map((m) => {
      const watchlist = watchlistByUser.get(m.user._id.toString()) ?? [];
      const doneKeys = watchlist
        .map((w) => `${w.itemType}:${w.itemId.toString()}`)
        .filter((key) => pairKeys.has(key));
      return {
        user: { _id: m.user._id, username: m.user.username, profile_pic_url: m.user.profile_pic_url },
        completedCount: doneKeys.length,
        completedItemKeys: doneKeys,
      };
    })
    .sort((a, b) => b.completedCount - a.completedCount);

  sendSuccess(
    res,
    {
      ...challenge,
      total: challenge.items.length,
      isExpired: challenge.deadline < new Date(),
      members,
    },
    "Challenge detail fetched"
  );
});

// Most recent Monday 00:00 UTC — the community leaderboard's own weekly
// reset boundary (direct ask: a leaderboard that never resets only ever
// favors whoever joined earliest).
export function startOfCurrentWeekUTC() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7; // Mon->0, Tue->1, ..., Sun->6
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday));
}

// GET /api/groups/:slug/leaderboard — community-scoped only, entirely
// separate from the app-wide leaderboard (feedController.js's
// getLeaderboard). Ranked by ratings given since this week's reset.
// A member's weekly score is a composite of 3 signals, all scoped to this
// community specifically — direct ask, after the old plain "most ratings
// this week" metric read as no different from the main app's own Shares
// podium ("communitye has bir şey düşünebiliriz" — it wasn't tied to
// anything actually belonging to this community at all):
//   • showing up to a scheduled watch party (posted ≥1 message in it)
//   • contributing a title to one of this community's own lists
//     (CustomList.items[].addedBy — only tracked going forward, see that
//     field's own comment)
//   • rating a title this community has actually curated — the active
//     challenge's items, or anything on any of its own lists — not just
//     any rating anywhere in the app
// Weights (points per occurrence) were picked, not derived: attendance is
// the most deliberate action (a scheduled commitment), so it's weighted
// highest; a rating is a lighter but still real engagement signal;
// contributing a title is weighted lowest and capped per week — mainly to
// keep it from being trivially farmable by bulk-adding junk titles to a
// list that allows it.
const LEADERBOARD_PARTY_POINTS = 15;
const LEADERBOARD_RATING_POINTS = 10;
const LEADERBOARD_CONTRIBUTION_POINTS = 5;
const LEADERBOARD_CONTRIBUTION_CAP = 10;

// The scoring itself, factored out so the weekly leaderboard-announcement
// cron (weeklyLeaderboardAnnouncer.js) can compute last week's final tally
// the exact same way this endpoint computes this week's live one — `group`
// needs `_id`/`members`/`activeChallengeId`, `until` defaults to "now" (the
// live endpoint's own open-ended window); the cron passes last week's own
// start/end instead, so a closed [since, until) window is what's queried,
// not "since 7 days ago, including today."
export async function computeGroupLeaderboard(group, since, until = new Date()) {
  const memberIds = group.members.map((m) => m.user);

  const [thisWeeksParties, communityLists, activeChallenge] = await Promise.all([
    GroupWatchParty.find({ group: group._id, scheduledAt: { $gte: since, $lt: until } }).select("_id").lean(),
    CustomList.find({ groupId: group._id }).select("items").lean(),
    group.activeChallengeId ? GroupChallenge.findById(group.activeChallengeId).select("items").lean() : Promise.resolve(null),
  ]);
  const partyIds = thisWeeksParties.map((p) => p._id);

  // Every title this community has actually curated — the challenge's
  // items plus every item across its own lists, deduped. `.toString()` on
  // contentId matters: Rating.contentId is schema-typed String, and while
  // a plain .find() casts a query against that automatically, the
  // aggregate $match below does not (same gap getGroupChallenge's own
  // completedCount silently had until this session's Filmtok seed data
  // exposed it).
  const curatedPairs = new Map();
  for (const it of activeChallenge?.items ?? []) {
    curatedPairs.set(`${it.itemType}:${it.itemId.toString()}`, { contentId: it.itemId.toString(), contentType: it.itemType });
  }
  for (const list of communityLists) {
    for (const it of list.items) {
      curatedPairs.set(`${it.itemType}:${it.itemId.toString()}`, { contentId: it.itemId.toString(), contentType: it.itemType });
    }
  }
  const curatedPairMatch = [...curatedPairs.values()];

  const [attendanceRows, contributionRows, ratingRows] = await Promise.all([
    partyIds.length
      ? Message.aggregate([
          { $match: { roomType: "watchparty", roomId: { $in: partyIds }, sender: { $in: memberIds } } },
          { $group: { _id: "$sender", parties: { $addToSet: "$roomId" } } },
        ])
      : Promise.resolve([]),
    CustomList.aggregate([
      { $match: { groupId: group._id } },
      { $unwind: "$items" },
      { $match: { "items.addedBy": { $in: memberIds }, "items.addedAt": { $gte: since, $lt: until } } },
      { $group: { _id: "$items.addedBy", count: { $sum: 1 } } },
    ]),
    curatedPairMatch.length
      ? Rating.aggregate([
          { $match: { user: { $in: memberIds }, createdAt: { $gte: since, $lt: until }, $or: curatedPairMatch } },
          { $group: { _id: "$user", count: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
  ]);

  const attendanceMap = new Map(attendanceRows.map((r) => [r._id.toString(), r.parties.length]));
  const contributionMap = new Map(contributionRows.map((r) => [r._id.toString(), r.count]));
  const ratingMap = new Map(ratingRows.map((r) => [r._id.toString(), r.count]));

  const scored = memberIds
    .map((id) => {
      const key = id.toString();
      const partiesAttended = attendanceMap.get(key) ?? 0;
      const itemsAdded = contributionMap.get(key) ?? 0;
      const ratingsGiven = ratingMap.get(key) ?? 0;
      const score =
        partiesAttended * LEADERBOARD_PARTY_POINTS +
        Math.min(itemsAdded, LEADERBOARD_CONTRIBUTION_CAP) * LEADERBOARD_CONTRIBUTION_POINTS +
        ratingsGiven * LEADERBOARD_RATING_POINTS;
      return { userId: key, score, partiesAttended, itemsAdded, ratingsGiven };
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const users = await User.find({ _id: { $in: scored.map((e) => e.userId) } })
    .select("username profile_pic_url accountTier")
    .lean();
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  return scored.map((e, i) => ({
    rank: i + 1,
    user: userMap.get(e.userId) ?? null,
    score: e.score,
    partiesAttended: e.partiesAttended,
    itemsAdded: e.itemsAdded,
    ratingsGiven: e.ratingsGiven,
  }));
}

export const getGroupLeaderboard = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug }).select("members activeChallengeId").lean();
  if (!group) return sendError(res, "Group not found", 404);

  const since = startOfCurrentWeekUTC();
  const leaderboard = await computeGroupLeaderboard(group, since);

  sendSuccess(res, { leaderboard, resetsAt: new Date(since.getTime() + 7 * 24 * 60 * 60 * 1000) }, "Leaderboard fetched");
});

// ── Watch parties ───────────────────────────────────────────────────────
// A companion live chat (Message.js's "watchparty" roomType), scheduled
// around a title — never a synced player, see GroupWatchParty.js's own
// comment. Admin-only to create; any member can RSVP, read, and post.

// The admin's own choice of how long this reads as "live" — not free-form
// (a fixed, sane menu, same reasoning CreatePollScreen's own
// DURATION_OPTIONS pills already use) — 4h matches the personal
// "currently watching" default (feedController.js's own
// CURRENTLY_WATCHING_TTL_MS), the rest give room for a slower-arriving
// group or an actual marathon, capped at 12h so this never reads as "live"
// for the better part of a day.
export const WATCH_PARTY_DURATION_OPTIONS = [120, 240, 360, 480, 720];
const DEFAULT_WATCH_PARTY_DURATION = 240;

// POST /api/groups/:slug/watch-parties — body: { contentId, contentType, scheduledAt, durationMinutes? }
export const createWatchParty = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug });
  if (!group) return sendError(res, "Group not found", 404);
  if (!(await isGroupOwner(group, req.user._id))) return sendError(res, "Not this community's owner", 403);

  const { contentId, contentType, scheduledAt, durationMinutes } = req.body;
  if (!contentId || !["movie", "series"].includes(contentType)) {
    return sendError(res, "A valid contentId and contentType are required", 400);
  }
  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime()) || when <= new Date()) {
    return sendError(res, "Invalid scheduledAt", 400);
  }
  if (durationMinutes !== undefined && !WATCH_PARTY_DURATION_OPTIONS.includes(durationMinutes)) {
    return sendError(res, "Invalid durationMinutes", 400);
  }

  const hydrated = await hydrateContentData(contentId, contentType);
  if (!hydrated) return sendError(res, "Content not found", 404);

  const party = await GroupWatchParty.create({
    group: group._id,
    createdBy: req.user._id,
    contentId,
    contentType,
    durationMinutes: durationMinutes ?? DEFAULT_WATCH_PARTY_DURATION,
    contentTitle: hydrated.title,
    contentPosterUrl: hydrated.posterUrl,
    scheduledAt: when,
  });
  const whenLabel = when.toLocaleString("tr-TR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  await postGroupAnnouncement(group, req.user, `📅 Yeni bir Watch Party planlandı: "${hydrated.title}" — ${whenLabel}`, {
    kind: "watchparty",
    groupSlug: group.slug,
    groupName: group.name,
    title: hydrated.title,
    posterUrl: hydrated.posterUrl,
    partyId: party._id,
    scheduledAt: when,
  }).catch(() => {});
  if (group.feedAnnouncements?.enabled && group.feedAnnouncements.categories.includes("watchparty")) {
    await GroupAnnouncement.create({
      group: group._id,
      createdBy: req.user._id,
      category: "watchparty",
      title: hydrated.title,
      posterUrl: hydrated.posterUrl,
      partyId: party._id,
      scheduledAt: when,
    }).catch(() => {});
  }

  sendSuccess(res, party, "Watch party scheduled", 201);
});

// Shared shape for both the list and single-item endpoints below.
// rsvps.user is populated by both call sites below (listWatchParties,
// getWatchParty) — r.user is therefore a {_id, username, profile_pic_url}
// object, not a bare id; `r.user?._id ?? r.user` tolerates either shape
// defensively (an unpopulated caller added later wouldn't silently break
// isRsvped).
// `attendeeCount` is passed in (not computed here) — callers that need it
// batch it themselves via one aggregate across every party they're
// hydrating, rather than this running its own query per party.
function hydrateWatchParty(party, userId, attendeeCount = null) {
  return {
    _id: party._id,
    contentId: party.contentId,
    contentType: party.contentType,
    contentTitle: party.contentTitle,
    contentPosterUrl: party.contentPosterUrl,
    scheduledAt: party.scheduledAt,
    durationMinutes: party.durationMinutes ?? DEFAULT_WATCH_PARTY_DURATION,
    rsvpCount: party.rsvps.length,
    isRsvped: userId ? party.rsvps.some((r) => (r.user?._id ?? r.user).toString() === userId.toString()) : false,
    // Direct ask: the live card shows who's in it, same StackedAvatars
    // treatment as a Share's own topViewers — up to 8 sent (its own
    // max:5 display plus a little room), not every RSVP for a large party.
    rsvpUsers: party.rsvps.slice(0, 8).map((r) => ({
      _id: (r.user?._id ?? r.user).toString(),
      username: r.user?.username ?? "",
      profile_pic_url: r.user?.profile_pic_url ?? null,
    })),
    attendeeCount,
  };
}

// GET /api/groups/:slug/watch-parties — split into upcoming (soonest
// first) and past (most recent first), so the community page can show
// "what's coming up" and "past recaps" as two separate, already-sorted
// lists without the client re-sorting or re-filtering anything.
export const listWatchParties = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug }).select("_id").lean();
  if (!group) return sendError(res, "Group not found", 404);

  const now = new Date();
  const userId = req.user?._id;
  const [upcoming, past] = await Promise.all([
    GroupWatchParty.find({ group: group._id, scheduledAt: { $gte: now } })
      .sort({ scheduledAt: 1 })
      .populate("rsvps.user", "username profile_pic_url")
      .lean(),
    GroupWatchParty.find({ group: group._id, scheduledAt: { $lt: now } })
      .sort({ scheduledAt: -1 })
      .limit(20)
      .populate("rsvps.user", "username profile_pic_url")
      .lean(),
  ]);

  // Every already-started party (live or a past recap) needs a real
  // attendee count, not the RSVP one — direct report: "0 attended, N
  // going" showing side by side on a live party read as broken, and
  // "going" stops meaning anything once it's actually started. One
  // aggregate across all of them here, rather than getWatchParty's own
  // per-party Message.distinct query repeated for every row in this list.
  const pastIds = past.map((p) => p._id);
  const attendance = pastIds.length
    ? await Message.aggregate([
        { $match: { roomType: "watchparty", roomId: { $in: pastIds } } },
        { $group: { _id: "$roomId", attendees: { $addToSet: "$sender" } } },
      ])
    : [];
  const attendeeCountByParty = new Map(attendance.map((a) => [a._id.toString(), a.attendees.length]));

  sendSuccess(
    res,
    {
      upcoming: upcoming.map((p) => hydrateWatchParty(p, userId)),
      past: past.map((p) => hydrateWatchParty(p, userId, attendeeCountByParty.get(p._id.toString()) ?? 0)),
    },
    "Watch parties fetched"
  );
});

// GET /api/groups/:slug/watch-parties/:id — single detail, plus (only once
// it's actually started) the computed attendee count: whoever posted at
// least once in this party's own chat room. Never shown for a party that
// hasn't started yet — "0 attended" before it's even begun would read as
// a flop rather than simply "not started."
export const getWatchParty = asyncHandler(async (req, res) => {
  const party = await GroupWatchParty.findById(req.params.id).populate("rsvps.user", "username profile_pic_url").lean();
  if (!party) return sendError(res, "Watch party not found", 404);

  const started = party.scheduledAt <= new Date();
  const attendeeCount = started ? (await Message.distinct("sender", { roomType: "watchparty", roomId: party._id })).length : null;

  sendSuccess(res, { ...hydrateWatchParty(party, req.user?._id), attendeeCount }, "Watch party fetched");
});

// POST /api/groups/:slug/watch-parties/:id/rsvp — toggles the caller's own RSVP.
export const toggleWatchPartyRsvp = asyncHandler(async (req, res) => {
  const party = await GroupWatchParty.findById(req.params.id);
  if (!party) return sendError(res, "Watch party not found", 404);

  const group = await Group.findOne({ slug: req.params.slug, "members.user": req.user._id }).select("_id").lean();
  if (!group) return sendError(res, "Not a member of this group", 403);

  // RSVP only ever means something BEFORE it starts — it's what the
  // scheduled push reminders (30min/10min/at-start) key off of. Direct
  // ask: once it's actually underway, "going" stops being a real choice
  // (you either showed up and are chatting, or you didn't).
  if (party.scheduledAt <= new Date()) return sendError(res, "This watch party has already started", 400);

  const already = party.rsvps.some((r) => r.user.toString() === req.user._id.toString());
  if (already) {
    party.rsvps = party.rsvps.filter((r) => r.user.toString() !== req.user._id.toString());
  } else {
    party.rsvps.push({ user: req.user._id });
  }
  await party.save();

  sendSuccess(res, { isRsvped: !already, rsvpCount: party.rsvps.length }, "RSVP updated");
});

// GET /api/groups/:slug/watch-parties/:id/messages — same cursor shape as
// getGroupMessages above.
export const getWatchPartyMessages = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const before = req.query.before ? new Date(req.query.before) : null;

  const party = await GroupWatchParty.findById(req.params.id).select("group").lean();
  if (!party) return sendError(res, "Watch party not found", 404);
  const isMember = await Group.exists({ _id: party.group, "members.user": req.user._id });
  if (!isMember) return sendError(res, "Not a member of this group", 403);

  const query = { roomType: "watchparty", roomId: party._id };
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
    pagination: { hasMore, limit, before: before ? before.toISOString() : null },
  });
});

// POST /api/groups/:slug/watch-parties/:id/messages — REST fallback for a
// disconnected socket, same role as sendGroupMessage's own REST path.
export const sendWatchPartyMessage = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text?.trim() || text.length > 1000) return sendError(res, "Invalid message text", 400);

  const party = await GroupWatchParty.findById(req.params.id).select("group scheduledAt").lean();
  if (!party) return sendError(res, "Watch party not found", 404);
  const isMember = await Group.exists({ _id: party.group, "members.user": req.user._id });
  if (!isMember) return sendError(res, "Not a member of this group", 403);
  // Direct report: a watch party's own chat could be posted in before
  // scheduledAt ever arrived — the room exists the moment it's created
  // (so RSVPs/reads work early), but talking in it is gated to once it's
  // actually started.
  if (party.scheduledAt > new Date()) return sendError(res, "This watch party hasn't started yet", 403);

  const message = await Message.create({
    roomType: "watchparty",
    roomId: party._id,
    sender: req.user._id,
    text: text.trim(),
  });
  const populated = await Message.findById(message._id).populate("sender", "username profile_pic_url accountTier").lean();

  const io = getIo();
  if (io) io.to(roomKey("watchparty", party._id.toString())).emit("new-message", populated);

  sendSuccess(res, populated, "Message sent", 201);
});

// ── Shareable highlight images ─────────────────────────────────────────
// Publicly readable (no auth — see the route's own comment), but only
// ever surfaced through a "Share" button the mobile client shows to that
// community's owner — admin-triggered, never automatic. See
// highlightCardService.js's own comment for why this is a pure-backend
// PNG render rather than anything mobile-side. Returned directly as an
// image (not JSON), so this same URL doubles as something anyone can just
// open in a browser and save.

// GET /api/groups/:slug/poll/highlight-card
export const getPollHighlightCard = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug }).select("name accentColor pinnedPollId").lean();
  if (!group) return sendError(res, "Group not found", 404);
  if (!group.pinnedPollId) return sendError(res, "No pinned poll", 404);

  const poll = await Share.findById(group.pinnedPollId).select("pollData").lean();
  if (!poll) return sendError(res, "No pinned poll", 404);

  const png = await renderPollHighlight({
    communityName: group.name,
    accentColor: group.accentColor,
    options: poll.pollData.options.map((o) => ({ text: o.text, posterUrl: o.posterUrl, voteCount: o.votes.length })),
  });
  res.set("Content-Type", "image/png");
  res.send(png);
});

// GET /api/groups/:slug/watch-parties/:id/highlight-card — only once the
// party has actually started (same "0 attended before it begins would
// read as a flop" reasoning as getWatchParty's own attendeeCount).
export const getWatchPartyHighlightCard = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ slug: req.params.slug }).select("name accentColor").lean();
  if (!group) return sendError(res, "Group not found", 404);

  const party = await GroupWatchParty.findById(req.params.id).lean();
  if (!party) return sendError(res, "Watch party not found", 404);
  if (party.scheduledAt > new Date()) return sendError(res, "This watch party hasn't started yet", 400);

  const attendeeCount = (await Message.distinct("sender", { roomType: "watchparty", roomId: party._id })).length;

  const png = await renderWatchPartyHighlight({
    communityName: group.name,
    accentColor: group.accentColor,
    contentTitle: party.contentTitle,
    contentPosterUrl: party.contentPosterUrl,
    attendeeCount,
    scheduledAt: party.scheduledAt,
  });
  res.set("Content-Type", "image/png");
  res.send(png);
});
