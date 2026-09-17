// routes/user.js

import express from "express";
import passport from "passport";
// Import new functions from controllers
import {
  registerUser,
  loginUser,
  getUsers,
  sendEmailVerificationCode,
  verifyEmail,
  forgotPassword,
  resetPassword,
  googleAuthCallback,
  // --- NEW ADDED FUNCTIONS ---
  followUser,
  unfollowUser,
  removeFollower,
  getNotifications,
  getMyFollowing,
  getMyFollowers,
  searchUsers,
  updateFavorites,
  // --- NEW ADDITIONS (For ProfilePage) ---
  getUserProfile,
  getUserFavorites,
  getUserCollections,
  getUserCollectionEntries,
  updateUserBio,
  getUserRatings,
  getUserCineGraph,
  getUserGenreDetail,
  findMatches,
  updatePassword,
  deleteAccount,
  addToWatchlist,
  removeFromWatchlist,
  uploadProfilePic,
  getMyProfile,
  getSuggestedUsers,
  getOnlineFriends,
  getProfileAnalysis,
  getProfileAnalysisHistory,
  setOwnAccountTier,
  setCurrentlyWatching,
  stopCurrentlyWatching
} from "../controllers/userController.js";
import { getImportSources, runImport } from "../controllers/importController.js";
import { getLogs, revertLogs, resetData } from "../controllers/logController.js";
import { getMyActivity } from "../controllers/activityController.js";
import { registerPushToken, unregisterPushToken } from "../controllers/pushTokenController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateRequest, validationSchemas } from "../middleware/validation.js";
import { authRateLimiter } from "../middleware/rateLimiter.js";
import multer from "multer";
import cloudinary from "../config/cloudinaryConfig.js";
import User from "../models/User.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// Library exports are much larger than a profile picture — a Letterboxd
// archive for a heavy user runs to several MB, and Trakt's JSON more — so
// imports get their own limit rather than sharing the 5MB avatar cap.
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024, files: 1 },
});

// The field name differs between the generic endpoint ("file") and the two
// legacy ones ("zipFile"), so accept whichever arrived.
const singleUpload = (req, res, next) =>
  importUpload.any()(req, res, (err) => {
    if (err) return next(err);
    req.file = req.files?.[0];
    next();
  });

// The legacy per-platform routes are the generic one with the source filled
// in, so an app build from before the unified importer keeps working.
const withSource = (source) => (req, res, next) => {
  req.body = req.body || {};
  req.body.source = source;
  next();
};

// --- Authentication Routes ---
router.post("/register", authRateLimiter, validateRequest(validationSchemas.registerUser), registerUser);
router.post("/login", authRateLimiter, validateRequest(validationSchemas.loginUser), loginUser);
router.get("/", getUsers);

// --- Email Verification ---
router.post("/send-verification", authRateLimiter, sendEmailVerificationCode);
router.post("/verify-email", authRateLimiter, verifyEmail);

// --- Password Reset ---
router.post("/forgot-password", authRateLimiter, forgotPassword);
router.post("/reset-password", authRateLimiter, resetPassword);

// --- Google OAuth ---
// ?platform=mobile&redirectUri=<...> is threaded through as the OAuth
// `state` param (base64url JSON) so the callback knows to redirect back to
// the mobile app's own redirect URL instead of the web frontend. The
// redirectUri is NOT hardcoded server-side (e.g. a fixed "cinephix://"
// scheme) because it must match whatever Linking.createURL() produced on
// the client for the CURRENT run — that's an "exp://<lan-ip>:8081/..." URL
// in Expo Go during development, and only a real "cinephix://..." URL in a
// standalone/dev-client build. Expo Go can't handle arbitrary custom
// schemes, so a hardcoded scheme silently breaks OAuth during dev testing.
//
// callbackURL itself is NOT overridden per-platform: Google's "Web
// application" client type rejects raw private IPs (192.168.x.x) as
// redirect URIs outright, so a LAN-IP callback can never be registered.
// Instead, mobile testing relies on `adb reverse tcp:5000 tcp:5000` so the
// device's own `localhost:5000` forwards to this machine — letting mobile
// reuse the exact same already-registered `localhost:5000` callback as web,
// with zero Google Console changes and zero risk to the web flow.
function encodeMobileState(redirectUri) {
  return Buffer.from(JSON.stringify({ mobile: true, redirectUri })).toString("base64url");
}

const googleAuthMiddleware = process.env.GOOGLE_CLIENT_ID
  ? (req, res, next) =>
      passport.authenticate("google", {
        scope: ["profile", "email"],
        session: false,
        prompt: "select_account",
        state:
          req.query.platform === "mobile" && req.query.redirectUri
            ? encodeMobileState(req.query.redirectUri)
            : undefined,
      })(req, res, next)
  : (req, res) => res.status(503).json({ success: false, message: "Google OAuth not configured" });

