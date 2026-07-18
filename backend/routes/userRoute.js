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
  getNotifications,
  getMyFollowing,
  getMyFollowers,
  searchUsers,
  updateFavorites,
  // --- NEW ADDITIONS (For ProfilePage) ---
  getUserProfile,
  getUserFavorites,
  updateUserBio,
  getUserRatings,
  getUserCineGraph,
  findMatches,
  updatePassword,
  deleteAccount,
  addToWatchlist,
  removeFromWatchlist,
  uploadProfilePic,
  getMyProfile,
  getSuggestedUsers,
  getProfileAnalysis,
  importTVTimeData,
  importLetterboxdData,
  updateVisibility
} from "../controllers/userController.js";
import { getLogs, revertLogs, resetData } from "../controllers/logController.js";
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
const googleAuthMiddleware = process.env.GOOGLE_CLIENT_ID
  ? passport.authenticate("google", { scope: ["profile", "email"], session: false })
  : (req, res) => res.status(503).json({ success: false, message: "Google OAuth not configured" });

const googleCallbackMiddleware = process.env.GOOGLE_CLIENT_ID
  ? passport.authenticate("google", {
      session: false,
      failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:5173"}/login?error=oauth_failed`,
    })
  : (req, res) => res.status(503).json({ success: false, message: "Google OAuth not configured" });

router.get("/auth/google", googleAuthMiddleware);
router.get("/auth/google/callback", googleCallbackMiddleware, googleAuthCallback);

// Watchlist operations (moved to controller)
router.post("/me/watchlist", authMiddleware, validateRequest(validationSchemas.addToWatchlist), addToWatchlist);
router.delete("/me/watchlist/:itemId", authMiddleware, removeFromWatchlist);

router.post('/profile/:id/upload-profile-pic', authMiddleware, upload.single('profilePic'), uploadProfilePic);
router.get("/me", authMiddleware, getMyProfile);
router.get("/me/suggestions", authMiddleware, getSuggestedUsers);
router.get("/profile-analysis", authMiddleware, getProfileAnalysis);

// Follow/unfollow operations
router.post("/:id/follow", authMiddleware, followUser);
router.post("/:id/unfollow", authMiddleware, unfollowUser);

// Get current user's following and followers
router.get("/me/following", authMiddleware, getMyFollowing);
router.get("/me/followers", authMiddleware, getMyFollowers);

// Get notifications
router.get("/notifications", authMiddleware, getNotifications);

// 3. Update favorites
router.put("/me/favorites", authMiddleware, validateRequest(validationSchemas.updateFavorites), updateFavorites);

// Search users
router.get("/search", authMiddleware, searchUsers);

// Get user profile and related data
router.get("/profile/:id", authMiddleware, getUserProfile);
router.get("/favorites/:id", authMiddleware, getUserFavorites);

router.patch("/profile/:id/bio", authMiddleware, validateRequest(validationSchemas.updateProfile), updateUserBio);
router.patch("/me/visibility", authMiddleware, updateVisibility);

router.get("/ratings/:id", authMiddleware, getUserRatings);
router.get("/cinegraph-data/:id", authMiddleware, getUserCineGraph);

// Matching
router.post("/matches", authMiddleware, validateRequest(validationSchemas.findMatches), findMatches);
router.put("/profile/password", authMiddleware, validateRequest(validationSchemas.updatePassword), updatePassword);
router.delete("/profile", authMiddleware, deleteAccount);
router.post("/import-tvtime", authMiddleware, upload.single("zipFile"), importTVTimeData);
router.post("/import-letterboxd", authMiddleware, upload.single("zipFile"), importLetterboxdData);

// Logs & Reset
router.get("/me/logs", authMiddleware, getLogs);
router.post("/me/logs/revert", authMiddleware, revertLogs);
router.post("/me/reset-data", authMiddleware, resetData);

router.get("/health", (req, res) => res.json({ status: "ok" }));

export default router;