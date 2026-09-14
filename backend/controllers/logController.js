import ActivityLog from "../models/ActivityLog.js";
import User from "../models/User.js";
import Rating from "../models/Rating.js";
import FavoriteEvent from "../models/FavoriteEvent.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { refreshUserCineGraph } from "../utils/cineGraph.js";

import mongoose from "mongoose";

export const getLogs = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const queryUserId = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;
  
  const logs = await ActivityLog.find({ userId: queryUserId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  console.log("Fetching logs for user:", userId, "Found count:", logs.length);
  
  sendSuccess(res, logs, 'Logs fetched successfully');
});

export const revertLogs = asyncHandler(async (req, res) => {
  const { logIds } = req.body;
  const userId = req.user.id;

  if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
    return sendError(res, 'logIds array is required', 400);
  }

  const logs = await ActivityLog.find({ _id: { $in: logIds }, userId, isReverted: false });
  if (logs.length === 0) {
    return sendError(res, 'No active logs found to revert', 404);
  }

  let needsCineGraphRecalc = false;
  const allWatchlistIdsToRemove = [];
  const allRatingIdsToRemove = [];

  for (const log of logs) {
    if (log.payload) {
      if (log.payload.addedWatchlistIds && log.payload.addedWatchlistIds.length > 0) {
        allWatchlistIdsToRemove.push(...log.payload.addedWatchlistIds);
        // CineGraph counts Watched List titles, so removing them changes it too.
        needsCineGraphRecalc = true;
      }
      if (log.payload.addedRatingIds && log.payload.addedRatingIds.length > 0) {
        allRatingIdsToRemove.push(...log.payload.addedRatingIds);
        needsCineGraphRecalc = true;
      }
    }
  }

  // Remove from watchlist
  if (allWatchlistIdsToRemove.length > 0) {
    await User.findByIdAndUpdate(userId, {
      $pull: {
        watchlist: { itemId: { $in: allWatchlistIdsToRemove } },
        toWatchList: { itemId: { $in: allWatchlistIdsToRemove } }
      }
    });
  }

  // Remove ratings
  if (allRatingIdsToRemove.length > 0) {
    await Rating.deleteMany({ _id: { $in: allRatingIdsToRemove }, user: userId });
  }

  // Recompute CineGraph if the Watched List or ratings were affected
  if (needsCineGraphRecalc) {
    await refreshUserCineGraph(userId);
  }

  // Mark as reverted
  await ActivityLog.updateMany({ _id: { $in: logs.map(l => l._id) } }, { isReverted: true });

  sendSuccess(res, null, 'Transactions reverted successfully');
});

export const resetData = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Clear watchlist, toWatchList, favorites, and CineGraph
  await User.findByIdAndUpdate(userId, {
    watchlist: [],
    toWatchList: [],
    favoriteMovies: [],
    favoriteSeries: [],
    movieCineGraph: new Map(),
    seriesCineGraph: new Map()
  });

  // Delete all ratings
  await Rating.deleteMany({ user: userId });

  // Delete all Activity Logs
  await ActivityLog.deleteMany({ userId });

  // favoriteMovies/favoriteSeries above are a plain array (no history of
  // their own), but FavoriteEvent is a separate append-only log powering
  // the network Activity feed's "favorited" event — needs its own explicit
  // cleanup or a stale "favorited X" event would keep showing in other
  // people's feeds for a favorite that's now gone.
  await FavoriteEvent.deleteMany({ user: userId });

  sendSuccess(res, null, 'All data reset successfully');
});
