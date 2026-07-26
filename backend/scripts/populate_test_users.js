import mongoose from "mongoose";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// 1. Define Persona Pools
const TMDB_IDS = {
  mainstream: [299534, 603, 157336, 27205, 155, 11, 559, 329, 19995, 597],
  indie: [496243, 244786, 313369, 376867, 152601, 120467, 391713, 619592, 398818, 274479],
  horror: [424, 419430, 493922, 530385, 273895, 138843, 377, 948, 242224, 310131]
};

// 2. Models
const userSchema = new mongoose.Schema({
  username: String,
  watchlist: [{ itemId: mongoose.Schema.Types.ObjectId, itemType: String }],
  favoriteMovies: [mongoose.Schema.Types.ObjectId],
  movieCineGraph: { type: Map, default: {} },
  seriesCineGraph: { type: Map, default: {} }
}, { strict: false });

const ratingSchema = new mongoose.Schema({
  user: mongoose.Schema.Types.ObjectId,
  contentId: mongoose.Schema.Types.ObjectId,
  contentType: String,
  value: Number
}, { strict: false });

const movieSchema = new mongoose.Schema({
  tmdb_id: Number,
  id: { tmdb: Number }
}, { strict: false });

const User = mongoose.model("User", userSchema, "users");
const Rating = mongoose.model("Rating", ratingSchema, "ratings");
const Movie = mongoose.model("Movie", movieSchema, "movies");

async function fetchAndSaveMovie(tmdbId) {
  let movie = await Movie.findOne({ $or: [{ tmdb_id: tmdbId }, { "id.tmdb": tmdbId }] });
  if (movie) return movie._id;

  const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Failed to fetch TMDB ID ${tmdbId}`);
    return null;
  }
  const data = await res.json();
  
  const genre_ids = data.genres ? data.genres.map(g => g.id) : [];

  movie = new Movie({
    id: { tmdb: data.id },
    tmdb_id: data.id,
    title: data.title,
    original_title: data.original_title,
    release_date: data.release_date,
    poster_path: data.poster_path,
    backdrop_path: data.backdrop_path,
    overview: data.overview,
    vote_average: data.vote_average,
    vote_count: data.vote_count,
    popularity: data.popularity,
    genre_ids: genre_ids,
    type: "movie",
    updated_at: new Date()
  });

  await movie.save();
  return movie._id;
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  // Step 1: Fetch and save movies
  const movieIds = { mainstream: [], indie: [], horror: [] };
  
  for (const cat in TMDB_IDS) {
    for (const tmdbId of TMDB_IDS[cat]) {
      const dbId = await fetchAndSaveMovie(tmdbId);
      if (dbId) movieIds[cat].push(dbId);
    }
  }
  console.log("Movies fetched and saved.");

  // Step 2: Assign to users
  const testUsers = await User.find({ username: /^test[1-9]$|^test10$/ });
  
  for (const user of testUsers) {
    // Clear old data
    await Rating.deleteMany({ user: user._id });
    user.watchlist = [];
    user.favoriteMovies = [];
    user.movieCineGraph = new Map();
    user.seriesCineGraph = new Map();

    const usernameNum = parseInt(user.username.replace("test", ""));
    
    let primaryCat = "mainstream";
    let secondaryCat = "indie";
    if (usernameNum >= 5 && usernameNum <= 7) {
      primaryCat = "indie";
      secondaryCat = "mainstream";
    } else if (usernameNum >= 8 && usernameNum <= 10) {
      primaryCat = "horror";
      secondaryCat = "mainstream";
    }

    const primaryMovies = movieIds[primaryCat];
    const secondaryMovies = movieIds[secondaryCat].slice(0, 2); // Pick 2 from secondary

    // Add to watchlist & rate
    for (let i = 0; i < primaryMovies.length; i++) {
      const mId = primaryMovies[i];
      user.watchlist.push({ itemId: mId, itemType: "movie" });
      
      // Rate 70% of them highly
      if (i < 7) {
        const rating = Math.floor(Math.random() * 3) + 8; // 8, 9, 10
        await Rating.create({ user: user._id, contentId: mId, contentType: "movie", value: rating });
      }

      // Add first 2 to favorites
      if (i < 2) {
        user.favoriteMovies.push(mId);
      }
    }

    // Add secondary (disliked) movies to create negative Pearson correlation
    for (const mId of secondaryMovies) {
      user.watchlist.push({ itemId: mId, itemType: "movie" });
      const badRating = Math.floor(Math.random() * 3) + 3; // 3, 4, 5
      await Rating.create({ user: user._id, contentId: mId, contentType: "movie", value: badRating });
    }

    await user.save();
    console.log(`Populated ${user.username} as ${primaryCat}`);
  }

  console.log("Test users populated. Run rebuildCineGraphs.js to apply graph counts.");
  process.exit(0);
}

run();
