import mongoose from "mongoose";
import User from "../models/User.js";
import Rating from "../models/Rating.js";
import MatchDecision from "../models/MatchDecision.js";
import Notification from "../models/Notification.js";
import FollowRequest from "../models/FollowRequest.js";

// New imports for consistent responses and error handling
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError, sendPaginated } from "../utils/response.js";

// NEW: Hybrid approach services
import { calculateFavoriteOverlap } from "../services/contentBasedService.js";
import { calculateSocialScore } from "../services/socialScoreService.js";
import { calculateDiversityScore, calculateWatchActivityScore } from "../services/diversityScoreService.js";
import { calculateTrendingAlignment, calculateActivityRecency } from "../services/bonusMetricsService.js";
import { formatForLLM } from "../services/llmFormatterService.js";
import { sanitizeForLLM } from "../services/llmSanitizerService.js";
import { callLLM } from "../services/llmAdapter.js";
import { getTierLimits, REJECT_COOLDOWN_DAYS, DEFAULT_MATCH_FILTERS } from "../config/tiers.js";

// Mirrors mobile's supported UI languages (mobile/src/locales/index.ts) — the
// analyze-match LLM response should come back in whatever language the
// requesting user's app is set to, not a hardcoded one.
const SUPPORTED_LANGUAGES = {
  en: 'English', tr: 'Turkish', ru: 'Russian', ja: 'Japanese', zh: 'Chinese',
  fr: 'French', ko: 'Korean', ar: 'Arabic', it: 'Italian', es: 'Spanish',
  de: 'German', pt: 'Portuguese',
};

/* ---------- helper math ---------- */


const pearsonCorrelation = (ratings1, ratings2) => {
  const commonKeys = Object.keys(ratings1).filter(k => ratings2[k] !== undefined);
  const n = commonKeys.length;
  if (n < 3) return null; // Need at least 3 co-rated items

  let sum1 = 0, sum2 = 0, sum1Sq = 0, sum2Sq = 0, pSum = 0;
  for (const k of commonKeys) {
    const r1 = ratings1[k];
    const r2 = ratings2[k];
    sum1 += r1;
    sum2 += r2;
    sum1Sq += r1 * r1;
    sum2Sq += r2 * r2;
    pSum += r1 * r2;
  }

  const num = pSum - (sum1 * sum2 / n);
  const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));
  if (den === 0) return 0;
  return num / den;
};

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

const getTopSharedGenre = (payload = {}) => {
  const commonGenres = payload?.shared_genres?.common_genres || [];
  const sharedGenre = commonGenres.find((item) => item && (item.me_count > 0 || item.target_count > 0));
  return sharedGenre?.genre || payload?.shared_genres?.top_shared_genre?.genre || null;
};

// Localized copy for buildCanonicalAnalysis, the deterministic fallback used
// whenever the LLM's output is missing/invalid — mirrors llmAdapter.js's
// MOCK_STRINGS pattern. Only 'en'/'tr' are hand-written (tr was the original
// hardcoded copy before this became language-aware); any other requested
// language falls back to English rather than guessing at an unreviewed
// machine translation.
const CANONICAL_STRINGS = {
  en: {
    topGenre: (g) => `Your strongest shared interest seems to be ${g}.`,
    noTopGenre: 'You have some notable shared interests.',
    favoriteOverlap: (n) => `You have ${n} favorite titles in common, which is a great conversation starter.`,
    noFavoriteOverlap: 'Your shared favorites are limited, but there are still points worth exploring.',
    socialOverlap: 'The overlap in your social circles can also help things feel more natural.',
    noSocialOverlap: 'Social circle overlap is limited, but you can still build a warm connection through shared interests.',
    summary: (score) => `Overall, there's promising compatibility between you (${score}%).`,
    strengthGenre: (g) => `Strong shared taste in ${g}`,
    strengthGenreGeneric: 'Strong shared interests',
    strengthFavorites: 'Similar favorite content',
    strengthContentAlignment: 'Alignment in content taste',
    strengthSocial: 'Overlap in social circle',
    strengthConversationGround: 'Common ground to build the conversation on',
    weaknessGenre: 'Some differences in genre preferences',
    weaknessFavorites: 'Low number of shared favorites',
    weaknessSocial: 'Limited social circle overlap',
    starterFavorite: 'Ask what they thought of a shared favorite',
    starterGenre: (g) => `Ask about their favorite ${g} pick`,
    starterSocial: 'Break the ice through mutual connections',
    starterGeneral: "Ask what they've been watching lately",
    couldNotGenerate: 'Compatibility analysis could not be generated.',
  },
  tr: {
    topGenre: (g) => `Senin için en güçlü ortak nokta ${g} türü gibi görünüyor.`,
    noTopGenre: 'Senin için dikkat çekici ortak ilgi alanları var.',
    favoriteOverlap: (n) => `${n} ortak favori içeriğiniz var; bu sohbeti başlatmak için güzel bir fırsat.`,
    noFavoriteOverlap: 'Ortak favori içerik sayınız sınırlı ama konuşmayı başlatacak noktalar yine de var.',
    socialOverlap: 'Sosyal ağdaki kesişim de iletişimi daha doğal hale getirebilir.',
    noSocialOverlap: 'Sosyal ağ kesişimi sınırlı olsa da, ilgi alanlarınız üzerinden sıcak bir bağ kurulabilir.',
    summary: (score) => `Genel olarak umut veren bir uyum görünüyor (%${score}).`,
    strengthGenre: (g) => `${g} türünde güçlü ortak zevk`,
    strengthGenreGeneric: 'Güçlü ortak ilgi alanları',
    strengthFavorites: 'Ortak favori içerik benzerliği',
    strengthContentAlignment: 'İçerik zevklerinde uyum',
    strengthSocial: 'Sosyal çevrede kesişim',
    strengthConversationGround: 'Sohbeti geliştirecek ortak noktalar',
    weaknessGenre: 'Bazı tür tercihlerinde farklılıklar var',
    weaknessFavorites: 'Ortak favori içerik sayısı düşük',
    weaknessSocial: 'Sosyal çevre kesişimi sınırlı',
    starterFavorite: 'Ortak favori içeriğiniz hakkında ne düşündüğünü sor',
    starterGenre: (g) => `${g} türünde en sevdiği yapımı sor`,
    starterSocial: 'Ortak bağlantılardan sohbeti aç',
    starterGeneral: 'Bu aralar hangi tür yapımları izlediğini sor',
    couldNotGenerate: 'Uyumluluk analizi üretilemedi.',
  },
};

