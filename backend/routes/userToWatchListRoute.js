// routes/userToWatchListRoute.js
import express from "express";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Add to to-watch list
router.post("/to-watch", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, type, itemId, itemType } = req.body;
    const contentId = id || itemId;
    const contentType = type || itemType;

    if (!contentId || !contentType) return res.status(400).json({ message: "Missing data" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const exists = user.toWatchList.some(
      (w) => w.itemId.toString() === contentId && w.itemType === contentType
    );
    if (exists) return res.status(409).json({ message: "Already in watchlist" });

    user.toWatchList.push({ itemId: contentId, itemType: contentType });
    await user.save();

    return res.status(201).json({ message: "Added", toWatchList: user.toWatchList });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// Remove from to-watch list
router.delete("/to-watch/:itemId", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;
    const { itemType } = req.query;

    if (!itemId || !itemType) return res.status(400).json({ message: "Missing data" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const beforeLen = user.toWatchList.length;
    user.toWatchList = user.toWatchList.filter(
      (w) => !(w.itemId.toString() === itemId && w.itemType === itemType)
    );

    if (user.toWatchList.length === beforeLen) {
      return res.status(404).json({ message: "Item not found" });
    }

    await user.save();
    return res.status(200).json({ message: "Removed", toWatchList: user.toWatchList });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// Get to-watch list
router.get("/to-watch", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("toWatchList");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ toWatchList: user.toWatchList });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
