// backend/models/Series.js
import mongoose from "mongoose";

const seriesSchema = new mongoose.Schema({}, { strict: false });

export function createSeriesModel(conn) {
  return conn.model("Series", seriesSchema, "series");
}