const getCanonicalStrings = (language) => CANONICAL_STRINGS[language] || CANONICAL_STRINGS.en;

const buildCanonicalAnalysis = (payload = {}, language = 'en') => {
  const strings = getCanonicalStrings(language);
  const topGenre = getTopSharedGenre(payload);
  const favoriteOverlap = Number(payload?.favorites_overlap?.intersection_count || 0);
  const mutualFollowing = Number(payload?.social_overlap?.mutualFollowing ?? payload?.social_overlap?.mutual_following ?? 0);
  const mutualFollowers = Number(payload?.social_overlap?.mutualFollowers ?? payload?.social_overlap?.mutual_followers ?? 0);
  const socialOverlapCount = Math.max(mutualFollowing, mutualFollowers);
  const finalScore = Number(payload?.match?.final_score || 0);

  const analysis = [
    topGenre ? strings.topGenre(topGenre) : strings.noTopGenre,
    favoriteOverlap > 0 ? strings.favoriteOverlap(favoriteOverlap) : strings.noFavoriteOverlap,
    socialOverlapCount > 0 ? strings.socialOverlap : strings.noSocialOverlap,
    strings.summary(finalScore),
  ].join(' ');

  const strengths = [
    topGenre ? strings.strengthGenre(topGenre) : strings.strengthGenreGeneric,
    favoriteOverlap > 0 ? strings.strengthFavorites : strings.strengthContentAlignment,
    socialOverlapCount > 0 ? strings.strengthSocial : strings.strengthConversationGround,
  ];

  const weaknesses = [];
  if (!topGenre) weaknesses.push(strings.weaknessGenre);
  if (favoriteOverlap === 0) weaknesses.push(strings.weaknessFavorites);
  if (socialOverlapCount === 0) weaknesses.push(strings.weaknessSocial);
  if (weaknesses.length === 0) weaknesses.push(strings.weaknessGenre);

  const conversation_starters = [];
  if (favoriteOverlap > 0) conversation_starters.push(strings.starterFavorite);
  if (topGenre) conversation_starters.push(strings.starterGenre(topGenre));
  if (socialOverlapCount > 0) conversation_starters.push(strings.starterSocial);
  if (conversation_starters.length === 0) {
    conversation_starters.push(strings.starterGeneral);
  }

  const graphValues = payload?.match?.graphData?.values;
  const graphLabels = payload?.match?.graphData?.labels;
  const graph_ascii = Array.isArray(graphValues) && Array.isArray(graphLabels)
    ? graphLabels.map((label, index) => `${label}: ${'█'.repeat(Math.max(1, Math.round((graphValues[index] || 0) / 10)))} (${graphValues[index] || 0})`).join(' | ')
    : '';

  return { analysis, strengths, weaknesses, conversation_starters, graph_ascii };
};

const extractJsonFromLLMText = (text) => {
  if (!text || typeof text !== "string") return null;

  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // continue
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    // continue
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  return null;
};

