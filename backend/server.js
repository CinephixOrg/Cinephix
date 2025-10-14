// backend/server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

import { createMovieModel } from "./models/Movie.js";
import { createSeriesModel } from "./models/Series.js";
import moviesRouteFactory from "./routes/movies.js";
import seriesRouteFactory from "./routes/series.js";

const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 5000;

function waitOpen(conn) {
  return new Promise((resolve, reject) => {
    conn.on("error", reject);
    conn.once("open", () => resolve());
  });
}

async function start() {
  try {
    // movie DB connection
    const moviesConn = mongoose.createConnection(MONGO_URI, { dbName: "cleaned_db" });
    // series DB connection
    const seriesConn = mongoose.createConnection(MONGO_URI, { dbName: "cleaned_db" });

    await Promise.all([waitOpen(moviesConn), waitOpen(seriesConn)]);
    console.log("Connected to both databases");

    const Movie = createMovieModel(moviesConn);
    const Series = createSeriesModel(seriesConn);

    app.use("/api/movies", await moviesRouteFactory(Movie));
    app.use("/api/series", await seriesRouteFactory(Series));

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (e) {
    console.error("Startup error:", e);
    process.exit(1);
  }
}

start();
