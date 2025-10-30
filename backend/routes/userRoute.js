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
  getUserRatings, // --- BİTİŞ ---
  // --- BİTİŞ ---
} from "../controllers/userController.js";
import authMiddleware from "../middleware/authMiddleware.js"; // Bu sizde zaten vardı
import multer from "multer";
import cloudinary from "../config/cloudinaryConfig.js";
import User from "../models/User.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

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

router.post('/profile/:id/upload-profile-pic', upload.single('profilePic'), async (req, res) => {
  try {
    const userId = req.params.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    // Cloudinary'ye yükle
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'profile_pics' },
        (error, uploadResult) => {
          if (error) return reject(error);
          resolve(uploadResult);
        }
      );
      uploadStream.end(file.buffer);
    });

    // Kullanıcıyı güncelle
    const user = await User.findByIdAndUpdate(
      userId,
      { profile_pic_url: result.secure_url },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ message: 'Profile picture updated successfully!', profilePicUrl: user.profile_pic_url });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({ message: 'Failed to upload profile picture.' });
  }
});


// ... (diğer rotalarınız) ...

// KULLANICININ KENDİ BİLGİLERİNİ GETİRME ROTASI (ESKİ HALİNE DÖNDÜ)
router.get("/me", authMiddleware, async (req, res) => {
  try {
    // authMiddleware'den gelen req.user'ı (parolası hariç) döndür.
    // Bu, populate denemez ve çökmez.
    // Not: Bu, req.user'ın favori ID listelerini içermesini sağlar.
    res.json(req.user); 
  } catch (error) {
    res.status(500).json({ message: "Sunucu hatası", error: error.message });
  }
});
// --- GÜNCELLEME BİTTİ ---

// ... (diğer rotalarınız: /me/watchlist, /:id/follow vb.) ...

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

// 3. YENİ FAVORİ GÜNCELLEME ROTASINI EKLEYİN
router.put("/me/favorites", authMiddleware, updateFavorites);

// --- 3. YENİ ARAMA ROTASI ---
// (NetworkPage.jsx bu ikisini kullanacak)
router.get("/search", authMiddleware, searchUsers); // <-- 2. YENİ ROTAYI EKLE
// --- BİTİŞ ---
router.get("/profile/:id", authMiddleware, getUserProfile);
router.get("/favorites/:id", authMiddleware, getUserFavorites);

router.patch("/profile/:id/bio", authMiddleware, updateUserBio);

router.get("/ratings/:id", authMiddleware, getUserRatings);
export default router;