const normalizeLLMAnalysis = (obj, payload = {}, fallbackText = "", language = 'en') => {
  const canonical = buildCanonicalAnalysis(payload, language);
  const strings = getCanonicalStrings(language);
  const source = obj?.compatibility_analysis
    ? {
        ...obj.compatibility_analysis,
        graph_ascii: obj.graph_ascii || obj.compatibility_analysis.graph_ascii,
      }
    : (obj || {});

  let analysis = source.analysis || fallbackText || canonical.analysis || strings.couldNotGenerate;
  const strengths = Array.isArray(source.strengths) && source.strengths.length ? source.strengths : canonical.strengths;
  const weaknesses = Array.isArray(source.weaknesses) && source.weaknesses.length ? source.weaknesses : canonical.weaknesses;
  const conversation_starters = Array.isArray(source.conversation_starters) && source.conversation_starters.length
    ? source.conversation_starters
    : canonical.conversation_starters;

  let graph_ascii = source.graph_ascii || "";
  if (Array.isArray(graph_ascii)) {
    graph_ascii = graph_ascii.join("\n");
  }

  if (!graph_ascii) {
    graph_ascii = canonical.graph_ascii;
  }

  analysis = String(analysis)
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[-*]\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  if (/json|payload|concise explanation|provided json|technical/i.test(analysis)) {
    analysis = canonical.analysis;
  }

  // Guards against a known leaked-boilerplate pattern from the original
  // Turkish-only prompt — only meaningful when replying in Turkish, since
  // these exact words would never appear in another language's output.
  if (language === 'tr' && /bu iki kullanıcı|kullanıcılar|bu analize göre|belirgin ortaklık|genel ortaklık|zayıflıklar|güçler|konuşma başlatıcıları/i.test(analysis)) {
    analysis = canonical.analysis;
  }

  // A very long response is usually the model ignoring the "2-3 short
  // sentences" instruction, not a translation issue — this threshold isn't
  // language-specific, so it must not be the sole trigger for falling back
  // (that would previously replace a perfectly good, correctly-localized
  // analysis with the hardcoded Turkish canonical copy for every language).
  if (analysis.length > 400) {
    analysis = canonical.analysis;
  }

  return {
    analysis,
    strengths,
    weaknesses,
    conversation_starters,
    graph_ascii,
  };
};

/* ---------- MAIN: HYBRID APPROACH ---------- */

/**
 * HYBRID MATCHING ALGORITHM
 * 
 * Components:
 * 1. COLLABORATIVE (35%): Genre/Rating similarity (CURRENT)
 * 2. CONTENT-BASED (25%): Favorite movies similarity (NEW)
 * 3. SOCIAL (20%): Mutual following/followers (NEW)
 * 4. DIVERSITY (15%): Diversity alignment (NEW)
 * 5. BONUS (5%): Activity, trending, recency (NEW)
 * 
 * Expected accuracy: 60-70%
 */
// Extracted from findMatches's hybrid-mode branch so the new swipe queue
// (getSwipeQueue, below) can reuse the exact same scoring instead of yet a
// third slightly-different copy — findMatches and getMatchWithUser already
// disagree on weights (see CINEMATCH_ANALYZE_AND_SWIPE_REPORTS.md). Body is
// unchanged from the original inline block, just parameterized.
const scoreHybridCandidate = (me, u, cineKey, myGraph, filters, myRatingMap, targetRatingsMap) => {
  const { type, genres, useCount, useAvgRating } = filters;
  let finalScore = 0;

  const g1 = {};
  const g2 = {};
  const r1 = {};
  const r2 = {};

  for (const [genre, v] of Object.entries(myGraph)) {
    if (genres.length && !genres.includes(genre)) continue;
    if (useCount) g1[genre] = v.count;
    if (useAvgRating && v.ratedCount > 0) r1[genre] = v.avgRating;
  }

  for (const [genre, v] of Object.entries(u[cineKey])) {
    if (genres.length && !genres.includes(genre)) continue;
    if (useCount) g2[genre] = v.count;
    if (useAvgRating && v.ratedCount > 0) r2[genre] = v.avgRating;
  }

  const genreScore = useCount ? cosineSimilarity(g1, g2) : 0;
  const fallbackRatingScore = useAvgRating ? avgRatingSimilarity(r1, r2) : 0;

  let weightCF = 0.35;
  let weightGenre = 0.15;

  if (!useAvgRating) {
    weightGenre += weightCF;
    weightCF = 0;
  } else if (!useCount) {
    weightCF += weightGenre;
    weightGenre = 0;
  }

  // 1. TRUE COLLABORATIVE FILTERING (Pearson)
  if (useAvgRating) {
    const uRatings = targetRatingsMap[u._id.toString()] || {};
    const pearsonVal = pearsonCorrelation(myRatingMap, uRatings);

    let pearsonScore = 0;
    if (pearsonVal !== null) {
      pearsonScore = (pearsonVal + 1) / 2;
      finalScore += weightCF * pearsonScore;
    } else {
      finalScore += weightCF * fallbackRatingScore;
    }
  }

  // 2. GENRE AFFINITY PROFILE
  if (useCount) {
    finalScore += weightGenre * genreScore;
  }

  // 3. CONTENT OVERLAP (Jaccard on Watchlist + Favorites) - 20%
  const myWatchlist = (me.watchlist || []).filter(w => w.itemType === type).map(w => w.itemId.toString());
  const uWatchlist = (u.watchlist || []).filter(w => w.itemType === type).map(w => w.itemId.toString());

  const myFavs = ((type === "movie" ? me.favoriteMovies : me.favoriteSeries) || []).map(id => id.toString());
  const uFavs = ((type === "movie" ? u.favoriteMovies : u.favoriteSeries) || []).map(id => id.toString());

  // We weigh favorites as 3 standard items to increase their impact
  let intersectionCount = 0;
  let unionCount = 0;
  const uWatchlistSet = new Set(uWatchlist);
  const uFavsSet = new Set(uFavs);

  const myTotalSet = new Set([...myWatchlist, ...myFavs]);
  const uTotalSet = new Set([...uWatchlist, ...uFavs]);

  for (const item of myTotalSet) {
    const isMyFav = myFavs.includes(item);
    const isUFav = uFavsSet.has(item);
    const isMyWl = myWatchlist.includes(item);
    const isUWl = uWatchlistSet.has(item);

    const weight = (isMyFav && isUFav) ? 3 : 1;

    if ((isMyWl || isMyFav) && (isUWl || isUFav)) {
      intersectionCount += weight;
      unionCount += weight;
    } else {
      unionCount += isMyFav ? 3 : 1; // If only one has it, just add normal weight for union
    }
  }

  // Add target's non-overlapping items to union
  for (const item of uTotalSet) {
    if (!myTotalSet.has(item)) {
      unionCount += uFavsSet.has(item) ? 3 : 1;
    }
  }

  const contentScore = unionCount === 0 ? 0 : intersectionCount / unionCount;
  finalScore += 0.20 * contentScore;

  // 4. SOCIAL SCORE (15%)
  const myFollowing = new Set((me.following || []).map((id) => id.toString()));
  const myFollowers = new Set((me.followers || []).map((id) => id.toString()));
  const uFollowing = new Set((u.following || []).map((id) => id.toString()));
  const uFollowers = new Set((u.followers || []).map((id) => id.toString()));

  const mutualFollowing = [...myFollowing].filter((x) => uFollowing.has(x)).length;
  const unionFollowing = new Set([...myFollowing, ...uFollowing]).size;
  const followingScore = unionFollowing === 0 ? 0 : mutualFollowing / unionFollowing;

  const mutualFollowers = [...myFollowers].filter((x) => uFollowers.has(x)).length;
  const unionFollowers = new Set([...myFollowers, ...uFollowers]).size;
  const followersScore = unionFollowers === 0 ? 0 : mutualFollowers / unionFollowers;

  const socialScore = 0.5 * followingScore + 0.5 * followersScore;
  finalScore += 0.15 * socialScore;

  // 5. DIVERSITY SCORE (15%)
  const myDiversity = calculateDiversityInMemory(me[cineKey]);
  const uDiversity = calculateDiversityInMemory(u[cineKey]);
  const diversityDiff = Math.abs(myDiversity - uDiversity);
  const diversityScore = 1 - Math.min(1, diversityDiff);

  finalScore += 0.15 * diversityScore;

  return finalScore;
};

