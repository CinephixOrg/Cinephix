// backend/controllers/ratingController.js
import Rating from "../models/Rating.js";
import User from "../models/User.js";

import { conn } from "../db/connections.js";
import { createMovieModel } from "../models/Movie.js";
import { createSeriesModel } from "../models/Series.js";

const Movie = createMovieModel(conn);
const Series = createSeriesModel(conn);

/* ---------- TMDB GENRE MAPS ---------- */

const MOVIE_GENRE_MAP = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Science Fiction",
  10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western"
};

const SERIES_GENRE_MAP = {
  10759: "Action & Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  10762: "Kids", 9648: "Mystery", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk",
  10768: "War & Politics", 37: "Western"
};

/* ---------- CINEGRAPH UPDATE ---------- */

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

/* ---------- ADD / UPDATE RATING ---------- */

export const addOrUpdateRating = async (req, res) => {
  const { contentId, contentType, value } = req.body;
  const userId = req.user.id;

  try {
    const existingRating = await Rating.findOne({ user: userId, contentId });

    let genres = [];

    if (contentType === "movie") {
      const movie = await Movie.findById(contentId).lean();
      if (!movie) return res.status(404).json({ message: "Movie not found" });

      genres = (movie.genre_ids || [])
        .map(id => MOVIE_GENRE_MAP[id])
        .filter(Boolean);

    } else {
      const series = await Series.findById(contentId).lean();
      if (!series) return res.status(404).json({ message: "Series not found" });

      genres = (series.genre_ids || [])
        .map(id => SERIES_GENRE_MAP[id])
        .filter(Boolean);
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

/* ---------- GET MY RATING ---------- */

export const getMyRating = async (req, res) => {
  const { contentId } = req.params;
  const userId = req.user.id;

  try {
    const rating = await Rating.findOne({ user: userId, contentId });

    if (!rating) {
      return res.status(404).json({ message: "Kullanıcı bu içeriği puanlamamış." });
    }

    res.status(200).json(rating);
  } catch (error) {
    res.status(500).json({ message: "Sunucu hatası", error: error.message });
  }
};
