import http from "http";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import { Server } from "socket.io";

import passport from "passport";
import { configurePassport } from "./config/passportConfig.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger, logger } from "./middleware/logger.js";
import { simpleRateLimiter, MAX_REQUESTS, AUTH_MAX_REQUESTS, RATE_LIMIT_WINDOW_MINUTES } from "./middleware/rateLimiter.js";
import { setupChat } from "./sockets/chatSocket.js";
import { seedGroups } from "./scripts/seedGroups.js";
import cron from "node-cron";
import { syncTMDBTrending } from "./services/tmdbSyncService.js";
import { postOfficialContent } from "./services/officialContentService.js";
import { checkWatchPartyReminders } from "./services/watchPartyReminders.js";
import { postWeeklyLeaderboardAnnouncements } from "./services/weeklyLeaderboardAnnouncer.js";

dotenv.config();
const app = express();
// Express 5 defaults to the "simple" query parser (Node's built-in
// querystring), which does NOT understand bracket-array syntax
// (?genres[]=Comedy&genres[]=Drama) — it parses "genres[]" as a literal key
// name, leaving req.query.genres undefined. axios's default array-param
// serialization always uses that bracket syntax (confirmed: even a single-
// element array becomes ?genres[]=Comedy), so any GET endpoint reading an
// array off req.query silently got an empty/undefined value for every array
// param sent by the mobile app — this is what broke CineMatch's genre
// filter on /match/sync/candidates. "extended" restores the old Express 4
// default (the qs package, already present in node_modules), which parses
// both bracket and repeated-key array syntax correctly.
app.set('query parser', 'extended');
app.use(helmet());

// FRONTEND_URL may list several origins, comma-separated. A browser's Origin
// never has a trailing slash or path, so those are trimmed off — a pasted
// "https://site.com/" would otherwise match nothing and block every request.
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((url) => url.trim().replace(/\/+$/, "")).filter(Boolean)
  : ["http://localhost:5173", "http://127.0.0.1:5173"];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(requestLogger);
configurePassport();
app.use(passport.initialize());
// Prevent browser caching for API responses
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

app.use("/api/", simpleRateLimiter);
// Blocked people disappear from every response (middleware/blockFilter.js).
app.use("/api/", hideBlockedContent);

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
import userToWatchListRoute from "./routes/userToWatchListRoute.js";
import customListRoute from "./routes/customListRoute.js";
import contentStatsRoute from "./routes/contentStatsRoute.js";
import feedRoute from "./routes/feedRoute.js";
import groupRoute from "./routes/groupRoute.js";
import conversationRoute from "./routes/conversationRoute.js";
import notificationRoute from "./routes/notificationRoute.js";
import shareRoute from "./routes/shareRoute.js";
import badgeRoute from "./routes/badgeRoute.js";
import waitlistRoute from "./routes/waitlistRoute.js";
import { hideBlockedContent } from "./middleware/blockFilter.js";
import reportRoute from "./routes/reportRoute.js";
import ticketRoute from "./routes/ticketRoute.js";
import adminRoute from "./routes/adminRoute.js";

const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 5000;

app.use("/api/users", userRoute);
app.use("/api/users/me", userWatchlistRoute);
app.use("/api/users/me", userToWatchListRoute);
app.use("/api/lists", customListRoute);
app.use("/api/content", contentStatsRoute);
app.use("/api/ratings", ratingRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/match", matchRoute);
app.use("/api/feed", feedRoute);
app.use("/api/groups", groupRoute);
app.use("/api/conversations", conversationRoute);
app.use("/api/notifications", notificationRoute);
app.use("/api/shares", shareRoute);
app.use("/api/badges", badgeRoute);
app.use("/api/waitlist", waitlistRoute);
app.use("/api/reports", reportRoute);
app.use("/api/tickets", ticketRoute);
app.use("/api/admin", adminRoute);

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

    // Schedule TMDB sync every day at 03:00
    cron.schedule("0 3 * * *", () => {
      logger.info("Running scheduled TMDB sync...");
      syncTMDBTrending().catch(err => logger.error(`TMDB sync error: ${err.message}`));
    });

    // Official Cinephix account auto-posting — two daily slots. Slot A
    // always posts trivia (the ~150-item rich pool laps in ~5 months at this
    // rate, spiced with occasional DB-native generated facts); slot B cycles
    // through the other 6 categories one per day, so each posts ~weekly.
    const OFFICIAL_SLOT_B_CYCLE = ["tip", "highlight", "on_this_day", "poll", "stats", "announcement"];
    cron.schedule("0 10 * * *", () => {
      logger.info("Posting official Cinephix content: trivia");
      postOfficialContent("trivia").catch(err => logger.error(`Official content (trivia) error: ${err.message}`));
    });
    cron.schedule("0 19 * * *", () => {
      const category = OFFICIAL_SLOT_B_CYCLE[new Date().getDay() % OFFICIAL_SLOT_B_CYCLE.length];
      logger.info(`Posting official Cinephix content: ${category}`);
      postOfficialContent(category).catch(err => logger.error(`Official content (${category}) error: ${err.message}`));
    });

    // Watch party reminders (30min/10min/started) — every minute, not
    // daily like the jobs above: a scheduled start time needs minute-level
    // precision, and this process may restart between any two ticks, so a
    // one-off per-party timer wouldn't survive that the way a periodic
    // check (idempotent via GroupWatchParty.remindersSent) does.
    cron.schedule("* * * * *", () => {
      checkWatchPartyReminders().catch(err => logger.error(`Watch party reminders error: ${err.message}`));
    });

    // Weekly leaderboard result announcements — fires just after each
    // community's own weekly reset boundary (Monday 00:00 UTC,
    // startOfCurrentWeekUTC), so "last week" is already fully closed by
    // the time this runs.
    cron.schedule("0 9 * * 1", () => {
      logger.info("Posting weekly leaderboard announcements...");
      postWeeklyLeaderboardAnnouncements().catch(err => logger.error(`Weekly leaderboard announcement error: ${err.message}`));
    });

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
      logger.info(`Rate limiting: ${MAX_REQUESTS} requests (${AUTH_MAX_REQUESTS} for auth endpoints) per ${RATE_LIMIT_WINDOW_MINUTES} minutes per IP`);
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
