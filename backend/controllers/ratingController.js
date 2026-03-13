// backend/controllers/ratingController.js
import Rating from "../models/Rating.js";
import User from "../models/User.js";

import { conn } from "../db/connections.js";
import { createMovieModel } from "../models/Movie.js";
import { createSeriesModel } from "../models/Series.js";

// New imports for consistent responses and error handling
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

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

export const addOrUpdateRating = asyncHandler(async (req, res) => {
  const { contentId, contentType, value } = req.body;
  const userId = req.user.id;

  // Validation
  if (!contentId || !contentType || value === undefined) {
    return sendError(res, 'contentId, contentType, and value are required', 400);
  }

  if (!['movie', 'series'].includes(contentType)) {
    return sendError(res, 'contentType must be "movie" or "series"', 400);
  }

  if (typeof value !== 'number' || value < 1 || value > 10) {
    return sendError(res, 'Rating value must be between 1 and 10', 400);
  }

  const existingRating = await Rating.findOne({ user: userId, contentId });

  let genres = [];

  if (contentType === "movie") {
    const movie = await Movie.findById(contentId).lean();
    if (!movie) return sendError(res, "Movie not found", 404);

    genres = (movie.genre_ids || [])
      .map(id => MOVIE_GENRE_MAP[id])
      .filter(Boolean);

  } else {
    const series = await Series.findById(contentId).lean();
    if (!series) return sendError(res, "Series not found", 404);

    genres = (series.genre_ids || [])
      .map(id => SERIES_GENRE_MAP[id])
      .filter(Boolean);
  }

  const newRating = await Rating.findOneAndUpdate(
    { user: userId, contentId },
    { contentType, value },
    { upsert: true, new: true, runValidators: true }
  ).lean();

  await updateCineGraph({
    userId,
    contentType,
    genres,
    newValue: value,
    oldValue: existingRating ? existingRating.value : null,
  });

  sendSuccess(res, newRating, 'Rating saved successfully', 200);
});

/* ---------- GET MY RATING ---------- */

export const getMyRating = asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const userId = req.user.id;

  if (!contentId) {
    return sendError(res, 'contentId is required', 400);
  }

  const rating = await Rating.findOne({ user: userId, contentId }).lean();

  if (!rating) {
    return sendError(res, 'Rating not found', 404);
  }

  sendSuccess(res, rating, 'Rating fetched', 200);
});
