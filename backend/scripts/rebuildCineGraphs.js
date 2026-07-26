import mongoose from "mongoose";
import dotenv from "dotenv";
import { MOVIE_GENRE_MAP, SERIES_GENRE_MAP } from "../utils/genreConstants.js";
dotenv.config();

/* ---------------- CONNECT (INDEPENDENT) ---------------- */
await mongoose.connect(process.env.MONGO_URI);
console.log("MongoDB connected (rebuild)");

/* ---------------- SCHEMAS (LOCAL) ---------------- */

const userSchema = new mongoose.Schema({
  watchlist: [{ itemId: mongoose.Schema.Types.ObjectId, itemType: String }],
  movieCineGraph: {
    type: Map,
    of: { count: Number, ratedCount: Number, avgRating: Number },
    default: {}
  },
  seriesCineGraph: {
    type: Map,
    of: { count: Number, ratedCount: Number, avgRating: Number },
    default: {}
  }
}, { strict: false });

const ratingSchema = new mongoose.Schema({
  user: mongoose.Schema.Types.ObjectId,
  contentId: mongoose.Schema.Types.ObjectId,
  contentType: String,
  value: Number
}, { strict: false });

const movieSchema = new mongoose.Schema({}, { strict: false });
const seriesSchema = new mongoose.Schema({}, { strict: false });

/* ---------------- MODELS ---------------- */

const User = mongoose.model("User", userSchema, "users");
const Rating = mongoose.model("Rating", ratingSchema, "ratings");
const Movie = mongoose.model("Movie", movieSchema, "movies");
const Series = mongoose.model("Series", seriesSchema, "series");

/* ----------------GENRE MAPS IMPORTED FROM genreConstants (see top of file)  --------------- */

/* ---------------- HELPERS ---------------- */

const addToWatchlistGraph = (graph, genre) => {
  const node = graph.get(genre) || { count: 0, ratedCount: 0, avgRating: 0 };
  graph.set(genre, { ...node, count: node.count + 1 });
};

const addToRatingGraph = (graph, genre, rating) => {
  const node = graph.get(genre) || { count: 0, ratedCount: 0, avgRating: 0 };
  const newRatedCount = node.ratedCount + 1;
  const newAvg = (node.avgRating * node.ratedCount + rating) / newRatedCount;
  graph.set(genre, { ...node, ratedCount: newRatedCount, avgRating: +newAvg.toFixed(2) });
};

/* ---------------- MAIN ---------------- */

async function run() {
  const users = await User.find();

  for (const user of users) {
    user.movieCineGraph = new Map();
    user.seriesCineGraph = new Map();

    // 1. Process Watchlist for counts
    const watchlist = user.watchlist || [];
    for (const w of watchlist) {
      if (w.itemType === "movie") {
        const movie = await Movie.findById(w.itemId).lean();
        movie?.genre_ids
          ?.map(id => MOVIE_GENRE_MAP[id])
          .filter(Boolean)
          .forEach(g => addToWatchlistGraph(user.movieCineGraph, g));
      } else if (w.itemType === "series") {
        const series = await Series.findById(w.itemId).lean();
        series?.genre_ids
          ?.map(id => SERIES_GENRE_MAP[id])
          .filter(Boolean)
          .forEach(g => addToWatchlistGraph(user.seriesCineGraph, g));
      }
    }

    // 2. Process Ratings for avgRating and ratedCount
    const ratings = await Rating.find({ user: user._id });
    for (const r of ratings) {
      if (r.contentType === "movie") {
        const movie = await Movie.findById(r.contentId).lean();
        movie?.genre_ids
          ?.map(id => MOVIE_GENRE_MAP[id])
          .filter(Boolean)
          .forEach(g => addToRatingGraph(user.movieCineGraph, g, r.value));
      } else {
        const series = await Series.findById(r.contentId).lean();
        series?.genre_ids
          ?.map(id => SERIES_GENRE_MAP[id])
          .filter(Boolean)
          .forEach(g => addToRatingGraph(user.seriesCineGraph, g, r.value));
      }
    }

    await user.save();
    console.log(`✔ rebuilt cinegraph for ${user.username}`);
  }

  console.log("DONE");
  process.exit(0);
}

run();
