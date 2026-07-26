import mongoose from "mongoose";

// Helper to wait a bit between requests to avoid rate limits
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchFromTMDB(url) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.warn("TMDB_API_KEY is not defined in .env. Skipping TMDB fetch.");
    return null;
  }
  
  // URL may already contain query parameters
  const separator = url.includes("?") ? "&" : "?";
  const finalUrl = `${url}${separator}api_key=${apiKey}`;

  try {
    const response = await fetch(finalUrl);
    if (!response.ok) {
      console.error(`TMDB fetch failed for ${finalUrl}: ${response.status} ${response.statusText}`);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error(`TMDB fetch error for ${finalUrl}:`, err.message);
    return null;
  }
}

async function upsertMovie(tmdbMovie) {
  const Movie = mongoose.model("Movie");
  const tmdbId = tmdbMovie.id;
  if (!tmdbId) return;

  const filter = {
    $or: [{ "id.tmdb": tmdbId }, { tmdb_id: tmdbId }, { tmdb: tmdbId }]
  };

  const update = {
    $set: {
      "id.tmdb": tmdbId,
      tmdb_id: tmdbId,
      title: tmdbMovie.title,
      original_title: tmdbMovie.original_title,
      release_date: tmdbMovie.release_date,
      poster_path: tmdbMovie.poster_path,
      backdrop_path: tmdbMovie.backdrop_path,
      overview: tmdbMovie.overview,
      vote_average: tmdbMovie.vote_average,
      vote_count: tmdbMovie.vote_count,
      popularity: tmdbMovie.popularity,
      genre_ids: tmdbMovie.genre_ids,
      type: "movie",
      updated_at: new Date()
    }
  };

  try {
    await Movie.updateOne(filter, update, { upsert: true });
  } catch (err) {
    console.error(`Failed to upsert movie ${tmdbMovie.title}:`, err.message);
  }
}

async function upsertSeries(tmdbSeries) {
  const Series = mongoose.model("Series");
  const tmdbId = tmdbSeries.id;
  if (!tmdbId) return;

  const filter = {
    $or: [{ "id.tmdb": tmdbId }, { tmdb_id: tmdbId }, { tmdb: tmdbId }]
  };

  const update = {
    $set: {
      "id.tmdb": tmdbId,
      tmdb_id: tmdbId,
      name: tmdbSeries.name,
      original_name: tmdbSeries.original_name,
      first_air_date: tmdbSeries.first_air_date,
      poster_path: tmdbSeries.poster_path,
      backdrop_path: tmdbSeries.backdrop_path,
      overview: tmdbSeries.overview,
      vote_average: tmdbSeries.vote_average,
      vote_count: tmdbSeries.vote_count,
      popularity: tmdbSeries.popularity,
      genre_ids: tmdbSeries.genre_ids,
      type: "series",
      updated_at: new Date()
    }
  };

  try {
    await Series.updateOne(filter, update, { upsert: true });
  } catch (err) {
    console.error(`Failed to upsert series ${tmdbSeries.name}:`, err.message);
  }
}

export async function syncTMDBTrending() {
  console.log("Starting TMDB Trending Sync...");
  
  const endpoints = [
    { url: "https://api.themoviedb.org/3/trending/movie/week", type: "movie" },
    { url: "https://api.themoviedb.org/3/movie/now_playing", type: "movie" },
    { url: "https://api.themoviedb.org/3/trending/tv/week", type: "series" },
    { url: "https://api.themoviedb.org/3/tv/on_the_air", type: "series" }
  ];

  for (const endpoint of endpoints) {
    console.log(`Fetching from ${endpoint.url}...`);
    // Let's fetch the first 2 pages for each to get a good chunk of data
    for (let page = 1; page <= 2; page++) {
      const data = await fetchFromTMDB(`${endpoint.url}?page=${page}`);
      if (data && data.results && Array.isArray(data.results)) {
        console.log(`Processing ${data.results.length} items from page ${page}...`);
        for (const item of data.results) {
          if (endpoint.type === "movie") {
            await upsertMovie(item);
          } else if (endpoint.type === "series") {
            await upsertSeries(item);
          }
        }
      }
      await delay(500); // 500ms delay between pages
    }
  }

  console.log("TMDB Trending Sync Completed.");
}
