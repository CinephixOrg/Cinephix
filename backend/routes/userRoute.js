// routes/user.js

import express from "express";
// Import new functions from controllers
import {
  registerUser,
  loginUser,
  getUsers,
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
  getSuggestedUsers
  // End of imports
} from "../controllers/userController.js";
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

// Watchlist operations (moved to controller)
router.post("/me/watchlist", authMiddleware, validateRequest(validationSchemas.addToWatchlist), addToWatchlist);
router.delete("/me/watchlist/:itemId", authMiddleware, removeFromWatchlist);

router.post('/profile/:id/upload-profile-pic', upload.single('profilePic'), uploadProfilePic);
router.get("/me", authMiddleware, getMyProfile);
router.get("/me/suggestions", authMiddleware, getSuggestedUsers);

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

router.get("/ratings/:id", authMiddleware, getUserRatings);
router.get("/cinegraph-data/:id", authMiddleware, getUserCineGraph);

// Matching
router.post("/matches", authMiddleware, validateRequest(validationSchemas.findMatches), findMatches);
router.put("/profile/password", authMiddleware, validateRequest(validationSchemas.updatePassword), updatePassword);
router.delete("/profile", authMiddleware, deleteAccount);
export default router;