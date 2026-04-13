// backend/server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

// Import error handler & logger middleware
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger, logger } from "./middleware/logger.js";
import { simpleRateLimiter } from "./middleware/rateLimiter.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Apply request logging middleware
app.use(requestLogger);

// Apply rate limiting middleware (Issue #20)
app.use('/api/', simpleRateLimiter);

// Model ve Rota import'ları
import { createMovieModel } from "./models/Movie.js";
import { createSeriesModel } from "./models/Series.js";
import moviesRouteFactory from "./routes/movieRoute.js";
import seriesRouteFactory from "./routes/seriesRoute.js";
import userRoute from "./routes/userRoute.js";
import userRoutes from './models/User.js';
import reviewRoutes from './routes/reviewRoutes.js';
import ratingRoutes from './routes/rating.js';
import matchRoute from "./routes/matchRoute.js";

const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 5000;

// User rotalarını en başta tanımlıyoruz
app.use("/api/users", userRoute);
app.use('/api/ratings', ratingRoutes); // <-- YENİ ROTAYI EKLE
app.use('/api/reviews', reviewRoutes);
app.use("/api/match", matchRoute);

// Bağlantının açılmasını bekleyen yardımcı fonksiyon
function waitOpen(conn) {
  return new Promise((resolve, reject) => {
    conn.on("error", reject);
    conn.once("open", () => resolve());
  });
}

async function start() {
  try {
    logger.info('Starting Cinephix server...');
    
    // 1. Filmler ve diziler için özel bağlantıları oluştur
    const moviesConn = mongoose.createConnection(MONGO_URI, { dbName: "cleaned_db" });
    const seriesConn = mongoose.createConnection(MONGO_URI, { dbName: "cleaned_db" });

    // 2. TÜM DİĞER MODELLERİN KULLANACAĞI VARSAYILAN BAĞLANTIYI OLUŞTUR
    const mainConnectionPromise = mongoose.connect(MONGO_URI, { dbName: "cleaned_db" });

    // 3. Tüm bağlantıların kurulmasını bekle
    await Promise.all([
      waitOpen(moviesConn),
      waitOpen(seriesConn),
      mainConnectionPromise,
    ]);
    logger.info("All database connections established successfully");

    // Mevcut çalışan yapıyı koruyoruz
    const Movie = createMovieModel(moviesConn);
    const Series = createSeriesModel(seriesConn);
    app.use("/api/movies", await moviesRouteFactory(Movie));
    app.use("/api/series", await seriesRouteFactory(Series));

    // User modelinin populate() yapabilmesi için, 
    // Movie ve Series modellerini VARSAYILAN bağlantıya da kaydetmeliyiz.
    createMovieModel(mongoose.connection);
    createSeriesModel(mongoose.connection);
    
    logger.info('Movie and Series models registered to default connection');

    // Register global error handler middleware (must be last)
    app.use(errorHandler);

    // Sunucuyu başlat
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Rate limiting: 100 requests per 15 minutes per IP`);
    });
  } catch (e) {
    logger.error(`Startup error: ${e.message}`);
    process.exit(1);
  }
}

start();