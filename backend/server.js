import http from "http";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import { Server } from "socket.io";

import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger, logger } from "./middleware/logger.js";
import { simpleRateLimiter } from "./middleware/rateLimiter.js";
import { setupChat } from "./sockets/chatSocket.js";
import { seedGroups } from "./scripts/seedGroups.js";

dotenv.config();
const app = express();
app.use(helmet());

const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ["http://localhost:5173", "http://127.0.0.1:5173"];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(requestLogger);
app.use("/api/", simpleRateLimiter);

// Model and Route imports
import { createMovieModel } from "./models/Movie.js";
import { createSeriesModel } from "./models/Series.js";
import moviesRouteFactory from "./routes/movieRoute.js";
import seriesRouteFactory from "./routes/seriesRoute.js";
import userRoute from "./routes/userRoute.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import ratingRoutes from "./routes/rating.js";
import matchRoute from "./routes/matchRoute.js";
import userWatchlistRoute from "./routes/userWatchlistRoute.js";
import feedRoute from "./routes/feedRoute.js";
import groupRoute from "./routes/groupRoute.js";
import conversationRoute from "./routes/conversationRoute.js";
import notificationRoute from "./routes/notificationRoute.js";

const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 5000;

app.use("/api/users", userRoute);
app.use("/api/users/me", userWatchlistRoute);
app.use("/api/ratings", ratingRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/match", matchRoute);
app.use("/api/feed", feedRoute);
app.use("/api/groups", groupRoute);
app.use("/api/conversations", conversationRoute);
app.use("/api/notifications", notificationRoute);

// Create HTTP server so Socket.io can share the same port
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, credentials: true },
});

function waitOpen(conn) {
  return new Promise((resolve, reject) => {
    conn.on("error", reject);
    conn.once("open", () => resolve());
  });
}

async function start() {
  try {
    logger.info("Starting Cinephix server...");

    const moviesConn = mongoose.createConnection(MONGO_URI, { dbName: "cleaned_db" });
    const seriesConn = mongoose.createConnection(MONGO_URI, { dbName: "cleaned_db" });
    const mainConnectionPromise = mongoose.connect(MONGO_URI, { dbName: "cleaned_db" });

    await Promise.all([
      waitOpen(moviesConn),
      waitOpen(seriesConn),
      mainConnectionPromise,
    ]);
    logger.info("All database connections established successfully");

    const Movie = createMovieModel(moviesConn);
    const Series = createSeriesModel(seriesConn);
    app.use("/api/movies", await moviesRouteFactory(Movie));
    app.use("/api/series", await seriesRouteFactory(Series));

    createMovieModel(mongoose.connection);
    createSeriesModel(mongoose.connection);
    logger.info("Movie and Series models registered to default connection");

    // Drop the stale unique index on Conversation.participants that was
    // created before the schema was corrected. Safe to run every startup.
    try {
      await mongoose.connection.collection("conversations").dropIndex("participants_1");
      logger.info("Dropped stale unique index on conversations.participants");
    } catch {
      // Index doesn't exist — nothing to do
    }

    // Seed preset community groups (no-op if already seeded)
    await seedGroups();

    // Attach Socket.io chat handler
    setupChat(io);
    logger.info("Socket.io chat handler attached");

    app.use(errorHandler);

    app.get("/api/health", (req, res) => {
      const dbOk = mongoose.connection.readyState === 1;
      res.status(dbOk ? 200 : 503).json({
        success: dbOk,
        message: dbOk ? "API is healthy" : "Database unavailable",
        db: dbOk ? "connected" : "disconnected",
        timestamp: new Date().toISOString(),
      });
    });

    const server = httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info("Rate limiting: 100 requests per 15 minutes per IP");
    });

    const shutdown = async () => {
      logger.info("Shutting down gracefully...");
      server.close(async () => {
        await mongoose.disconnect();
        logger.info("All connections closed");
        process.exit(0);
      });
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (e) {
    logger.error(`Startup error: ${e.message}`);
    process.exit(1);
  }
}

start();
