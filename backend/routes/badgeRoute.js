import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess } from "../utils/response.js";
import User from "../models/User.js";
import {
  getGenreBadges,
  getVolumeBadges,
  getRatingCountBadge,
  getReviewCountBadge,
  getListCountBadge,
  getFollowersBadge,
  getInfluencerBadge,
  getFirstSyncBadge,
  getHighMatchBadge,
  getSyncExplorerBadge,
  getFoundingCinephileBadge,
  getMembershipBadge,
  getStreakBadge,
  getTimeTravelerBadge,
  getEclecticTasteBadge,
  getDayOneViewerBadge,
  getHiddenGemBadge,
  getPollParticipantBadge,
  getHalloweenViewerBadge,
  getNewYearViewerBadge,
  computeGenreBadgeCounts,
  computeVolumeBadgeCounts,
  computeRatingCountBadge,
  computeReviewCountBadge,
  computeListCountBadge,
  computeFollowersBadge,
  computeInfluencerBadge,
  computeFirstSyncBadge,
  computeHighMatchBadge,
  computeSyncExplorerBadge,
  computeFoundingCinephileBadge,
  computeMembershipBadge,
  computeStreakBadge,
  computeTimeTravelerBadge,
  computeEclecticTasteBadge,
  computeDayOneViewerBadge,
  computeHiddenGemBadge,
  computePollParticipantBadge,
  computeHalloweenViewerBadge,
  computeNewYearViewerBadge,
  DEVOTEE_THRESHOLD,
  MASTER_THRESHOLD,
  VOLUME_TIERS,
  RATING_COUNT_TIERS,
  REVIEW_COUNT_TIERS,
  LIST_COUNT_TIERS,
  FOLLOWERS_TIERS,
  INFLUENCER_TIERS,
  FIRST_SYNC_TIERS,
  HIGH_MATCH_TIERS,
  SYNC_EXPLORER_TIERS,
  FOUNDING_TIERS,
  MEMBERSHIP_TIERS,
  STREAK_TIERS,
  TIME_TRAVELER_TIERS,
  ECLECTIC_TASTE_TIERS,
  DAY_ONE_VIEWER_TIERS,
  HIDDEN_GEM_TIERS,
  POLL_PARTICIPANT_TIERS,
  HALLOWEEN_VIEWER_TIERS,
  NEW_YEAR_VIEWER_TIERS,
} from "../controllers/badgeController.js";
// "podium" is the one badge family that lives in feedController.js, not
// badgeController.js — see computePodiumBadge's own doc comment there for
// why (it's built entirely out of that file's own podium ranking, and
// importing it back the other way would be circular).
import { getPodiumBadge, computePodiumBadge, PODIUM_TIERS } from "../controllers/feedController.js";

const router = express.Router();

