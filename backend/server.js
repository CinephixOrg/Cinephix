// backend/server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Model ve Rota import'ları
import { createMovieModel } from "./models/Movie.js";
import { createSeriesModel } from "./models/Series.js";
import moviesRouteFactory from "./routes/movieRoute.js";
import seriesRouteFactory from "./routes/seriesRoute.js";
import userRoute from "./routes/userRoute.js";

const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 5000;

// User rotalarını en başta tanımlıyoruz
app.use("/api/users", userRoute);

// Bağlantının açılmasını bekleyen yardımcı fonksiyon
function waitOpen(conn) {
  return new Promise((resolve, reject) => {
    conn.on("error", reject);
    conn.once("open", () => resolve());
  });
}

async function start() {
  try {
    // 1. Filmler ve diziler için özel bağlantıları oluştur
    const moviesConn = mongoose.createConnection(MONGO_URI, { dbName: "cleaned_db" });
    const seriesConn = mongoose.createConnection(MONGO_URI, { dbName: "cleaned_db" });

    // 2. TÜM DİĞER MODELLERİN KULLANACAĞI VARSAYILAN BAĞLANTIYI OLUŞTUR
    // mongoose.connect() bir promise döndürür, bu yüzden await ile bekleyebiliriz.
    const mainConnectionPromise = mongoose.connect(MONGO_URI, { dbName: "cleaned_db" });

    // 3. Tüm bağlantıların (2 özel + 1 ana) kurulmasını bekle
    await Promise.all([
      waitOpen(moviesConn),
      waitOpen(seriesConn),
      mainConnectionPromise,
    ]);
    console.log("Tüm veritabanı bağlantıları başarıyla kuruldu.");

    // Mevcut çalışan yapıyı koruyoruz
    const Movie = createMovieModel(moviesConn);
    const Series = createSeriesModel(seriesConn);
    app.use("/api/movies", await moviesRouteFactory(Movie));
    app.use("/api/series", await seriesRouteFactory(Series));
    
    // Sunucuyu başlat
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (e) {
    console.error("Startup error:", e);
    process.exit(1);
  }
}

start();