export const findMatches = asyncHandler(async (req, res) => {
  const {
    type = "movie",       // movie | series
    genres = [],          // [] or ["Drama", "Action"]
    useCount = true,
    useAvgRating = true,
    page = 1,
    limit = 10,
    hybridMode = true    // Use hybrid algorithm?
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

  // ⚡ FETCH OPTIMIZATION FOR PEARSON CORRELATION
  const myRatings = await Rating.find({ user: meId, contentType: type }).lean();
  const myRatingMap = {};
  myRatings.forEach(r => myRatingMap[r.contentId.toString()] = r.value);
  const myRatedIds = Object.keys(myRatingMap);

  const others = await User.find({ _id: { $ne: meId } })
    .select(`username profile_pic_url ${cineKey} following followers favoriteMovies favoriteSeries watchlist`)
    .limit(1000)
    .lean();

  const otherIds = others.map(u => u._id);
  const relevantRatings = await Rating.find({ 
    user: { $in: otherIds }, 
    contentType: type, 
    contentId: { $in: myRatedIds } 
  }).lean();

  const targetRatingsMap = {};
  relevantRatings.forEach(r => {
    const uId = r.user.toString();
    if (!targetRatingsMap[uId]) targetRatingsMap[uId] = {};
    targetRatingsMap[uId][r.contentId.toString()] = r.value;
  });

  const results = [];

  for (const u of others) {
    if (!u[cineKey]) continue;

    try {
      let finalScore = 0;

      if (hybridMode) {
        finalScore = scoreHybridCandidate(
          me,
          u,
          cineKey,
          myGraph,
          { type, genres, useCount, useAvgRating },
          myRatingMap,
          targetRatingsMap
        );
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
      continue;
    }
  }

  results.sort((a, b) => b.matchPercentage - a.matchPercentage);

  const { maxMatches } = getTierLimits(req.user.accountTier);
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 10, maxMatches);
  const skip = (pageNum - 1) * limitNum;
  const cappedResults = results.slice(0, maxMatches);
  const paginatedResults = cappedResults.slice(skip, skip + limitNum);
  const total = Math.min(results.length, maxMatches);
  const tierCapped = results.length > maxMatches;

  sendPaginated(res, paginatedResults, total, pageNum, limitNum, 'Hybrid Matches found', { tierCapped, maxMatches });
});

/* ========== SWIPE (CineMatch swipe-to-follow) ========== */

// Calendar-day boundary in UTC — the app doesn't collect per-user timezone
// anywhere else, so this mirrors that rather than inventing new plumbing.
// Shared by getSwipeQueue (to surface the count before the user swipes at
// all) and swipeMatch (to actually enforce the limit).
const getSwipesUsedToday = async (userId) => {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const count = await MatchDecision.countDocuments({ user: userId, createdAt: { $gte: startOfToday } });
  return { count, startOfToday };
};

/**
 * GET /api/match/swipe/queue
 * Ranked batch of candidates the user hasn't decided on yet (accepted people
 * never resurface; rejected people come back after REJECT_COOLDOWN_DAYS).
 * Free/any tier without canUseMatchFilters always gets DEFAULT_MATCH_FILTERS,
 * enforced here — not just hidden client-side — so a tampered request can't
 * bypass the Pro/Premium-only filter UI. Also returns the tier's daily swipe
 * allowance and how much of it is already used, so the client can show
 * "X of Y swipes left today" before the user starts swiping, not only after
 * hitting the limit.
 */
export const getSwipeQueue = asyncHandler(async (req, res) => {
  const meId = req.user.id;
  const { canUseMatchFilters, maxMatches, swipesPerDay } = getTierLimits(req.user.accountTier);
  const { count: swipesUsedToday } = await getSwipesUsedToday(meId);

  const requested = canUseMatchFilters
    ? {
        type: ["movie", "series"].includes(req.query.type) ? req.query.type : DEFAULT_MATCH_FILTERS.type,
        genres: Array.isArray(req.query.genres) ? req.query.genres : (req.query.genres ? [req.query.genres] : []),
        useCount: req.query.useCount !== "false",
        useAvgRating: req.query.useAvgRating !== "false",
      }
    : { ...DEFAULT_MATCH_FILTERS };

  const { type, genres, useCount, useAvgRating } = requested;
  const cineKey = type === "movie" ? "movieCineGraph" : "seriesCineGraph";

  const me = await User.findById(meId).lean();
  if (!me || !me[cineKey]) {
    return sendSuccess(res, { candidates: [], swipesPerDay, swipesUsedToday }, "No candidates found");
  }

  const others = await User.find({ _id: { $ne: meId } })
    .select(`username profile_pic_url bio ${cineKey} following followers favoriteMovies favoriteSeries watchlist`)
    .limit(1000)
    .lean();

  const cooldownCutoff = new Date(Date.now() - REJECT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  const latestDecisions = await MatchDecision.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(meId), contentType: type } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$targetUser", decision: { $first: "$decision" }, createdAt: { $first: "$createdAt" } } },
  ]);

  const excludedIds = new Set(
    latestDecisions
      .filter((d) => d.decision === "accept" || (d.decision === "reject" && d.createdAt > cooldownCutoff))
      .map((d) => d._id.toString())
  );

  const results = [];
  for (const u of others) {
    if (!u[cineKey]) continue;
    if (excludedIds.has(u._id.toString())) continue;

    try {
      // Same helper getMatchWithUser/analyzeMatchWithUser use (see
      // computeMatchBreakdown's doc comment) — previously this called
      // scoreHybridCandidate instead, a third formula whose dominant 35%
      // weight (Pearson rating correlation) was computed over ALL of a
      // user's ratings regardless of the genre filter, only its minor 15%
      // "genre affinity" term actually respected it. That's why filtering
      // to one genre barely moved the swipe-card percentage while the same
      // filter on a profile page (already on computeMatchBreakdown, whose
      // full collaborative term is genre-filtered) visibly did.
      const { matchPercentage } = computeMatchBreakdown(me, u, cineKey, { type, genres, useCount, useAvgRating });
      results.push({
        user: {
          _id: u._id,
          username: u.username,
          profile_pic_url: u.profile_pic_url,
          bio: u.bio,
        },
        contentType: type,
        matchPercentage,
      });
    } catch {
      continue;
    }
  }

  results.sort((a, b) => b.matchPercentage - a.matchPercentage);

  return sendSuccess(
    res,
    { candidates: results.slice(0, maxMatches), swipesPerDay, swipesUsedToday },
    "Swipe queue fetched"
  );
});

