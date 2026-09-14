// backend/models/Series.js
import mongoose from "mongoose";

const seriesSchema = new mongoose.Schema(
  {},
  {
    strict: false,
    // Declared here, built deliberately by scripts/createCatalogIndexes.js —
    // see models/Movie.js for why this is not left to autoIndex.
    autoIndex: false,
  }
);

// Series store their title in `name` (almost all) or `title` (a few older
// records), and every title query checks both.
seriesSchema.index({ name: 1 }, { name: "name_1" });
seriesSchema.index({ title: 1 }, { name: "title_1" });

// External ids, sparse — see models/Movie.js.
for (const path of ["tmdb_id", "id.tmdb", "tmdb", "imdb_id", "id.imdb", "imdb", "tvdb_id", "id.tvdb", "tvdb"]) {
  seriesSchema.index({ [path]: 1 }, { sparse: true, name: `${path}_1_sparse` });
}

export function createSeriesModel(conn) {
  return conn.model("Series", seriesSchema, "series");
}
