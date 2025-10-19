import express from "express";
import { registerUser, loginUser, getUsers } from "../controllers/userController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/", getUsers);

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
    const exists = user.watchlist.find(item => item.itemId.toString() === id && item.itemType === type);
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
      item => item.itemId.toString() !== itemId
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




export default router;
