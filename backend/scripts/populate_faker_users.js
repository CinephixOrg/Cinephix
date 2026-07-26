import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Models
const userSchema = new mongoose.Schema({
  username: String,
  watchlist: [{ itemId: mongoose.Schema.Types.ObjectId, itemType: String }],
  favoriteMovies: [mongoose.Schema.Types.ObjectId],
  favoriteSeries: [mongoose.Schema.Types.ObjectId],
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
}, { strict: false });

const User = mongoose.model("User", userSchema, "users");
const Rating = mongoose.model("Rating", ratingSchema, "ratings");
const Movie = mongoose.model("Movie", movieSchema, "movies");
const Series = mongoose.model("Series", movieSchema, "series");

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function discoverTMDB(type, genreIds, limit) {
  const items = [];
  let page = 1;
  while (items.length < limit && page <= 3) {
    const url = `https://api.themoviedb.org/3/discover/${type === "movie" ? "movie" : "tv"}?api_key=${TMDB_API_KEY}&with_genres=${genreIds}&sort_by=vote_count.desc&page=${page}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      for (const item of data.results) {
        if (items.length < limit && item.vote_count > 1000) {
          items.push(item);
        }
      }
    }
    page++;
    await delay(100);
  }
  return items;
}

async function fetchAndSave(type, tmdbData) {
  const Model = type === "movie" ? Movie : Series;
  let doc = await Model.findOne({ $or: [{ tmdb_id: tmdbData.id }, { "id.tmdb": tmdbData.id }] });
  if (doc) return doc._id;

  const genre_ids = tmdbData.genre_ids || [];
  doc = new Model({
    id: { tmdb: tmdbData.id },
    tmdb_id: tmdbData.id,
    title: type === "movie" ? tmdbData.title : tmdbData.name,
    original_title: type === "movie" ? tmdbData.original_title : tmdbData.original_name,
    release_date: type === "movie" ? tmdbData.release_date : tmdbData.first_air_date,
    poster_path: tmdbData.poster_path,
    backdrop_path: tmdbData.backdrop_path,
    overview: tmdbData.overview,
    vote_average: tmdbData.vote_average,
    vote_count: tmdbData.vote_count,
    popularity: tmdbData.popularity,
    genre_ids: genre_ids,
    type: type,
    updated_at: new Date()
  });

  await doc.save();
  return doc._id;
}

const EXCLUDE_USERS = ["admin", "furkan", "Nurelski", "zeynep", "ıjustsawmichael", "la_la_land", "Sümeyye"];

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  // 1. Delete test1..test10
  const test1To10 = await User.find({ username: /^test[1-9]$|^test10$/ });
  for (const tu of test1To10) {
    await Rating.deleteMany({ user: tu._id });
    await User.deleteOne({ _id: tu._id });
  }
  console.log("Deleted old test1-test10 users and their ratings.");

  // 2. Fetch 150 items dynamically
  console.log("Fetching TMDB content...");
  const pools = {
    mainstream: { movies: await discoverTMDB("movie", "28,12", 33), series: await discoverTMDB("series", "10759", 17) },
    indie: { movies: await discoverTMDB("movie", "18", 33), series: await discoverTMDB("series", "18", 17) },
    horror: { movies: await discoverTMDB("movie", "27,53", 33), series: await discoverTMDB("series", "9648", 17) }
  };

  const dbPools = { mainstream: { movie: [], series: [] }, indie: { movie: [], series: [] }, horror: { movie: [], series: [] } };

  for (const cat in pools) {
    for (const m of pools[cat].movies) {
      dbPools[cat].movie.push(await fetchAndSave("movie", m));
    }
    for (const s of pools[cat].series) {
      dbPools[cat].series.push(await fetchAndSave("series", s));
    }
  }
  console.log("Saved 150 items to database.");

  // 3. Populate Faker test users
  const allTestUsers = await User.find({ username: { $nin: [...EXCLUDE_USERS, "testuser456", "test_bulk_user"] } });
  
  console.log(`Starting to populate ${allTestUsers.length} test users...`);
  
  let i = 0;
  for (const user of allTestUsers) {
    // Determine Persona
    let persona = "mainstream";
    let opposite = "indie";
    if (i % 3 === 1) { persona = "indie"; opposite = "horror"; }
    if (i % 3 === 2) { persona = "horror"; opposite = "mainstream"; }
    i++;
    
    console.log(`[${i}/${allTestUsers.length}] Populating user: ${user.username} as ${persona}`);

    // Clear old data
    await Rating.deleteMany({ user: user._id });
    user.watchlist = [];
    user.favoriteMovies = [];
    user.favoriteSeries = [];
    user.movieCineGraph = new Map();
    user.seriesCineGraph = new Map();

    // Assign Primary Content
    const added = new Set();
    const pMovies = dbPools[persona].movie.sort(() => 0.5 - Math.random()).slice(0, 25);
    const pSeries = dbPools[persona].series.sort(() => 0.5 - Math.random()).slice(0, 12);
    
    // Assign Opposite Content
    const oppMovies = dbPools[opposite].movie.sort(() => 0.5 - Math.random()).slice(0, 5);
    const oppSeries = dbPools[opposite].series.sort(() => 0.5 - Math.random()).slice(0, 3);

    // Populate
    for (let k = 0; k < pMovies.length; k++) {
      if (added.has(pMovies[k].toString())) continue;
      added.add(pMovies[k].toString());
      user.watchlist.push({ itemId: pMovies[k], itemType: "movie" });
      if (Math.random() < 0.8) {
        await Rating.create({ user: user._id, contentId: pMovies[k], contentType: "movie", value: Math.floor(Math.random() * 3) + 8 });
      }
      if (k < 5) user.favoriteMovies.push(pMovies[k]);
    }
    
    for (let k = 0; k < pSeries.length; k++) {
      if (added.has(pSeries[k].toString())) continue;
      added.add(pSeries[k].toString());
      user.watchlist.push({ itemId: pSeries[k], itemType: "series" });
      if (Math.random() < 0.8) {
        await Rating.create({ user: user._id, contentId: pSeries[k], contentType: "series", value: Math.floor(Math.random() * 3) + 8 });
      }
      if (k < 3) user.favoriteSeries.push(pSeries[k]);
    }

    for (const om of oppMovies) {
      if (added.has(om.toString())) continue;
      added.add(om.toString());
      user.watchlist.push({ itemId: om, itemType: "movie" });
      if (Math.random() < 0.8) {
        await Rating.create({ user: user._id, contentId: om, contentType: "movie", value: Math.floor(Math.random() * 3) + 3 });
      }
    }

    for (const os of oppSeries) {
      if (added.has(os.toString())) continue;
      added.add(os.toString());
      user.watchlist.push({ itemId: os, itemType: "series" });
      if (Math.random() < 0.8) {
        await Rating.create({ user: user._id, contentId: os, contentType: "series", value: Math.floor(Math.random() * 3) + 3 });
      }
    }

    await user.save();
  }

  console.log(`Successfully populated ${allTestUsers.length} test users!`);
  console.log(`Running rebuildCineGraphs.js automatically...`);
  
  // Directly run rebuildCineGraphs logic or tell user.
  process.exit(0);
}

run().catch(console.error);
