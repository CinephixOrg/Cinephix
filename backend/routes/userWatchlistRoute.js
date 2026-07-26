// routes/userWatchlistRoute.js
import express from "express";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { conn } from "../db/connections.js";
import { createMovieModel } from "../models/Movie.js";
import { createSeriesModel } from "../models/Series.js";
import Rating from "../models/Rating.js";
import { MOVIE_GENRE_MAP, SERIES_GENRE_MAP } from "../utils/genreConstants.js";

const Movie = createMovieModel(conn);
const Series = createSeriesModel(conn);

const router = express.Router();

// Add to watchlist
router.post("/watchlist", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, type, itemId, itemType } = req.body;
    const contentId = id || itemId;
    const contentType = type || itemType;
    
    if (!contentId || !contentType) return res.status(400).json({ message: "Missing data" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if item already exists
    const watchlist = user.watchlist || [];
    const exists = watchlist.some(w => w.itemId?.toString() === contentId?.toString() && w.itemType === contentType);
    if (exists) return res.status(409).json({ message: "Already added" });

    if (!user.watchlist) user.watchlist = [];

    user.watchlist.push({ itemId: contentId, itemType: contentType });

    // --- NEW LOGIC: Update Graph Count ---
    const graph = contentType === "movie" ? user.movieCineGraph : user.seriesCineGraph;
    let genres = [];

    if (contentType === "movie") {
      const movie = await Movie.findById(contentId).lean();
      if (movie) {
        genres = (movie.genre_ids || []).map(id => MOVIE_GENRE_MAP[id]).filter(Boolean);
      }
    } else {
      const series = await Series.findById(contentId).lean();
      if (series) {
        genres = (series.genre_ids || []).map(id => SERIES_GENRE_MAP[id]).filter(Boolean);
      }
    }

    genres.forEach(genre => {
      const node = graph.get(genre) || { count: 0, ratedCount: 0, avgRating: 0 };
      graph.set(genre, { ...node, count: node.count + 1 });
    });
    // --- END NEW LOGIC ---

    await user.save();

    return res.status(201).json({ message: "Added", watchlist: user.watchlist });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// Remove from watchlist
router.delete("/watchlist/:itemId", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;
    const { itemType } = req.query;
    
    if (!itemId || !itemType) return res.status(400).json({ message: "Missing data" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const watchlist = user.watchlist || [];
    const beforeLen = watchlist.length;
    user.watchlist = watchlist.filter(w => !(w.itemId?.toString() === itemId?.toString() && w.itemType === itemType));

    if (user.watchlist.length === beforeLen) {
      return res.status(404).json({ message: "Item not found" });
    }

    // --- NEW LOGIC: Decrement Graph Count ---
    const graph = itemType === "movie" ? user.movieCineGraph : user.seriesCineGraph;
    let genres = [];

    if (itemType === "movie") {
      const movie = await Movie.findById(itemId).lean();
      if (movie) {
        genres = (movie.genre_ids || []).map(id => MOVIE_GENRE_MAP[id]).filter(Boolean);
      }
    } else {
      const series = await Series.findById(itemId).lean();
      if (series) {
        genres = (series.genre_ids || []).map(id => SERIES_GENRE_MAP[id]).filter(Boolean);
      }
    }

    // Delete rating if it exists and adjust graph's ratedCount / avgRating
    const existingRating = await Rating.findOneAndDelete({ user: userId, contentId: itemId });

    genres.forEach(genre => {
      const node = graph.get(genre);
      if (node) {
        const newNode = { ...node, count: Math.max(0, node.count - 1) };
        
        if (existingRating) {
          const R = existingRating.value;
          const C = newNode.ratedCount || 0;
          const A = newNode.avgRating || 0;
          
          if (C <= 1) {
            newNode.ratedCount = 0;
            newNode.avgRating = 0;
          } else {
            const sum = (A * C) - R;
            newNode.ratedCount = C - 1;
            newNode.avgRating = Number((sum / newNode.ratedCount).toFixed(2));
          }
        }
        
        graph.set(genre, newNode);
      }
    });
    // --- END NEW LOGIC ---

    // Also remove from favorites if it's there
    if (itemType === "movie") {
      user.favoriteMovies = (user.favoriteMovies || []).filter(f => f?.toString() !== itemId?.toString());
    } else if (itemType === "series") {
      user.favoriteSeries = (user.favoriteSeries || []).filter(f => f?.toString() !== itemId?.toString());
    }

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
router.get("/watchlist", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("watchlist");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ watchlist: user.watchlist });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
