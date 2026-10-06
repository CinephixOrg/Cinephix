import express from "express";
import multer from "multer";
import authMiddleware, { optionalAuth } from "../middleware/authMiddleware.js";
import {
  getAllGroups,
  getGroupBySlug,
  joinGroup,
  leaveGroup,
  getGroupMembers,
  getGroupMessages,
  sendGroupMessage,
  markGroupAsRead,
  updateGroupIdentity,
  updateGroupFeedSettings,
  uploadGroupCoverImage,
  createGroupList,
  listGroupLists,
  setFeaturedLists,
  createGroupPoll,
  createGroupChallenge,
  getGroupChallenge,
  getGroupChallengeDetail,
  getGroupLeaderboard,
  createWatchParty,
  listWatchParties,
  getWatchParty,
  toggleWatchPartyRsvp,
  getWatchPartyMessages,
  sendWatchPartyMessage,
  getPollHighlightCard,
  getWatchPartyHighlightCard,
} from "../controllers/groupController.js";

const router = express.Router();
// Same 5MB cap as the profile-picture upload (userRoute.js) — a community
// cover image is the same kind of asset, no reason for a different limit.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get("/", optionalAuth, getAllGroups);
router.get("/:slug", optionalAuth, getGroupBySlug);
router.get("/:slug/members", getGroupMembers);

router.post("/:slug/join", authMiddleware, joinGroup);
router.post("/:slug/leave", authMiddleware, leaveGroup);
router.post("/:groupId/markAsRead", authMiddleware, markGroupAsRead);
router.get("/:slug/messages", authMiddleware, getGroupMessages);
router.post("/:groupId/messages", authMiddleware, sendGroupMessage);

// Partner-community admin endpoints — each checks ownership itself.
router.patch("/:slug", authMiddleware, updateGroupIdentity);
router.patch("/:slug/feed-settings", authMiddleware, updateGroupFeedSettings);
router.post("/:slug/cover-image", authMiddleware, upload.single("coverImage"), uploadGroupCoverImage);
router.post("/:slug/list", authMiddleware, createGroupList);
router.get("/:slug/lists", optionalAuth, listGroupLists);
router.patch("/:slug/featured-lists", authMiddleware, setFeaturedLists);
router.post("/:slug/poll", authMiddleware, createGroupPoll);
router.post("/:slug/challenge", authMiddleware, createGroupChallenge);
router.get("/:slug/challenge", optionalAuth, getGroupChallenge);
router.get("/:slug/challenge/detail", optionalAuth, getGroupChallengeDetail);
router.get("/:slug/leaderboard", optionalAuth, getGroupLeaderboard);

// Watch parties — a community's own scheduled companion chat.
router.post("/:slug/watch-parties", authMiddleware, createWatchParty);
router.get("/:slug/watch-parties", optionalAuth, listWatchParties);
router.get("/:slug/watch-parties/:id", optionalAuth, getWatchParty);
router.post("/:slug/watch-parties/:id/rsvp", authMiddleware, toggleWatchPartyRsvp);
router.get("/:slug/watch-parties/:id/messages", authMiddleware, getWatchPartyMessages);
// Slug-free alias of the same handler (it never reads req.params.slug) —
// chatCache.ts's fetchFirstPage only has a room's bare id to work with (its
// key is "watchparty:<id>", no slug), so a watch party's initial message
// load needs a route it can hit with just that. A different segment count
// than /:slug/watch-parties/:id/messages above, so there's no routing
// ambiguity between the two.
router.get("/watch-parties/:id/messages", authMiddleware, getWatchPartyMessages);
router.post("/:slug/watch-parties/:id/messages", authMiddleware, sendWatchPartyMessage);

// Shareable highlight images — owner-only.
// No auth required — this is the actual image a share sheet / Instagram /
// a browser fetches, and none of them can carry a bearer token. Nothing
// sensitive is in it (poll results and a watch party recap are already
// visible to anyone viewing that public community), same "public GET"
// level as the plain /:slug and /:slug/watch-parties endpoints.
router.get("/:slug/poll/highlight-card", getPollHighlightCard);
router.get("/:slug/watch-parties/:id/highlight-card", getWatchPartyHighlightCard);

export default router;
