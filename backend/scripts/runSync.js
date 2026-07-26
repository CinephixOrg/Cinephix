import mongoose from "mongoose";
import dotenv from "dotenv";
import { syncTMDBTrending } from "../services/tmdbSyncService.js";
import { createMovieModel } from "../models/Movie.js";
import { createSeriesModel } from "../models/Series.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: "cleaned_db" });
    createMovieModel(mongoose.connection);
    createSeriesModel(mongoose.connection);
    
    console.log("Connected to DB, starting sync...");
    await syncTMDBTrending();
    
    console.log("Done.");
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
}

run();