const googleCallbackMiddleware = process.env.GOOGLE_CLIENT_ID
  ? passport.authenticate("google", {
      session: false,
      failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:5173"}/login?error=oauth_failed`,
    })
  : (req, res) => res.status(503).json({ success: false, message: "Google OAuth not configured" });

router.get("/auth/google", googleAuthMiddleware);
router.get("/auth/google/callback", googleCallbackMiddleware, googleAuthCallback);

// Watchlist operations (handled in userWatchlistRoute.js)

router.post('/profile/:id/upload-profile-pic', authMiddleware, upload.single('profilePic'), uploadProfilePic);
router.get("/me", authMiddleware, getMyProfile);
router.get("/me/suggestions", authMiddleware, getSuggestedUsers);
router.get("/online", authMiddleware, getOnlineFriends);
router.get("/profile-analysis", authMiddleware, getProfileAnalysis);
router.get("/profile-analysis/history", authMiddleware, getProfileAnalysisHistory);

// Follow/unfollow operations
router.post("/follow", authMiddleware, followUser); // Support body targetId
router.post("/unfollow", authMiddleware, unfollowUser); // Support body targetId
router.post("/remove-follower", authMiddleware, removeFollower); // New route
router.post("/:id/follow", authMiddleware, followUser);
router.post("/:id/unfollow", authMiddleware, unfollowUser);

// Following and followers (yours, or another user's with ?userId=)
router.get("/me/following", authMiddleware, getMyFollowing);
router.get("/me/followers", authMiddleware, getMyFollowers);

// Compatibility for app builds from before follow requests were removed: they
// still ask for these on start-up, and a 404 there left their follow buttons
// unable to load. There are no follow requests any more, so both are always
// empty.
router.get("/me/follow-requests", authMiddleware, (req, res) => res.status(200).json([]));
router.get("/me/sent-requests", authMiddleware, (req, res) => res.status(200).json([]));

// Push notifications: this device's Expo push token, registered on sign-in and
// removed on sign-out.
router.post("/me/push-tokens", authMiddleware, registerPushToken);
router.delete("/me/push-tokens/:token", authMiddleware, unregisterPushToken);

// Get notifications
router.get("/notifications", authMiddleware, getNotifications);

// 3. Update favorites
router.put("/me/favorites", authMiddleware, validateRequest(validationSchemas.updateFavorites), updateFavorites);

// Search users
router.get("/search", authMiddleware, searchUsers);

// Get user profile and related data
router.get("/profile/:id", authMiddleware, getUserProfile);
router.get("/favorites/:id", authMiddleware, getUserFavorites);

// Lists + watched list + watchlist in one call, for the public profile's
// Lists tab.
router.get("/collections/:id", authMiddleware, getUserCollections);
// Every entry of one of those lists (kind: watched | watchlist), for the
// profile's full-list sheet.
router.get("/collections/:id/:kind", authMiddleware, getUserCollectionEntries);

router.patch("/profile/:id/bio", authMiddleware, validateRequest(validationSchemas.updateProfile), updateUserBio);
router.post("/me/currently-watching", authMiddleware, setCurrentlyWatching);
router.delete("/me/currently-watching", authMiddleware, stopCurrentlyWatching);
router.patch("/me/tier", authMiddleware, setOwnAccountTier); // DEV-ONLY: simulates a tier purchase, disabled in production

router.get("/ratings/:id", authMiddleware, getUserRatings);
router.get("/cinegraph-data/:id", authMiddleware, getUserCineGraph);
router.get("/:id/genre-detail", authMiddleware, getUserGenreDetail);

// Matching
router.post("/matches", authMiddleware, validateRequest(validationSchemas.findMatches), findMatches);
router.put("/profile/password", authMiddleware, validateRequest(validationSchemas.updatePassword), updatePassword);
router.delete("/profile", authMiddleware, deleteAccount);
// Import
router.get("/import/sources", authMiddleware, getImportSources);
router.post("/import", authMiddleware, singleUpload, runImport);
router.post("/import-tvtime", authMiddleware, singleUpload, withSource("tvtime"), runImport);
router.post("/import-letterboxd", authMiddleware, singleUpload, withSource("letterboxd"), runImport);

// Logs & Reset
router.get("/me/activity", authMiddleware, getMyActivity);
router.get("/me/logs", authMiddleware, getLogs);
router.post("/me/logs/revert", authMiddleware, revertLogs);
router.post("/me/reset-data", authMiddleware, resetData);

router.get("/health", (req, res) => res.json({ status: "ok" }));

export default router;