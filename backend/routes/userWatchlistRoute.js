// routes/userWatchlistRoute.js
import express from "express";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { conn } from "../db/connections.js";
import { createMovieModel } from "../models/Movie.js";
import { createSeriesModel } from "../models/Series.js";
import Rating from "../models/Rating.js";
import { MOVIE_GENRE_MAP, SERIES_GENRE_MAP } from "../utils/genreConstants.js";
import {
  GENRE_BADGES,
  DEVOTEE_THRESHOLD,
  MASTER_THRESHOLD,
  crossedThresholdTier,
  countGenreBadgesFromWatchlist,
  crossedVolumeTier,
  countVolumeBadgesFromWatchlist,
  VOLUME_TIERS,
  bumpStreak,
} from "../controllers/badgeController.js";

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

    // Badge popup detection — this add is the actual event that moves both
    // a genre badge's count and a volume badge's count (Watched-List
    // membership, not rating — see countGenreBadgesFromWatchlist's own
    // comment), so this is the one real place either family can be newly
    // earned, not addOrUpdateRating (rating something already requires it
    // to already be on the watched list, so by rating time these counts
    // have already moved). Each entry carries its own `family` so the
    // client's single BadgeEarnedModal/badge-share flow knows which
    // definitions table (genre vs volume) to resolve art/labels from,
    // without needing two separate notification pipelines.
    let newlyEarnedBadges = [];

    // Streak — unconditional, same reasoning every other engagement
    // endpoint's own identical call already has: adding to the watched
    // list is real evidence of showing up today.
    const streakBadge = await bumpStreak(userId);
    if (streakBadge) newlyEarnedBadges.push(streakBadge);

    // Genre half — scoped to just the badge keys this content's own
    // genres actually touch (usually 1-2 of the 8) rather than
    // recomputing+checking all 8 on every add.
    if (genres.length > 0) {
      const affectedKeys = new Set(
        GENRE_BADGES.filter((b) => (contentType === "movie" ? b.movieGenres : b.seriesGenres).some((g) => genres.includes(g))).map(
          (b) => b.key
        )
      );
      if (affectedKeys.size > 0) {
        const counts = await countGenreBadgesFromWatchlist(user.watchlist);
        newlyEarnedBadges.push(
          ...counts
            .filter((c) => affectedKeys.has(c.key))
            .map((c) => ({ family: "genre", key: c.key, count: c.count, tier: crossedThresholdTier(c.count) }))
            .filter((c) => c.tier !== null)
            .map((c) => ({ ...c, threshold: c.tier === "master" ? MASTER_THRESHOLD : DEVOTEE_THRESHOLD }))
        );
      }
    }

    // Volume half — only the ladder for the type just added can possibly
    // have moved (adding a movie can never change the series count).
    {
      const volumeCounts = await countVolumeBadgesFromWatchlist(user.watchlist);
      const relevant = volumeCounts.find((c) => c.key === (contentType === "movie" ? "movies" : "series"));
      const crossedTier = relevant ? crossedVolumeTier(relevant.count) : null;
      if (crossedTier) {
        const threshold = VOLUME_TIERS.find((t) => t.tier === crossedTier).threshold;
        newlyEarnedBadges.push({ family: "volume", key: relevant.key, count: relevant.count, tier: crossedTier, threshold });
      }
    }

    // Auto-clears "Currently Watching" the moment the SAME item lands on
    // the Watched List — the natural "I finished it" signal, direct ask —
    // without needing a separate explicit stop action for this case (a
    // manual stop still exists for the "paused partway through, haven't
    // finished yet" case, see userController.js's stopCurrentlyWatching).
    if (
      user.currentlyWatching &&
      user.currentlyWatching.itemId?.toString() === contentId?.toString() &&
      user.currentlyWatching.itemType === contentType
    ) {
      user.currentlyWatching = undefined;
    }

    await user.save();

    // Included so the mobile client can sync its own cached "Currently
    // Watching" button state locally (AuthContext.updateUser) without a
    // second round trip whenever this add just auto-cleared it above.
    // `?.itemId ? ... : null` rather than a plain `?? null` — Mongoose
    // auto-vivifies an unset single-nested-object schema path (like
    // currentlyWatching) into `{}` the moment it's accessed on a document
    // instance, even when nothing was ever actually set (confirmed via
    // direct testing), so a bare `?? null` would ship a misleading `{}`
    // instead of `null` for the (very common) case of a user who's never
    // used this feature at all.
    return res.status(201).json({
      message: "Added",
      watchlist: user.watchlist,
      newlyEarnedBadges,
      currentlyWatching: user.currentlyWatching?.itemId ? user.currentlyWatching : null,
    });
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
