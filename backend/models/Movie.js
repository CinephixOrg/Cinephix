// backend/models/Movie.js
import mongoose from "mongoose";

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

export function createMovieModel(conn) {
  return conn.model("Movie", movieSchema, "movies");
}
