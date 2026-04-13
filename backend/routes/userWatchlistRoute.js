// routes/userWatchlistRoute.js
import express from "express";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js"; // proje içinde varsa

const router = express.Router();

// Eklemek
router.post("/me/watchlist", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id; // authMiddleware user'ı req.user'a koyuyor varsayılıyor
    const { itemId, itemType } = req.body;
    if (!itemId || !itemType) return res.status(400).json({ message: "Eksik veriler" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    // Aynı öğe var mı kontrol et
    const exists = user.watchlist.some(w => w.itemId.toString() === itemId && w.itemType === itemType);
    if (exists) return res.status(409).json({ message: "Zaten eklendi" });

    user.watchlist.push({ itemId, itemType });
    await user.save();

    return res.status(201).json({ message: "Eklendi", watchlist: user.watchlist });
  } catch (err) {
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

// Çıkarmak
router.delete("/me/watchlist", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId, itemType } = req.body;
    if (!itemId || !itemType) return res.status(400).json({ message: "Eksik veriler" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    const beforeLen = user.watchlist.length;
    user.watchlist = user.watchlist.filter(w => !(w.itemId.toString() === itemId && w.itemType === itemType));

    if (user.watchlist.length === beforeLen) {
      return res.status(404).json({ message: "Öğe bulunamadı" });
    }

    await user.save();
    return res.status(200).json({ message: "Kaldırıldı", watchlist: user.watchlist });
  } catch (err) {
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

// Get (opsiyonel)
router.get("/me/watchlist", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("watchlist");
    return res.json({ watchlist: user.watchlist });
  } catch (err) {
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
