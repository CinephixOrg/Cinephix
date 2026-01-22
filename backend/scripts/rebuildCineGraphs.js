import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

/* ---------------- CONNECT (INDEPENDENT) ---------------- */
await mongoose.connect(process.env.MONGO_URI);
console.log("MongoDB connected (rebuild)");

/* ---------------- SCHEMAS (LOCAL) ---------------- */

const userSchema = new mongoose.Schema({
  movieCineGraph: {
    type: Map,
    of: { count: Number, avgRating: Number },
    default: {}
  },
  seriesCineGraph: {
    type: Map,
    of: { count: Number, avgRating: Number },
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

/* ---------------- GENRE MAPS ---------------- */

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

/* ---------------- HELPERS ---------------- */

const addToGraph = (graph, genre, rating) => {
  const node = graph.get(genre) || { count: 0, avgRating: 0 };
  const newCount = node.count + 1;
  const newAvg = (node.avgRating * node.count + rating) / newCount;
  graph.set(genre, { count: newCount, avgRating: +newAvg.toFixed(2) });
};

/* ---------------- MAIN ---------------- */

async function run() {
  const users = await User.find();

  for (const user of users) {
    user.movieCineGraph = new Map();
    user.seriesCineGraph = new Map();

    const ratings = await Rating.find({ user: user._id });

    for (const r of ratings) {
      if (r.contentType === "movie") {
        const movie = await Movie.findById(r.contentId).lean();
        movie?.genre_ids
          ?.map(id => MOVIE_GENRE_MAP[id])
          .filter(Boolean)
          .forEach(g => addToGraph(user.movieCineGraph, g, r.value));
      } else {
        const series = await Series.findById(r.contentId).lean();
        series?.genre_ids
          ?.map(id => SERIES_GENRE_MAP[id])
          .filter(Boolean)
          .forEach(g => addToGraph(user.seriesCineGraph, g, r.value));
      }
    }

    await user.save();
    console.log(`✔ rebuilt cinegraph for ${user.username}`);
  }

  console.log("DONE");
  process.exit(0);
}

run();