// One-shot bulk fetch of all 20 badge families for a given user, built for
// the public-profile Badges tab (ProfileBadgesTab.tsx reused there with a
// `userId` prop) — the own-profile tab keeps its existing 20 separate
// requests (unchanged, zero regression risk to something already
// live-verified); this route exists only so a public profile doesn't have
// to fire the same 20 requests for someone who isn't the viewer. Composed
// here rather than in badgeController.js itself specifically so it can
// pull in computePodiumBadge from feedController.js without creating the
// same circular import getPodiumBadge's own doc comment above already
// flags (this routes file sits above both controllers, so importing from
// both directions here is safe).
const getAllBadgesForUser = asyncHandler(async (req, res) => {
  const targetId = req.params.id;

  const [
    genreBadges,
    volumeBadges,
    ratingCount,
    reviewCount,
    listCount,
    followers,
    influencer,
    podium,
    firstSync,
    highMatch,
    syncExplorer,
    founding,
    membership,
    streak,
    timeTraveler,
    eclecticTaste,
    dayOneViewer,
    hiddenGem,
    pollParticipant,
    halloweenViewer,
    newYearViewer,
  ] = await Promise.all([
    computeGenreBadgeCounts(targetId),
    computeVolumeBadgeCounts(targetId),
    computeRatingCountBadge(targetId),
    computeReviewCountBadge(targetId),
    computeListCountBadge(targetId),
    computeFollowersBadge(targetId),
    computeInfluencerBadge(targetId),
    computePodiumBadge(targetId),
    computeFirstSyncBadge(targetId),
    computeHighMatchBadge(targetId),
    computeSyncExplorerBadge(targetId),
    computeFoundingCinephileBadge(targetId),
    computeMembershipBadge(targetId),
    computeStreakBadge(targetId),
    computeTimeTravelerBadge(targetId),
    computeEclecticTasteBadge(targetId),
    computeDayOneViewerBadge(targetId),
    computeHiddenGemBadge(targetId),
    computePollParticipantBadge(targetId),
    computeHalloweenViewerBadge(targetId),
    computeNewYearViewerBadge(targetId),
  ]);

  sendSuccess(
    res,
    {
      // Always true: every profile is public. Sent because older app builds
      // hide a profile's badges without it (see utils/publicProfile.js).
      authorized: true,
      genre:{ badges: genreBadges, devoteeThreshold: DEVOTEE_THRESHOLD, masterThreshold: MASTER_THRESHOLD },
      volume: { badges: volumeBadges, tiers: VOLUME_TIERS },
      ratingCount: { badges: ratingCount, tiers: RATING_COUNT_TIERS },
      reviewCount: { badges: reviewCount, tiers: REVIEW_COUNT_TIERS },
      listCount: { badges: listCount, tiers: LIST_COUNT_TIERS },
      followers: { badges: followers, tiers: FOLLOWERS_TIERS },
      influencer: { badges: influencer, tiers: INFLUENCER_TIERS },
      podium: { badges: podium, tiers: PODIUM_TIERS },
      firstSync: { badges: firstSync, tiers: FIRST_SYNC_TIERS },
      highMatch: { badges: highMatch, tiers: HIGH_MATCH_TIERS },
      syncExplorer: { badges: syncExplorer, tiers: SYNC_EXPLORER_TIERS },
      founding: { badges: founding, tiers: FOUNDING_TIERS },
      membership: { badges: membership, tiers: MEMBERSHIP_TIERS },
      streak: { badges: streak, tiers: STREAK_TIERS },
      timeTraveler: { badges: timeTraveler, tiers: TIME_TRAVELER_TIERS },
      eclecticTaste: { badges: eclecticTaste, tiers: ECLECTIC_TASTE_TIERS },
      dayOneViewer: { badges: dayOneViewer, tiers: DAY_ONE_VIEWER_TIERS },
      hiddenGem: { badges: hiddenGem, tiers: HIDDEN_GEM_TIERS },
      pollParticipant: { badges: pollParticipant, tiers: POLL_PARTICIPANT_TIERS },
      halloweenViewer: { badges: halloweenViewer, tiers: HALLOWEEN_VIEWER_TIERS },
      newYearViewer: { badges: newYearViewer, tiers: NEW_YEAR_VIEWER_TIERS },
    },
    "All badges fetched",
    200
  );
});

// Own-profile only for now (req.user.id, no :id param) — badges are being
// built out one category at a time, starting with genre badges shown on
// the viewer's own Profile page. Extending this to public profiles is a
// deliberate later step, not an oversight here.
router.get("/genres", authMiddleware, getGenreBadges);
router.get("/volume", authMiddleware, getVolumeBadges);
router.get("/rating-count", authMiddleware, getRatingCountBadge);
router.get("/review-count", authMiddleware, getReviewCountBadge);
router.get("/list-count", authMiddleware, getListCountBadge);
router.get("/followers", authMiddleware, getFollowersBadge);
router.get("/influencer", authMiddleware, getInfluencerBadge);
router.get("/podium", authMiddleware, getPodiumBadge);
router.get("/first-sync", authMiddleware, getFirstSyncBadge);
router.get("/high-match", authMiddleware, getHighMatchBadge);
router.get("/sync-explorer", authMiddleware, getSyncExplorerBadge);
router.get("/founding-cinephile", authMiddleware, getFoundingCinephileBadge);
router.get("/membership", authMiddleware, getMembershipBadge);
router.get("/streak", authMiddleware, getStreakBadge);
router.get("/time-traveler", authMiddleware, getTimeTravelerBadge);
router.get("/eclectic-taste", authMiddleware, getEclecticTasteBadge);
router.get("/day-one-viewer", authMiddleware, getDayOneViewerBadge);
router.get("/hidden-gem", authMiddleware, getHiddenGemBadge);
router.get("/poll-participant", authMiddleware, getPollParticipantBadge);
router.get("/halloween-viewer", authMiddleware, getHalloweenViewerBadge);
router.get("/new-year-viewer", authMiddleware, getNewYearViewerBadge);

router.get("/user/:id", authMiddleware, getAllBadgesForUser);

export default router;
