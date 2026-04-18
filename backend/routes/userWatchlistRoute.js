// routes/userWatchlistRoute.js
import express from "express";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Add to watchlist
router.post("/me/watchlist", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId, itemType } = req.body;
    if (!itemId || !itemType) return res.status(400).json({ message: "Missing data" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if item already exists
    const exists = user.watchlist.some(w => w.itemId.toString() === itemId && w.itemType === itemType);
    if (exists) return res.status(409).json({ message: "Already added" });

    user.watchlist.push({ itemId, itemType });
    await user.save();

    return res.status(201).json({ message: "Added", watchlist: user.watchlist });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// Remove from watchlist
router.delete("/me/watchlist/:itemId", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;
    const { itemType } = req.query;
    
    if (!itemId || !itemType) return res.status(400).json({ message: "Missing data" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const beforeLen = user.watchlist.length;
    user.watchlist = user.watchlist.filter(w => !(w.itemId.toString() === itemId && w.itemType === itemType));

    if (user.watchlist.length === beforeLen) {
      return res.status(404).json({ message: "Item not found" });
    }

    await user.save();
    return res.status(200).json({ message: "Removed", watchlist: user.watchlist });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// Retrieve watchlist
router.get("/me/watchlist", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("watchlist");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ watchlist: user.watchlist });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