/**
 * POST /api/match/swipe
 * Records an accept/reject decision. Accept reuses the exact follow logic
 * from userController.followUser (public → follow directly, private → follow
 * request) so swipe-accept behaves identically to the regular Follow button.
 */
export const swipeMatch = asyncHandler(async (req, res) => {
  const meId = req.user.id;
  const { targetUserId, contentType = "movie", decision, matchPercentage = 0 } = req.body;

  if (!targetUserId) return sendError(res, "targetUserId is required", 400);
  if (!["movie", "series"].includes(contentType)) return sendError(res, "Invalid contentType", 400);
  if (!["accept", "reject"].includes(decision)) return sendError(res, "Invalid decision", 400);
  if (meId === targetUserId) return sendError(res, "Cannot swipe on yourself", 400);

  const target = await User.findById(targetUserId);
  if (!target) return sendError(res, "User not found", 404);

  const { swipesPerDay } = getTierLimits(req.user.accountTier);
  const { count: swipesToday, startOfToday } = await getSwipesUsedToday(meId);

  if (swipesToday >= swipesPerDay) {
    return sendError(res, "Daily swipe limit reached", 429, {
      swipesPerDay,
      resetAt: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000),
    });
  }

  await MatchDecision.create({
    user: meId,
    targetUser: targetUserId,
    contentType,
    decision,
    matchPercentage: Math.max(0, Math.min(100, Math.round(Number(matchPercentage) || 0))),
  });

  let followType = null;
  if (decision === "accept") {
    if (req.user.following.includes(targetUserId)) {
      followType = "following";
    } else {
      const visibility = target.visibility || "public";
      if (visibility === "private") {
        const existingReq = await FollowRequest.findOne({ requesterId: meId, targetId: targetUserId });
        if (!existingReq) {
          await FollowRequest.create({ requesterId: meId, targetId: targetUserId, status: "pending" });
          await Notification.create({ user: targetUserId, sender: meId, type: "follow_request", read: false });
        }
        followType = "requested";
      } else {
        await User.updateOne({ _id: meId }, { $addToSet: { following: targetUserId } });
        await User.updateOne({ _id: targetUserId }, { $addToSet: { followers: meId } });
        await Notification.create({ user: targetUserId, sender: meId, type: "follow" });
        followType = "following";
      }
    }
  }

  return sendSuccess(
    res,
    { decision, followType, swipesRemainingToday: Math.max(0, swipesPerDay - swipesToday - 1) },
    "Swipe recorded"
  );
});

