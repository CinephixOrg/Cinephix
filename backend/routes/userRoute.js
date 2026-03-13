// routes/user.js

import express from "express";
// 1. DEĞİŞİKLİK: Controller'dan yeni fonksiyonları import ediyoruz
import {
  registerUser,
  loginUser,
  getUsers,
  // --- YENİ EKLENEN FONKSİYONLAR ---
  followUser,
  unfollowUser,
  getNotifications,
  getMyFollowing,
  getMyFollowers,
  searchUsers,
  updateFavorites,
  // --- YENİ EKLENENLER (ProfilePage için) ---
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
  getMyProfile
  // --- BİTİŞ ---
} from "../controllers/userController.js";
import authMiddleware from "../middleware/authMiddleware.js"; // Bu sizde zaten vardı
import { validateRequest, validationSchemas } from "../utils/validation.js";
import multer from "multer";
import cloudinary from "../config/cloudinaryConfig.js";
import User from "../models/User.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// --- MEVCUT ROTALARINIZ (DOKUNULMADI) ---
router.post("/register", validateRequest(validationSchemas.userRegister), registerUser);
router.post("/login", validateRequest(validationSchemas.userLogin), loginUser);
router.get("/", getUsers);

// Watchlist operations (moved to controller)
router.post("/me/watchlist", authMiddleware, validateRequest(validationSchemas.watchlist), addToWatchlist);
router.delete("/me/watchlist/:itemId", authMiddleware, validateRequest(validationSchemas.mongoIdParam), removeFromWatchlist);

router.post('/profile/:id/upload-profile-pic', validateRequest(validationSchemas.mongoIdParam), upload.single('profilePic'), uploadProfilePic);
router.get("/me", authMiddleware, getMyProfile);

// Bir kullanıcıyı takip et / takipten çık
// :id -> Eylemin yapılacağı (takip edilecek/çıkılacak) kullanıcının ID'si
router.post("/:id/follow", authMiddleware, validateRequest(validationSchemas.mongoIdParam), followUser);
router.post("/:id/unfollow", authMiddleware, validateRequest(validationSchemas.mongoIdParam), unfollowUser);

// Giriş yapmış kullanıcının kendi listelerini alması
// (NetworkPage.jsx bu ikisini kullanacak)
router.get("/me/following", authMiddleware, getMyFollowing);
router.get("/me/followers", authMiddleware, getMyFollowers);

// Bildirim rotası
// (Bu, /api/users/notifications adresini oluşturur)
router.get("/notifications", authMiddleware, getNotifications);

// 3. YENİ FAVORİ GÜNCELLEME ROTASINI EKLEYİN
router.put("/me/favorites", authMiddleware, validateRequest(validationSchemas.updateFavorites), updateFavorites);

// --- 3. YENİ ARAMA ROTASI ---
// (NetworkPage.jsx bu ikisini kullanacak)
router.get("/search", authMiddleware, validateRequest(validationSchemas.searchUsers), searchUsers); // <-- 2. YENİ ROTAYI EKLE
// --- BİTİŞ ---
router.get("/profile/:id", authMiddleware, validateRequest(validationSchemas.mongoIdParam), getUserProfile);
router.get("/favorites/:id", authMiddleware, validateRequest(validationSchemas.mongoIdParam), getUserFavorites);

router.patch("/profile/:id/bio", authMiddleware, validateRequest(validationSchemas.updateUserBioWithId), updateUserBio);

router.get("/ratings/:id", authMiddleware, validateRequest(validationSchemas.mongoIdParam), getUserRatings);
// Benzersiz bir URL yapısı kullanıyoruz:
router.get("/cinegraph-data/:id", authMiddleware, validateRequest(validationSchemas.mongoIdParam), getUserCineGraph);
// --- EŞLEŞME ROTASI ---
// POST kullanıyoruz çünkü body içinde filtre (genres) göndereceğiz
router.post("/matches", authMiddleware, validateRequest(validationSchemas.findMatches), findMatches);
router.put("/profile/password", authMiddleware, validateRequest(validationSchemas.updatePassword), updatePassword);
router.delete("/profile", authMiddleware, deleteAccount);
export default router;