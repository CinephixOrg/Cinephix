// backend/controllers/ratingController.js (YENİ DOSYA)
import Rating from '../models/Rating.js';
import User from "../models/User.js";

import { conn } from "../db/connections.js";
import { createMovieModel } from "../models/Movie.js";
import { createSeriesModel } from "../models/Series.js";

const Movie = createMovieModel(conn);
const Series = createSeriesModel(conn);

const updateCineGraph = async ({
  userId,
  contentType,
  genres,
  newValue,
  oldValue = null
}) => {
  const user = await User.findById(userId);
  if (!user) return;

  const graph =
    contentType === "movie"
      ? user.movieCineGraph
      : user.seriesCineGraph;

  genres.forEach((genre) => {
    const node = graph.get(genre) || { count: 0, avgRating: 0 };

    if (oldValue === null) {
      const newCount = node.count + 1;
      const newAvg =
        (node.avgRating * node.count + newValue) / newCount;

      graph.set(genre, {
        count: newCount,
        avgRating: Number(newAvg.toFixed(2)),
      });
    } else {
      const newAvg =
        (node.avgRating * node.count - oldValue + newValue) / node.count;

      graph.set(genre, {
        count: node.count,
        avgRating: Number(newAvg.toFixed(2)),
      });
    }
  });

  await user.save();
};

// @desc    Bir içeriğe puan ekle VEYA güncelle
// @route   POST /api/ratings
// @access  Private
export const addOrUpdateRating = async (req, res) => {
  const { contentId, contentType, value } = req.body;
  const userId = req.user.id;

  try {
    const existingRating = await Rating.findOne({
      user: userId,
      contentId,
    });

    let genres = [];

    if (contentType === "movie") {
      const movie = await Movie.findById(contentId).lean();
      if (!movie) return res.status(404).json({ message: "Movie not found" });
      genres = movie.genres || [];
    } else {
      const series = await Series.findById(contentId).lean();
      if (!series) return res.status(404).json({ message: "Series not found" });
      genres = series.genres || [];
    }

    const newRating = await Rating.findOneAndUpdate(
      { user: userId, contentId },
      { contentType, value },
      { upsert: true, new: true, runValidators: true }
    );

    await updateCineGraph({
      userId,
      contentType,
      genres,
      newValue: value,
      oldValue: existingRating ? existingRating.value : null,
    });

    res.status(200).json(newRating);
  } catch (error) {
    res.status(500).json({
      message: "Puan kaydedilemedi",
      error: error.message,
    });
  }
};


// @desc    Kullanıcının bir içeriğe verdiği puanı getir
// @route   GET /api/ratings/me/:contentId
// @access  Private
export const getMyRating = async (req, res) => {
    const { contentId } = req.params;
    const userId = req.user.id;

    try {
        const rating = await Rating.findOne({ user: userId, contentId: contentId });

        if (!rating) {
            // Puan vermemiş olması bir hata değildir, sadece "bulunamadı"
            return res.status(404).json({ message: "Kullanıcı bu içeriği puanlamamış." });
        }

        res.status(200).json(rating);
    } catch (error) {
        res.status(500).json({ message: "Sunucu hatası", error: error.message });
    }
};