/**
 * GET /api/match/swipe/rejected
 * Pro/Premium/Dev only — currently-rejected (still within cooldown)
 * candidates, so they can reconsider a decision.
 */
export const getRejectedMatches = asyncHandler(async (req, res) => {
  const meId = req.user.id;
  const { canViewRejectedMatches } = getTierLimits(req.user.accountTier);
  if (!canViewRejectedMatches) {
    return sendSuccess(res, [], "Viewing rejected matches is not available on your plan");
  }

  const cooldownCutoff = new Date(Date.now() - REJECT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  const latestDecisions = await MatchDecision.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(meId) } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: { targetUser: "$targetUser", contentType: "$contentType" },
        decision: { $first: "$decision" },
        createdAt: { $first: "$createdAt" },
        matchPercentage: { $first: "$matchPercentage" },
      },
    },
    { $match: { decision: "reject", createdAt: { $gt: cooldownCutoff } } },
    { $sort: { createdAt: -1 } },
    { $limit: 50 },
  ]);

  const targetIds = latestDecisions.map((d) => d._id.targetUser);
  const users = await User.find({ _id: { $in: targetIds } })
    .select("username profile_pic_url bio")
    .lean();
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  const result = latestDecisions
    .map((d) => {
      const user = userMap.get(d._id.targetUser.toString());
      if (!user) return null;
      return {
        user,
        contentType: d._id.contentType,
        matchPercentage: d.matchPercentage,
        rejectedAt: d.createdAt,
      };
    })
    .filter(Boolean);

  return sendSuccess(res, result, "Rejected matches fetched");
});

/**
 * In-memory diversity calculation
 * How variable the genre distribution determines diversity
 */
const calculateDiversityInMemory = (cineGraph) => {
  if (!cineGraph || Object.keys(cineGraph).length === 0) return 0.5;

  const counts = Object.values(cineGraph).map((g) => g.count || 0);
  const total = counts.reduce((a, b) => a + b, 0);

  if (total === 0) return 0.5;

  // Simple metric: how spread out the watch distribution is
  const avgCount = total / counts.length;
  const variance = counts.reduce((sum, c) => sum + Math.pow(c - avgCount, 2), 0) / counts.length;
  const stdDev = Math.sqrt(variance);

  // Normalize: 0 = all same, 1 = very diverse
  const maxPossibleStdDev = total / Math.sqrt(counts.length);
  return Math.min(1, stdDev / (maxPossibleStdDev || 1));
};

/**
 * Full weighted match score + per-dimension breakdown between two specific
 * users — shared by getMatchWithUser (the score shown on a profile) and
 * analyzeMatchWithUser (the LLM narrative). Previously each endpoint had its
 * own copy, and analyzeMatchWithUser's was a simplified stand-in (no Pearson
 * correlation, social/diversity/bonus hardcoded to 50) — so the "match
 * score" a user saw and the score referenced inside their Analyze result
 * could disagree. Single source of truth now; both endpoints get the same
 * number for the same pair of users and filters.
 */
