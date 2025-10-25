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
  // --- BİTİŞ ---
} from "../controllers/userController.js";
import authMiddleware from "../middleware/authMiddleware.js"; // Bu sizde zaten vardı

const router = express.Router();

// --- MEVCUT ROTALARINIZ (DOKUNULMADI) ---
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/", getUsers);

// Watchlist ekle
router.post("/me/watchlist", authMiddleware, async (req, res) => {
  try {
    const { id, type } = req.body;
    console.log("İstek geldi:", id, type); // 🔹 kontrol

    if (!id || !type) {
      return res.status(400).json({ message: "id veya type eksik" });
    }

    const user = req.user;
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    // Aynı item tekrar eklenmesin
    const exists = user.watchlist.find(
      (item) => item.itemId.toString() === id && item.itemType === type
    );
    if (exists) return res.status(400).json({ message: "Zaten eklenmiş." });

    user.watchlist.push({ itemId: id, itemType: type });
    await user.save();
    res.json(user.watchlist);
  } catch (error) {
    console.error("Backend hatası:", error); // 🔹 detaylı log
    res.status(500).json({ message: "Sunucu hatası", error: error.message });
  }
});

// Watchlist'ten çıkar
router.delete("/me/watchlist/:itemId", authMiddleware, async (req, res) => {
  try {
    const { itemId } = req.params;
    const user = req.user;

    user.watchlist = user.watchlist.filter(
      (item) => item.itemId.toString() !== itemId
    );

    await user.save();
    res.json(user.watchlist); // güncel watchlist'i gönder
  } catch (err) {
    res.status(500).json({ message: "Sunucu hatası", error: err.message });
  }
});

// Kullanıcının kendi bilgilerini ve watchlistini getir
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = req.user; // authMiddleware ile req.user hazır
    res.json(user); // watchlist dahil tüm kullanıcı verisi
  } catch (error) {
    res.status(500).json({ message: "Sunucu hatası", error: error.message });
  }
});
// --- MEVCUT ROTALARIN BİTİŞİ ---

// --- 2. DEĞİŞİKLİK: YENİ TAKİP VE BİLDİRİM ROTALARI ---
// (Sizin authMiddleware'inizi kullanarak)

// Bir kullanıcıyı takip et / takipten çık
// :id -> Eylemin yapılacağı (takip edilecek/çıkılacak) kullanıcının ID'si
router.post("/:id/follow", authMiddleware, followUser);
router.post("/:id/unfollow", authMiddleware, unfollowUser);

// Giriş yapmış kullanıcının kendi listelerini alması
// (NetworkPage.jsx bu ikisini kullanacak)
router.get("/me/following", authMiddleware, getMyFollowing);
router.get("/me/followers", authMiddleware, getMyFollowers);

// Bildirim rotası
// (Bu, /api/users/notifications adresini oluşturur)
router.get("/notifications", authMiddleware, getNotifications);

// --- 3. YENİ ARAMA ROTASI ---
// (NetworkPage.jsx bu ikisini kullanacak)
router.get("/search", authMiddleware, searchUsers); // <-- 2. YENİ ROTAYI EKLE
// --- BİTİŞ ---

export default router;