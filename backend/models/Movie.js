// backend/models/Movie.js
import mongoose from "mongoose";

const movieSchema = new mongoose.Schema({}, { strict: false });

export function createMovieModel(conn) {
  return conn.model("Movie", movieSchema, "movies");
}