const computeMatchBreakdown = (me, target, cineKey, { type, genres = [], useCount = true, useAvgRating = true }) => {
  const myGraph = me[cineKey];
  const targetGraph = target[cineKey];

  const g1 = {};
  const g2 = {};
  const r1 = {};
  const r2 = {};

  for (const [genre, v] of Object.entries(myGraph)) {
    if (genres.length && !genres.includes(genre)) continue;
    if (useCount) g1[genre] = v.count;
    if (useAvgRating) r1[genre] = v.avgRating;
  }
  for (const [genre, v] of Object.entries(targetGraph)) {
    if (genres.length && !genres.includes(genre)) continue;
    if (useCount) g2[genre] = v.count;
    if (useAvgRating) r2[genre] = v.avgRating;
  }

  const genreScore = cosineSimilarity(g1, g2);
  const ratingScore = avgRatingSimilarity(r1, r2);
  const collaborativeScore = 0.5 * genreScore + 0.5 * ratingScore;

  const favorites1 = (type === "movie" ? me.favoriteMovies : me.favoriteSeries) || [];
  const favorites2 = (type === "movie" ? target.favoriteMovies : target.favoriteSeries) || [];
  let contentScore = 0;
  if (favorites1.length > 0 && favorites2.length > 0) {
    const set1 = new Set(favorites1.map((id) => id.toString()));
    const set2 = new Set(favorites2.map((id) => id.toString()));
    const intersection = [...set1].filter((x) => set2.has(x)).length;
    const union = new Set([...set1, ...set2]).size;
    contentScore = union === 0 ? 0 : intersection / union;
  }

  const myFollowing = new Set((me.following || []).map((id) => id.toString()));
  const myFollowers = new Set((me.followers || []).map((id) => id.toString()));
  const targetFollowing = new Set((target.following || []).map((id) => id.toString()));
  const targetFollowers = new Set((target.followers || []).map((id) => id.toString()));

  const mutualFollowing = [...myFollowing].filter((x) => targetFollowing.has(x)).length;
  const unionFollowing = new Set([...myFollowing, ...targetFollowing]).size;
  const followingOverlapRate = unionFollowing === 0 ? 0 : mutualFollowing / unionFollowing;

  const mutualFollowers = [...myFollowers].filter((x) => targetFollowers.has(x)).length;
  const unionFollowers = new Set([...myFollowers, ...targetFollowers]).size;
  const followersOverlapRate = unionFollowers === 0 ? 0 : mutualFollowers / unionFollowers;

  const socialScore = 0.4 * followingOverlapRate + 0.4 * followersOverlapRate;

  const myDiversity = calculateDiversityInMemory(myGraph);
  const targetDiversity = calculateDiversityInMemory(targetGraph);
  const diversityDiff = Math.abs(myDiversity - targetDiversity);
  const diversityScore = 1 - Math.min(1, diversityDiff);

  // Not a real computed signal yet (see CINEMATCH_ANALYZE_AND_SWIPE_REPORTS.md) —
  // kept as a flat placeholder, but the same one in both endpoints now.
  const bonusScore = 0.5;

  const finalScore =
    0.35 * collaborativeScore +
    0.25 * contentScore +
    0.2 * socialScore +
    0.15 * diversityScore +
    0.05 * bonusScore;

  return {
    matchPercentage: Math.round(finalScore * 100),
    breakdown: {
      collaborative: Math.round(collaborativeScore * 100),
      contentBased: Math.round(contentScore * 100),
      social: Math.round(socialScore * 100),
      diversity: Math.round(diversityScore * 100),
      bonus: Math.round(bonusScore * 100),
    },
    favorites1,
    favorites2,
    socialOverlap: {
      mutualFollowing,
      mutualFollowers,
      followingOverlapRate: Math.round(followingOverlapRate * 100),
      followersOverlapRate: Math.round(followersOverlapRate * 100),
    },
  };
};

/* ========== NEW ENDPOINT: Calculate match with single user ========== */

/**
 * POST /api/match/user/:targetUserId
 * Calculate compatibility with a specific user
 */
export const getMatchWithUser = asyncHandler(async (req, res) => {
  const meId = req.user.id;
  const { targetUserId } = req.params;
  const { 
    type = "movie",
    genres = [],
    useCount = true,
    useAvgRating = true
  } = req.body;

  if (!targetUserId) {
    return sendError(res, 'Target user ID is required', 400);
  }

  if (meId === targetUserId) {
    return sendError(res, 'Cannot match with yourself', 400);
  }

  const cineKey = type === "movie" ? "movieCineGraph" : "seriesCineGraph";

  // Get my data
  const me = await User.findById(meId).lean();
  if (!me || !me[cineKey]) {
    return sendError(res, 'Your CineGraph data not found', 400);
  }

  // Get target user data
  const target = await User.findById(targetUserId)
    .select(`username profile_pic_url ${cineKey} following followers favoriteMovies favoriteSeries`)
    .lean();

  if (!target || !target[cineKey]) {
    return sendError(res, 'Target user or their CineGraph data not found', 404);
  }

  try {
    const { matchPercentage, breakdown, favorites1, favorites2 } = computeMatchBreakdown(
      me,
      target,
      cineKey,
      { type, genres, useCount, useAvgRating }
    );

    const llmInput = formatForLLM({
      schema_version: "1.0",
      requester: { _id: me._id, username: me.username },
      target: { _id: target._id, username: target.username, profile_pic_url: target.profile_pic_url },
      type,
      cineKey,
      matchPercentage,
      breakdown,
      myGraph: me[cineKey],
      targetGraph: target[cineKey],
      favorites: {
        me: favorites1.map((x) => x.toString && x.toString()).slice(0, 50),
        target: favorites2.map((x) => x.toString && x.toString()).slice(0, 50),
      },
    });

    // Sanitize LLM payload before returning/sending to external services
    const sanitizedLLMInput = sanitizeForLLM(llmInput, { redactUsernames: false, redactProfilePic: true });

    sendSuccess(res, {
      matchPercentage,
      targetUser: {
        _id: target._id,
        username: target.username,
        profile_pic_url: target.profile_pic_url,
      },
      breakdown,
      llmInput: sanitizedLLMInput,
    }, 'Match calculated successfully');

  } catch (error) {
    return sendError(res, 'Error calculating match', 500);
  }
});

