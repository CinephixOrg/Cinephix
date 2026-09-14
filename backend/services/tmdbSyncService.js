import mongoose from "mongoose";
import { resolveTmdbHits } from "../utils/catalogUpsert.js";

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

// Overwritten on every sync for documents that already exist, because they
// move day to day. Everything else is only filled where a document has
// nothing, so a sync never replaces a legacy record's own title, overview or
// poster.
const REFRESH_FIELDS = ["popularity", "vote_average", "vote_count"];

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
        // Resolved as one batch: an existing TMDB id, else a legacy record
        // with the same title and release date (enriched in place), else a
        // new document. Upserting on the TMDB id alone gave every trending
        // film that existed only as a legacy record a duplicate twin.
        const Model = mongoose.model(endpoint.type === "series" ? "Series" : "Movie");
        try {
          const resolved = await resolveTmdbHits(Model, endpoint.type, data.results, { refreshFields: REFRESH_FIELDS });
          const counts = { tmdb: 0, legacy: 0, created: 0 };
          for (const entry of resolved.values()) counts[entry.via] += 1;
          console.log(`  matched by TMDB id: ${counts.tmdb}, enriched legacy: ${counts.legacy}, created: ${counts.created}`);
        } catch (err) {
          console.error(`Failed to sync ${endpoint.type} page ${page}:`, err.message);
        }
      }
      await delay(500); // 500ms delay between pages
    }
  }

  console.log("TMDB Trending Sync Completed.");
}
