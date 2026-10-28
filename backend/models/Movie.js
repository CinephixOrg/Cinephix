// backend/models/Movie.js
import mongoose from "mongoose";
import { selectOriginalTitles } from "../utils/catalogTitles.js";

const movieSchema = new mongoose.Schema(
  {},
  {
    strict: false,
    // The indexes below are declared here as the single source of truth, but
    // never built on app start: building an index on a 578k-document
    // collection is a deliberate operation (scripts/createCatalogIndexes.js),
    // not a side effect of the next deploy. Mongoose would otherwise issue
    // these createIndex calls from every connection that registers this model.
    autoIndex: false,
  }
);

// Every title it returns carries its original-language name (utils/catalogTitles.js).
movieSchema.plugin(selectOriginalTitles);

// Exact-title lookups: the import's candidate query, the TMDB resolver's
// legacy-twin query (utils/catalogUpsert.js) and the duplicate cleanup scripts.
movieSchema.index({ title: 1 }, { name: "title_1" });

// External ids. Sparse, so only documents that actually carry an id are
// indexed and these stay tiny. Every path the import and resolver put in the
// same $or needs one: MongoDB only uses indexes for an $or when every clause
// is indexed, and falls back to a full collection scan otherwise.
for (const path of ["tmdb_id", "id.tmdb", "tmdb", "imdb_id", "id.imdb", "imdb", "tvdb_id", "id.tvdb", "tvdb"]) {
  movieSchema.index({ [path]: 1 }, { sparse: true, name: `${path}_1_sparse` });
}

// feedController.js's getNewReleases filters this collection by a
// release_date range AND sorts by it — with no index at all on a
// 578k-document collection, that's a full collection scan followed by an
// in-memory sort on every single request, the real reason Discover's own
// New Releases rail measurably loaded slower than every sibling rail
// (WhatToWatchRail and friends all filter/sort on something else that's
// already indexed or a much smaller computed set). Descending to match the
// query's own `.sort({release_date: -1})` exactly.
movieSchema.index({ release_date: -1 }, { name: "release_date_-1" });

export function createMovieModel(conn) {
  return conn.model("Movie", movieSchema, "movies");
}