/**
 * POST /api/match/:targetUserId/analyze
 * Build llmInput, sanitize it, then call llmAdapter (mock by default) and return analysis.
 */
export const analyzeMatchWithUser = asyncHandler(async (req, res) => {
  const meId = req.user.id;
  const { targetUserId } = req.params;
  const { type = 'movie', genres = [], useCount = true, useAvgRating = true, language: rawLanguage } = req.body;
  const language = SUPPORTED_LANGUAGES[rawLanguage] ? rawLanguage : 'en';
  const languageName = SUPPORTED_LANGUAGES[language];

  const requestedMock = req.query.mock === 'true';
  const requestedProvider = req.query.provider;
  const useMock = requestedMock || process.env.LLM_MODE === 'mock';

  if (!targetUserId) return sendError(res, 'Target user ID is required', 400);
  if (meId === targetUserId) return sendError(res, 'Cannot analyze yourself', 400);

  const cineKey = type === 'movie' ? 'movieCineGraph' : 'seriesCineGraph';

  const me = await User.findById(meId).lean();
  const target = await User.findById(targetUserId).select(`username profile_pic_url ${cineKey} following followers favoriteMovies favoriteSeries`).lean();

  if (!me || !me[cineKey] || !target || !target[cineKey]) return sendError(res, 'Required data not found', 404);

  // Same helper getMatchWithUser uses, with the same filters the client
  // used for its Cinematch call — so the score referenced here matches what
  // was already shown on screen instead of a second, different number.
  const { matchPercentage, breakdown, favorites1, favorites2, socialOverlap } = computeMatchBreakdown(
    me,
    target,
    cineKey,
    { type, genres, useCount, useAvgRating }
  );

  const llmInput = formatForLLM({
    schema_version: '1.0',
    requester: { _id: me._id, username: me.username },
    target: { _id: target._id, username: target.username, profile_pic_url: target.profile_pic_url },
    type,
    cineKey,
    matchPercentage,
    breakdown,
    myGraph: me[cineKey],
    targetGraph: target[cineKey],
    favorites: { me: favorites1.map(String).slice(0, 50), target: favorites2.map(String).slice(0, 50) },
    socialOverlap,
  });

  const sanitized = sanitizeForLLM(llmInput, { redactUsernames: false, redactProfilePic: true });

  // An explicit override (dev-only ?mock=true / ?provider=x, or LLM_MODE
  // forcing one provider) is respected exactly, with no fallback — that's
  // what "force this provider" means. Otherwise, try every configured real
  // provider in preference order, falling back to the next on any failure
  // (network error, bad/expired key, quota, rate limit), with mock as the
  // guaranteed-to-succeed last resort — so a Gemini outage or a missing key
  // degrades the analysis instead of erroring the whole request out.
  const explicitProvider =
    (useMock && 'mock') ||
    requestedProvider ||
    (['gemini', 'groq', 'openrouter', 'openai', 'mock'].includes(process.env.LLM_MODE) && process.env.LLM_MODE) ||
    null;

  const providerCandidates = explicitProvider
    ? [explicitProvider]
    : [
        process.env.GEMINI_API_KEY && 'gemini',
        process.env.GROQ_API_KEY && 'groq',
        process.env.OPENROUTER_API_KEY && 'openrouter',
        process.env.OPENAI_API_KEY && 'openai',
        'mock',
      ].filter(Boolean);

  const promptTemplate = {
    system: `You are the Cinephix match assistant. Address the user directly, in a warm, concise tone, writing naturally in ${languageName}. Do not speak in third person. Do not give technical explanations.`,
    instruction: [
      "Based on the following data, return ONLY valid JSON.",
      "Fields: analysis, strengths, weaknesses, conversation_starters, graph_ascii.",
      `analysis: 2-3 short sentences, written in natural ${languageName}, addressing the user directly ("you").`,
      "In analysis, mention the strongest shared genre, shared favorites count, and social overlap where possible, but keep it short.",
      "Do not use markdown code blocks. Do not add any text outside the JSON.",
    ].join(" "),
  };

  let llmResp = null;
  let provider = null;
  for (const candidate of providerCandidates) {
    try {
      llmResp = await callLLM(sanitized, { provider: candidate, promptTemplate, language });
      provider = candidate;
      break;
    } catch (err) {
      console.error(`Analyze: provider "${candidate}" failed, trying next:`, err.message);
    }
  }
  // Unreachable in practice (mock never throws and is always in the
  // fallback list), but guards against a genuinely empty candidate list.
  if (!llmResp) {
    llmResp = await callLLM(sanitized, { provider: 'mock', promptTemplate, language });
    provider = 'mock';
  }

  const parsedCandidate = llmResp.parsed
    || extractJsonFromLLMText(llmResp.text)
    || { analysis: llmResp.text || "Analysis could not be generated." };

  const parsed = normalizeLLMAnalysis(parsedCandidate, sanitized, llmResp.text || "", language);

  return sendSuccess(
    res,
    { provider, matchPercentage, breakdown, parsed, raw: llmResp.raw || llmResp },
    'Analysis generated'
  );
});
