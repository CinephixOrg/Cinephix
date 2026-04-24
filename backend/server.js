// backend/server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";

// Import error handler & logger middleware
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger, logger } from "./middleware/logger.js";
import { simpleRateLimiter } from "./middleware/rateLimiter.js";

dotenv.config();
const app = express();
app.use(helmet());
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());

// Apply request logging middleware
app.use(requestLogger);

// Apply rate limiting middleware (Issue #20)
app.use('/api/', simpleRateLimiter);

// Model and Route imports
import { createMovieModel } from "./models/Movie.js";
import { createSeriesModel } from "./models/Series.js";
import moviesRouteFactory from "./routes/movieRoute.js";
import seriesRouteFactory from "./routes/seriesRoute.js";
import userRoute from "./routes/userRoute.js";
import userRoutes from './models/User.js';
import reviewRoutes from './routes/reviewRoutes.js';
import ratingRoutes from './routes/rating.js';
import matchRoute from "./routes/matchRoute.js";
import userWatchlistRoute from "./routes/userWatchlistRoute.js";

const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 5000;

// Define User routes at the beginning
app.use("/api/users", userRoute);
app.use("/api/users/me", userWatchlistRoute);
app.use('/api/ratings', ratingRoutes); // <-- ADD NEW ROUTE
app.use('/api/reviews', reviewRoutes);
app.use("/api/match", matchRoute);

// Helper function waiting for connection to open
function waitOpen(conn) {
  return new Promise((resolve, reject) => {
    conn.on("error", reject);
    conn.once("open", () => resolve());
  });
}

async function start() {
  try {
    logger.info('Starting Cinephix server...');
    
    // 1. Create separate connections for movies and series
    const moviesConn = mongoose.createConnection(MONGO_URI, { dbName: "cleaned_db" });
    const seriesConn = mongoose.createConnection(MONGO_URI, { dbName: "cleaned_db" });

    // 2. CREATE DEFAULT CONNECTION FOR ALL OTHER MODELS
    const mainConnectionPromise = mongoose.connect(MONGO_URI, { dbName: "cleaned_db" });

    // 3. Wait for all connections to be established
    await Promise.all([
      waitOpen(moviesConn),
      waitOpen(seriesConn),
      mainConnectionPromise,
    ]);
    logger.info("All database connections established successfully");

    // Keep existing working structure
    const Movie = createMovieModel(moviesConn);
    const Series = createSeriesModel(seriesConn);
    app.use("/api/movies", await moviesRouteFactory(Movie));
    app.use("/api/series", await seriesRouteFactory(Series));

    // For User model to be able to populate(),
    // We need to register Movie and Series models to the default connection as well.
    createMovieModel(mongoose.connection);
    createSeriesModel(mongoose.connection);
    
    logger.info('Movie and Series models registered to default connection');

    // Register global error handler middleware (must be last)
    app.use(errorHandler);

    // Health check with DB status
    app.get('/api/health', (req, res) => {
      const dbState = mongoose.connection.readyState;
      // 1 = connected, 2 = connecting
      const dbOk = dbState === 1;
      res.status(dbOk ? 200 : 503).json({
        success: dbOk,
        message: dbOk ? 'API is healthy' : 'Database unavailable',
        db: dbOk ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
      });
    });

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Rate limiting: 100 requests per 15 minutes per IP`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');
      server.close(async () => {
        await mongoose.disconnect();
        logger.info('All connections closed');
        process.exit(0);
      });
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (e) {
    logger.error(`Startup error: ${e.message}`);
    process.exit(1);
  }
}

start();