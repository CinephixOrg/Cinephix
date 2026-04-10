import mongoose from "mongoose";
import User from "../models/User.js";
import Rating from "../models/Rating.js";

// New imports for consistent responses and error handling
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError, sendPaginated } from "../utils/response.js";

// NEW: Hybrid approach services
import { calculateFavoriteOverlap } from "../services/contentBasedService.js";
import { calculateSocialScore } from "../services/socialScoreService.js";
import { calculateDiversityScore, calculateWatchActivityScore } from "../services/diversityScoreService.js";
import { calculateTrendingAlignment, calculateActivityRecency } from "../services/bonusMetricsService.js";

/* ---------- yardımcı matematik ---------- */

const cosineSimilarity = (a, b) => {
  let dot = 0, normA = 0, normB = 0;
  for (const k in a) {
    dot += (a[k] || 0) * (b[k] || 0);
    normA += (a[k] || 0) ** 2;
    normB += (b[k] || 0) ** 2;
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
};

const avgRatingSimilarity = (a, b) => {
  let diff = 0, count = 0;
  for (const k in a) {
    if (b[k] !== undefined) {
      diff += Math.abs(a[k] - b[k]);
      count++;
    }
  }
  if (!count) return 0;
  return 1 - diff / (count * 10); // normalize
};

/* ---------- MAIN: HYBRID APPROACH ---------- */

/**
 * HYBRID MATCHING ALGORITHM
 * 
 * Bileşenler:
 * 1. COLLABORATIVE (35%): Genre/Rating benzerliği (MEVCUT)
 * 2. CONTENT-BASED (25%): Favori filmler benzerliği (YENİ)
 * 3. SOCIAL (20%): Ortak takip/takipçiler (YENİ)
 * 4. DIVERSITY (15%): Çeşitlilik uyumu (YENİ)
 * 5. BONUS (5%): Activity, trending, recency (YENİ)
 * 
 * Beklenen doğruluk: 60-70%
 */
export const findMatches = asyncHandler(async (req, res) => {
  const {
    type = "movie",       // movie | series
    genres = [],          // [] or ["Drama", "Action"]
    useCount = true,
    useAvgRating = true,
    page = 1,
    limit = 10,
    hybridMode = true    // Hybrid algorithm'i kullan?
  } = req.body;

  const meId = req.user.id;

  // Validation
  if (!type || !['movie', 'series'].includes(type)) {
    return sendError(res, 'Valid type (movie or series) is required', 400);
  }

  const cineKey = type === "movie" ? "movieCineGraph" : "seriesCineGraph";

  const me = await User.findById(meId).lean();
  if (!me || !me[cineKey]) {
    return sendSuccess(res, [], 'No matches found', 200);
  }

  const myGraph = me[cineKey];

  console.log(`[MATCH] Starting match calculation for user ${meId}, type: ${type}`);
  const startTime = Date.now();

  const others = await User.find({ _id: { $ne: meId } })
    .select(`username profile_pic_url ${cineKey} following followers favoriteMovies favoriteSeries`)
    .limit(1000)  // ⚡ OPTIMIZATION: Limit to 1000 users max
    .lean();

  console.log(`[MATCH] Loaded ${others.length} users in ${Date.now() - startTime}ms`);

  const results = [];

  for (const u of others) {
    if (!u[cineKey]) continue;

    try {
      let finalScore = 0;

      if (hybridMode) {
        // ===== HYBRID APPROACH =====

        // 1. COLLABORATIVE FILTERING (35%) - IN-MEMORY ONLY
        const g1 = {};
        const g2 = {};
        const r1 = {};
        const r2 = {};

        for (const [genre, v] of Object.entries(myGraph)) {
          if (genres.length && !genres.includes(genre)) continue;
          if (useCount) g1[genre] = v.count;
          if (useAvgRating) r1[genre] = v.avgRating;
        }

        for (const [genre, v] of Object.entries(u[cineKey])) {
          if (genres.length && !genres.includes(genre)) continue;
          if (useCount) g2[genre] = v.count;
          if (useAvgRating) r2[genre] = v.avgRating;
        }

        const genreScore = useCount ? cosineSimilarity(g1, g2) : 0;
        const ratingScore = useAvgRating ? avgRatingSimilarity(r1, r2) : 0;

        const collaborativeScore =
          (useCount ? 0.5 * genreScore : 0) +
          (useAvgRating ? 0.5 * ratingScore : 0);

        finalScore += 0.35 * collaborativeScore;

        // 2. CONTENT-BASED (25%) - IN-MEMORY ONLY
        const favorites1 = (type === "movie" ? me.favoriteMovies : me.favoriteSeries) || [];
        const favorites2 = (type === "movie" ? u.favoriteMovies : u.favoriteSeries) || [];
        let contentScore = 0;

        if (favorites1.length > 0 && favorites2.length > 0) {
          const set1 = new Set(favorites1.map((id) => id.toString()));
          const set2 = new Set(favorites2.map((id) => id.toString()));
          const intersection = [...set1].filter((x) => set2.has(x)).length;
          const union = new Set([...set1, ...set2]).size;
          contentScore = union === 0 ? 0 : intersection / union;
        }

        finalScore += 0.25 * contentScore;

        // 3. SOCIAL SCORE (20%) - IN-MEMORY ONLY
        const myFollowing = new Set((me.following || []).map((id) => id.toString()));
        const myFollowers = new Set((me.followers || []).map((id) => id.toString()));
        const uFollowing = new Set((u.following || []).map((id) => id.toString()));
        const uFollowers = new Set((u.followers || []).map((id) => id.toString()));

        // Mutual following
        const mutualFollowing = [...myFollowing].filter((x) => uFollowing.has(x)).length;
        const unionFollowing = new Set([...myFollowing, ...uFollowing]).size;
        const followingScore = unionFollowing === 0 ? 0 : mutualFollowing / unionFollowing;

        // Mutual followers
        const mutualFollowers = [...myFollowers].filter((x) => uFollowers.has(x)).length;
        const unionFollowers = new Set([...myFollowers, ...uFollowers]).size;
        const followersScore = unionFollowers === 0 ? 0 : mutualFollowers / unionFollowers;

        const socialScore = 0.4 * followingScore + 0.4 * followersScore;

        finalScore += 0.20 * socialScore;

        // 4. DIVERSITY SCORE (15%) - IN-MEMORY ONLY
        const myDiversity = calculateDiversityInMemory(me[cineKey]);
        const uDiversity = calculateDiversityInMemory(u[cineKey]);
        const diversityDiff = Math.abs(myDiversity - uDiversity);
        const diversityScore = 1 - Math.min(1, diversityDiff);

        finalScore += 0.15 * diversityScore;

        // 5. BONUS METRICS (5%) - NEUTRAL DEFAULT (no DB queries)
        const bonusScore = 0.5;  // Neutral score
        finalScore += 0.05 * bonusScore;

      } else {
        // ===== ORIGINAL APPROACH (fallback) =====
        const g1 = {};
        const g2 = {};
        const r1 = {};
        const r2 = {};

        for (const [genre, v] of Object.entries(myGraph)) {
          if (genres.length && !genres.includes(genre)) continue;
          if (useCount) g1[genre] = v.count;
          if (useAvgRating) r1[genre] = v.avgRating;
        }

        for (const [genre, v] of Object.entries(u[cineKey])) {
          if (genres.length && !genres.includes(genre)) continue;
          if (useCount) g2[genre] = v.count;
          if (useAvgRating) r2[genre] = v.avgRating;
        }

        const genreScore = useCount ? cosineSimilarity(g1, g2) : 0;
        const ratingScore = useAvgRating ? avgRatingSimilarity(r1, r2) : 0;

        finalScore =
          (useCount ? 0.4 * genreScore : 0) +
          (useAvgRating ? 0.4 * ratingScore : 0);
      }

      results.push({
        user: {
          _id: u._id,
          username: u.username,
          profile_pic_url: u.profile_pic_url,
        },
        matchPercentage: Math.round(finalScore * 100),
      });
    } catch (error) {
      console.error(`Error calculating match score for user ${u._id}:`, error);
      // Bu kullanıcıyı atla
      continue;
    }
  }

  results.sort((a, b) => b.matchPercentage - a.matchPercentage);
  
  // Apply pagination
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;
  const paginatedResults = results.slice(skip, skip + limitNum);
  const total = results.length;

  const totalDuration = Date.now() - startTime;
  console.log(`[MATCH] ✅ Completed in ${totalDuration}ms. Evaluated ${others.length} users, Total matches: ${total}, Returned: ${paginatedResults.length}`);

  sendPaginated(res, paginatedResults, total, pageNum, limitNum, 'Hybrid Matches found');
});

/**
 * In-memory diversity calculation
 * Nasıl değişken genre dağılımı o kadar çeşitli
 */
const calculateDiversityInMemory = (cineGraph) => {
  if (!cineGraph || Object.keys(cineGraph).length === 0) return 0.5;

  const counts = Object.values(cineGraph).map((g) => g.count || 0);
  const total = counts.reduce((a, b) => a + b, 0);

  if (total === 0) return 0.5;

  // Basit metric: watch dağılımı ne kadar spread
  const avgCount = total / counts.length;
  const variance = counts.reduce((sum, c) => sum + Math.pow(c - avgCount, 2), 0) / counts.length;
  const stdDev = Math.sqrt(variance);

  // Normalize: 0 = hepsi aynı, 1 = çok çeşitli
  const maxPossibleStdDev = total / Math.sqrt(counts.length);
  return Math.min(1, stdDev / (maxPossibleStdDev || 1));
};
