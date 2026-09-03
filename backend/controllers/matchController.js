import mongoose from "mongoose";
import User from "../models/User.js";
import Rating from "../models/Rating.js";
import { MOVIE_GENRE_MAP, SERIES_GENRE_MAP } from "../utils/genreConstants.js";

// New imports for consistent responses and error handling
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError, sendPaginated } from "../utils/response.js";

// The "hybrid approach" services (contentBasedService.js, socialScoreService.js,
// diversityScoreService.js, bonusMetricsService.js) used to be imported here but
// never actually called — computeMatchBreakdown below now has its own in-memory
// equivalents (see calculateDiversityScoreInMemory / calculateTrendingAlignmentInMemory
// / etc.) that operate on data this file already has loaded, instead of each doing
// its own redundant User.findById per candidate. The service files themselves are
// untouched — backend/scripts/test_hybrid_matching.js still imports them directly.
import { formatForLLM } from "../services/llmFormatterService.js";
import { sanitizeForLLM } from "../services/llmSanitizerService.js";
import { callLLM } from "../services/llmAdapter.js";
import { getTierLimits, DEFAULT_MATCH_FILTERS } from "../config/tiers.js";

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
    // Deliberately no percentage here — the score is already shown
    // separately (MatchTierRow's ring), repeating it in the narrative read
    // as redundant.
    summary: () => `Overall, there's promising compatibility between you.`,
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
    matchTitle: (g) => `${g} Movie Buddies`,
    matchTitleGeneric: 'Cinematic Match',
  },
  tr: {
    topGenre: (g) => `Senin için en güçlü ortak nokta ${g} türü gibi görünüyor.`,
    noTopGenre: 'Senin için dikkat çekici ortak ilgi alanları var.',
    favoriteOverlap: (n) => `${n} ortak favori içeriğiniz var; bu sohbeti başlatmak için güzel bir fırsat.`,
    noFavoriteOverlap: 'Ortak favori içerik sayınız sınırlı ama konuşmayı başlatacak noktalar yine de var.',
    socialOverlap: 'Sosyal ağdaki kesişim de iletişimi daha doğal hale getirebilir.',
    noSocialOverlap: 'Sosyal ağ kesişimi sınırlı olsa da, ilgi alanlarınız üzerinden sıcak bir bağ kurulabilir.',
    summary: () => `Genel olarak umut veren bir uyum görünüyor.`,
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
    matchTitle: (g) => `${g} Film Dostları`,
    matchTitleGeneric: 'Sinematik Eşleşme',
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

  // Safety-net fallback only — the LLM's own creative title (e.g. "Horror
  // Cinephile Duo") is what actually ships whenever a real provider responds
  // validly. Mirrors the exact `${favGenre} Cinephile` idiom Profile
  // Analysis's own mock generator already uses (userController.js), rather
  // than inventing a separate score-tier system.
  const match_title = topGenre ? strings.matchTitle(topGenre) : strings.matchTitleGeneric;

  return { analysis, strengths, weaknesses, conversation_starters, graph_ascii, match_title };
};

// Fixes the handful of malformed-JSON mistakes an LLM actually makes in
// practice (smart quotes it picked up from somewhere, a trailing comma
// before a closing brace/bracket) — not a full JSON5 parser, just enough to
// turn "so close it should have worked" into a real parse instead of
// falling all the way through to the raw-text fallback below, which is
// what let literal JSON syntax leak into the displayed analysis text.
const repairJsonText = (text) =>
  text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/,(\s*[}\]])/g, "$1");

const extractJsonFromLLMText = (text) => {
  if (!text || typeof text !== "string") return null;

  const tryParse = (candidate) => {
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        return JSON.parse(repairJsonText(candidate));
      } catch {
        return null;
      }
    }
  };

  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    const parsed = tryParse(fenced[1]);
    if (parsed) return parsed;
  }

  const whole = tryParse(text);
  if (whole) return whole;

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return tryParse(text.slice(start, end + 1));
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
  // Caps a single item's length rather than falling back to the canonical
  // list wholesale (unlike the whole-analysis/match_title guards below) —
  // one overly chatty strength shouldn't discard three other genuinely
  // good ones; the client's own AnimatedInsightList further clips with
  // numberOfLines as a last line of defense regardless.
  const truncateItem = (s, max) => (typeof s === "string" && s.length > max ? `${s.slice(0, max - 1).trim()}…` : s);
  const ITEM_MAX_CHARS = 110;
  const strengths = Array.isArray(source.strengths) && source.strengths.length
    ? source.strengths.map((s) => truncateItem(s, ITEM_MAX_CHARS))
    : canonical.strengths;
  const weaknesses = Array.isArray(source.weaknesses) && source.weaknesses.length
    ? source.weaknesses.map((s) => truncateItem(s, ITEM_MAX_CHARS))
    : canonical.weaknesses;
  const conversation_starters = Array.isArray(source.conversation_starters) && source.conversation_starters.length
    ? source.conversation_starters.map((s) => truncateItem(s, ITEM_MAX_CHARS))
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

  // Real, live-reported bug: when every JSON.parse attempt in
  // extractJsonFromLLMText fails, the call site's own fallback is
  // `{ analysis: llmResp.text }` — the ENTIRE raw LLM response, verbatim,
  // including whatever JSON-ish punctuation it still contains (a stray
  // `{`, a field name like `analyses:`, etc.), none of which the markdown
  // cleanup above strips. A genuine prose analysis should never contain a
  // literal curly brace at all, so this is a safe, simple tell that raw/
  // malformed JSON leaked through undetected by the keyword check above.
  if (/[{}]/.test(analysis)) {
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

  let match_title = String(source.match_title || canonical.match_title).trim();
  // Same "too long/garbled -> fall back to canonical" guard as analysis
  // above, scaled down for a short title instead of a paragraph — plus the
  // same curly-brace leak check, in case a totally-failed parse ever left
  // match_title pointing at raw JSON text too (source.analysis is the only
  // field extractJsonFromLLMText's own fallback object populates today, so
  // this is defensive rather than a reproduced bug, but cheap to guard).
  if (!match_title || match_title.length > 60 || /[{}]/.test(match_title)) {
    match_title = canonical.match_title;
  }

  return {
    analysis,
    strengths,
    weaknesses,
    conversation_starters,
    graph_ascii,
    match_title,
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

/**
 * GET /api/match/swipe/queue
 * Ranked batch of match candidates, sorted by matchPercentage descending —
 * the profile-cloud results view is just the top of this same array, no
 * separate endpoint. (No more accept/reject/exclusion here — CineMatch is a
 * browse-and-follow feature now, not swipe-to-decide, so there's no
 * decision history left to exclude candidates by.)
 * Free/any tier without canUseMatchFilters always gets DEFAULT_MATCH_FILTERS,
 * enforced here — not just hidden client-side — so a tampered request can't
 * bypass the Pro/Premium-only filter UI. Each candidate now also carries its
 * full breakdown (computeMatchBreakdown already computes it per-candidate;
 * it used to be discarded here, keeping only matchPercentage) so the client
 * can render a per-category ring, not just a flat percentage, plus a
 * matchInsights block (shared genres, favorites overlap, social overlap
 * detail) for a future match-detail view.
 */
export const getSwipeQueue = asyncHandler(async (req, res) => {
  const meId = req.user.id;
  const { canUseMatchFilters, maxMatches } = getTierLimits(req.user.accountTier);

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
    return sendSuccess(res, { candidates: [] }, "No candidates found");
  }

  const others = await User.find({ _id: { $ne: meId } })
    .select(`username profile_pic_url bio ${cineKey} following followers favoriteMovies favoriteSeries watchlist`)
    .limit(1000)
    .lean();

  const eligibleOthers = others.filter((u) => u[cineKey]);

  // One batched query for every candidate that will actually be scored (plus
  // the requesting user), instead of computeMatchBreakdown's bonus signal
  // doing its own DB call per candidate inside the loop below — that would
  // be a real N+1 against up to 1000 candidates. "Last 3 months" matches
  // the recency window the bonus formula's activityRecency sub-signal uses.
  const RATING_RECENCY_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
  const ratingCutoff = new Date(Date.now() - RATING_RECENCY_WINDOW_MS);
  const recentRatingsRaw = await Rating.find({
    user: { $in: [meId, ...eligibleOthers.map((u) => u._id)] },
    createdAt: { $gte: ratingCutoff },
  })
    .select("user contentId createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const ratingsByUser = new Map();
  for (const r of recentRatingsRaw) {
    const uid = r.user.toString();
    if (!ratingsByUser.has(uid)) ratingsByUser.set(uid, []);
    ratingsByUser.get(uid).push(r);
  }
  const myRecentRatings = ratingsByUser.get(meId) || [];

  const favField = type === "movie" ? "favoriteMovies" : "favoriteSeries";
  const favoriteGenreIds = await buildFavoriteGenreIdsMap(type, [
    me[favField],
    ...eligibleOthers.map((u) => u[favField]),
  ]);

  const results = [];
  for (const u of eligibleOthers) {
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
      const { matchPercentage, breakdown, matchInsights } = computeMatchBreakdown(
        me,
        u,
        cineKey,
        { type, genres, useCount, useAvgRating },
        { recentRatings: { me: myRecentRatings, target: ratingsByUser.get(u._id.toString()) || [] }, favoriteGenreIds }
      );
      results.push({
        user: {
          _id: u._id,
          username: u.username,
          profile_pic_url: u.profile_pic_url,
          bio: u.bio,
        },
        contentType: type,
        matchPercentage,
        breakdown,
        matchInsights,
      });
    } catch {
      continue;
    }
  }

  results.sort((a, b) => b.matchPercentage - a.matchPercentage);

  return sendSuccess(
    res,
    { candidates: results.slice(0, maxMatches) },
    "Swipe queue fetched"
  );
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

// Shannon entropy of a user's own genre-watch distribution, normalized 0-1
// (0 = concentrated in one genre, 1 = spread evenly across all of them).
// Ports diversityScoreService.js's calculateGenreDiversityEntropy exactly,
// operating on an already-loaded CineGraph object instead of a fresh
// User.findById.
const calculateGenreEntropy = (cineGraph) => {
  if (!cineGraph || Object.keys(cineGraph).length === 0) return 0;
  const counts = Object.values(cineGraph).map((g) => g.count || 0);
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const probabilities = counts.map((c) => c / total);
  let entropy = 0;
  for (const p of probabilities) {
    if (p > 0) entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(counts.length);
  return maxEntropy === 0 ? 0 : entropy / maxEntropy;
};

// Symmetric difference of which genres each user has any data for at all —
// ports diversityScoreService.js's calculateGenreDifference exactly.
const calculateGenreDifference = (cineGraph1, cineGraph2) => {
  if (!cineGraph1 || !cineGraph2) return 0.5;
  const genres1 = new Set(Object.keys(cineGraph1));
  const genres2 = new Set(Object.keys(cineGraph2));
  const union = new Set([...genres1, ...genres2]);
  if (union.size === 0) return 0;
  const symmetricDiff = [...union].filter((g) => !(genres1.has(g) && genres2.has(g)));
  return symmetricDiff.length / union.size;
};

/**
 * Replaces the crude std-dev calculateDiversityInMemory (still used by the
 * separate findMatches/scoreHybridCandidate path, left untouched) with the
 * Shannon-entropy-based formula from diversityScoreService.js: are the two
 * users' own diversity *levels* similar (entropyAlignment, 50%), blended
 * with how different the actual *genres* they watch are — complementary
 * variety (genreDifference, 50%). Operates on the full, un-genre-filtered
 * CineGraph, same convention the code it replaces used — diversity is about
 * each user's overall taste breadth, independent of whatever genre a
 * particular match request happens to be filtered to.
 */
const calculateDiversityScoreInMemory = (myGraph, targetGraph) => {
  const entropy1 = calculateGenreEntropy(myGraph);
  const entropy2 = calculateGenreEntropy(targetGraph);
  const entropyAlignment = 1 - Math.min(1, Math.abs(entropy1 - entropy2));
  const genreDifference = calculateGenreDifference(myGraph, targetGraph);
  return Math.min(1, 0.5 * entropyAlignment + 0.5 * genreDifference);
};

const RECENT_TRENDING_LIMIT = 10; // matches bonusMetricsService.js's calculateTrendingAlignment's own limit=10
const ACTIVITY_RECENCY_TARGET = 20; // matches calculateActivityRecency's own min(1, count/20)

// bonusMetricsService.js's calculateTrendingAlignment reads `r.content`, but
// Rating.js has no `content` field (only `contentId`, a plain String) — that
// function has never actually worked, always falling through to its 0.5
// empty-set fallback. This ports the *intent* (Jaccard overlap of each
// side's most-recently-rated content) using the real field, and — a
// deliberate change from the source — does NOT special-case empty inputs to
// a neutral 0.5: a bonus category should reward positive evidence, not
// reward the absence of data as a coin-flip neutral. Zero recent ratings on
// either side naturally falls out to 0 via the union-size guard below, no
// special-casing needed.
const calculateTrendingAlignmentInMemory = (meRatings, targetRatings) => {
  const meIds = new Set(meRatings.slice(0, RECENT_TRENDING_LIMIT).map((r) => r.contentId.toString()));
  const targetIds = new Set(targetRatings.slice(0, RECENT_TRENDING_LIMIT).map((r) => r.contentId.toString()));
  const union = new Set([...meIds, ...targetIds]);
  if (union.size === 0) return 0;
  const intersection = [...meIds].filter((id) => targetIds.has(id)).length;
  return intersection / union.size;
};

// Is the candidate (target) actually active lately — single-user signal,
// same 0-if-no-recent-ratings reasoning as calculateTrendingAlignmentInMemory
// above (an inactive/new account shouldn't score the same as a genuinely
// average one here).
const calculateActivityRecencyInMemory = (targetRatings) => Math.min(1, targetRatings.length / ACTIVITY_RECENCY_TARGET);

// Watch-volume compatibility (casual viewer vs. heavy watcher) — ports
// diversityScoreService.js's calculateWatchActivityScore, using the
// already-loaded CineGraph instead of a fresh DB fetch. No Rating query
// needed at all. Unlike the two signals above, a zero-total-watches case
// keeps the original 0.5 neutral on purpose — this is a genuine "not enough
// data to compare" case, not an "no positive evidence to reward" one.
const calculateWatchActivityScoreInMemory = (myGraph, targetGraph) => {
  const total1 = Object.values(myGraph || {}).reduce((sum, g) => sum + (g.count || 0), 0);
  const total2 = Object.values(targetGraph || {}).reduce((sum, g) => sum + (g.count || 0), 0);
  if (total1 === 0 || total2 === 0) return 0.5;
  const ratio = Math.max(total1, total2) / Math.min(total1, total2);
  if (ratio <= 1) return 1.0;
  if (ratio >= 10) return 0.0;
  return 1 - (ratio - 1) / 9;
};

const MATCH_INSIGHTS_MAX_SHARED_FAVORITE_IDS = 20;
// Favorites score weighting: mostly exact-title overlap, a smaller credit
// for "your favorites at least cover the same genres" even without any
// title in common.
const CONTENT_SCORE_EXACT_WEIGHT = 0.7;
const CONTENT_SCORE_GENRE_WEIGHT = 0.3;

// Reverse genre-name -> numeric TMDB ID lookup, shared by computeMatchBreakdown's
// favorites genre-filter below and getSharedGenreContent.
const resolveGenreIds = (genreMap, genreNames) =>
  Object.keys(genreMap)
    .filter((id) => genreNames.includes(genreMap[id]))
    .map(Number);

const jaccard = (setA, setB) => {
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
};

// One batched Movie/Series lookup for every favorite ID across the given
// lists, keyed by contentId -> genre_ids, so computeMatchBreakdown (a
// deliberately DB-call-free function, safe to call in getSwipeQueue's
// up-to-1000-candidate loop) can both filter favorites by an active genre
// filter AND blend genre-overlap into the Favorites score, without doing its
// own per-candidate query. Always fetched now (used to early-return null when
// no genre filter was active, back when the genre filter was its only
// consumer) — still just one batched query per request, not per-candidate.
const buildFavoriteGenreIdsMap = async (type, favoriteIdLists) => {
  const allIds = new Set();
  favoriteIdLists.forEach((ids) => (ids || []).forEach((id) => allIds.add(id.toString())));
  if (allIds.size === 0) return new Map();
  const Model = mongoose.model(type === "movie" ? "Movie" : "Series");
  const docs = await Model.find({ _id: { $in: [...allIds] } }).select("_id genre_ids").lean();
  return new Map(docs.map((d) => [d._id.toString(), d.genre_ids || []]));
};

// Lightweight (no formatForLLM, no LLM-prompt baggage) derivation of the
// extra data a future match-detail UI will want, built entirely from data
// computeMatchBreakdown already has in scope by the time it's called —
// zero extra computation or DB calls.
const buildMatchInsights = (genreCounts1, genreCounts2, favorites1, favorites2, socialOverlap, favoriteGenreIds) => {
  // Every shared genre, not just a top slice — the client's own carousel
  // (arrows, one genre at a time) already handles however many there are
  // without a crowded chip row, so there's no display reason to cap this
  // server-side. Still sorted by combined watch count, heaviest overlap first.
  const allGenres = new Set([...Object.keys(genreCounts1), ...Object.keys(genreCounts2)]);
  const sharedGenres = [...allGenres]
    .map((genre) => ({ genre, meCount: genreCounts1[genre] || 0, targetCount: genreCounts2[genre] || 0 }))
    .filter((entry) => entry.meCount > 0 && entry.targetCount > 0)
    .sort((a, b) => b.meCount + b.targetCount - (a.meCount + a.targetCount));

  const favSet1 = new Set(favorites1.map((id) => id.toString()));
  const favSet2 = new Set(favorites2.map((id) => id.toString()));
  const favIntersection = [...favSet1].filter((id) => favSet2.has(id));
  const favUnion = new Set([...favSet1, ...favSet2]);

  // Favorites that don't match exactly but share a genre with something on
  // the other side — the "different title, same taste" case the blended
  // Favorites score (computeMatchBreakdown's contentScore) already credits
  // internally but never surfaced before now.
  const genreIdsFor = (id) => favoriteGenreIds?.get(id.toString()) || [];
  const nonExact1 = [...favSet1].filter((id) => !favSet2.has(id));
  const nonExact2 = [...favSet2].filter((id) => !favSet1.has(id));
  const otherGenres2 = new Set(nonExact2.flatMap(genreIdsFor));
  const otherGenres1 = new Set(nonExact1.flatMap(genreIdsFor));
  const genreOnlyMine = nonExact1.filter((id) => genreIdsFor(id).some((g) => otherGenres2.has(g)));
  const genreOnlyTheirs = nonExact2.filter((id) => genreIdsFor(id).some((g) => otherGenres1.has(g)));

  return {
    sharedGenres,
    favoritesOverlap: {
      intersectionCount: favIntersection.length,
      unionCount: favUnion.size,
      sharedIds: favIntersection.slice(0, MATCH_INSIGHTS_MAX_SHARED_FAVORITE_IDS),
      genreOnly: {
        mine: genreOnlyMine.slice(0, MATCH_INSIGHTS_MAX_SHARED_FAVORITE_IDS),
        theirs: genreOnlyTheirs.slice(0, MATCH_INSIGHTS_MAX_SHARED_FAVORITE_IDS),
      },
    },
    socialOverlap,
  };
};

/**
 * Full weighted match score + per-dimension breakdown between two specific
 * users — shared by getSwipeQueue (the swipe/match-cloud list), getMatchWithUser
 * (the score shown on a profile), and analyzeMatchWithUser (the LLM narrative).
 * Single source of truth; every caller gets the same number for the same pair
 * of users and filters.
 *
 * recentRatings (5th param, optional) must be pre-fetched by the caller —
 * already-sorted-newest-first, plain {user, contentId, createdAt} objects —
 * this function itself makes no DB calls, so it stays safe to call in
 * getSwipeQueue's up-to-1000-candidate loop.
 *
 * favoriteGenreIds (5th param, optional) — a Map<contentId, genre_ids[]> from
 * buildFavoriteGenreIdsMap, pre-fetched by the caller the same way. If a
 * genre filter is active but the caller doesn't pass this, favorites
 * silently stay unfiltered (today's behavior) rather than throwing — every
 * current caller passes it, but a future one that forgets it won't get an
 * error, just the old broad behavior.
 */
const computeMatchBreakdown = (
  me,
  target,
  cineKey,
  { type, genres = [], useCount = true, useAvgRating = true },
  { recentRatings = { me: [], target: [] }, favoriteGenreIds = null } = {}
) => {
  const myGraph = me[cineKey];
  const targetGraph = target[cineKey];

  const g1 = {};
  const g2 = {};
  const r1 = {};
  const r2 = {};
  // Always populated with real watch counts, independent of `useCount`
  // below — Shared Genres' own "which genres do you two genuinely have in
  // common" list (buildMatchInsights' sharedGenres) reads from this, not
  // from g1/g2, so it doesn't silently come back completely empty just
  // because the *score* currently isn't weighing raw watch volume. Those
  // are two different questions: how the score is weighted (useCount) vs.
  // which genres genuinely overlap (always true or false, regardless).
  const genreCounts1 = {};
  const genreCounts2 = {};

  for (const [genre, v] of Object.entries(myGraph)) {
    if (genres.length && !genres.includes(genre)) continue;
    genreCounts1[genre] = v.count;
    if (useCount) g1[genre] = v.count;
    if (useAvgRating) r1[genre] = v.avgRating;
  }
  for (const [genre, v] of Object.entries(targetGraph)) {
    if (genres.length && !genres.includes(genre)) continue;
    genreCounts2[genre] = v.count;
    if (useCount) g2[genre] = v.count;
    if (useAvgRating) r2[genre] = v.avgRating;
  }

  const genreScore = cosineSimilarity(g1, g2);
  const ratingScore = avgRatingSimilarity(r1, r2);
  const collaborativeScore = 0.5 * genreScore + 0.5 * ratingScore;

  // When a genre filter is active, favorites should be scoped to it too —
  // otherwise "Comedy only" narrows the Taste score and Shared Genres but
  // Shared Favorites keeps showing overlap across the user's entire library,
  // which reads as inconsistent (this is exactly what the fix addresses).
  const genreFilterActive = genres.length > 0;
  const activeGenreIdSet = genreFilterActive
    ? new Set(resolveGenreIds(type === "movie" ? MOVIE_GENRE_MAP : SERIES_GENRE_MAP, genres))
    : null;
  const filterFavoritesByGenre = (favIds) => {
    if (!genreFilterActive || !favoriteGenreIds) return favIds;
    return favIds.filter((id) => {
      const gids = favoriteGenreIds.get(id.toString());
      return Array.isArray(gids) && gids.some((gid) => activeGenreIdSet.has(gid));
    });
  };
  const favorites1 = filterFavoritesByGenre((type === "movie" ? me.favoriteMovies : me.favoriteSeries) || []);
  const favorites2 = filterFavoritesByGenre((type === "movie" ? target.favoriteMovies : target.favoriteSeries) || []);
  // Favorites score blends two signals: mostly exact-title overlap (do you
  // both actually favorite the same movie/show), plus a smaller genre-overlap
  // credit (do your favorites at least cover the same genres) — two people
  // who both favorite different sci-fi movies used to get zero credit for
  // that shared taste; now they get a partial one. Same scoping as today:
  // operates on favorites1/favorites2 *after* filterFavoritesByGenre, so an
  // active genre filter already narrows both sets the same way it did before.
  let contentScore = 0;
  if (favorites1.length > 0 && favorites2.length > 0) {
    const idSet1 = new Set(favorites1.map((id) => id.toString()));
    const idSet2 = new Set(favorites2.map((id) => id.toString()));
    const exactScore = jaccard(idSet1, idSet2);

    const genreSet1 = new Set();
    const genreSet2 = new Set();
    if (favoriteGenreIds) {
      favorites1.forEach((id) => (favoriteGenreIds.get(id.toString()) || []).forEach((g) => genreSet1.add(g)));
      favorites2.forEach((id) => (favoriteGenreIds.get(id.toString()) || []).forEach((g) => genreSet2.add(g)));
    }
    const genreScore = jaccard(genreSet1, genreSet2);

    contentScore = CONTENT_SCORE_EXACT_WEIGHT * exactScore + CONTENT_SCORE_GENRE_WEIGHT * genreScore;
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

  const meIdStr = me._id.toString();
  const targetIdStr = target._id.toString();
  const iFollowTarget = myFollowing.has(targetIdStr);
  const targetFollowsMe = targetFollowing.has(meIdStr);

  // Direct-connection bonus (mirrors socialScoreService.js's own
  // calculateSocialScore exactly) — without this, socialScore was
  // mathematically capped at 0.8 (0.4+0.4) and could never reach 100%.
  let directConnectionBonus = 0;
  if (iFollowTarget || targetFollowsMe) {
    directConnectionBonus = 0.2;
  } else if (myFollowers.size > 0 || targetFollowers.size > 0) {
    const avgFollowers = (myFollowers.size + targetFollowers.size) / 2;
    directConnectionBonus = Math.min(1, avgFollowers / 100) * 0.15;
  }

  const socialScore = Math.min(1, 0.4 * followingOverlapRate + 0.4 * followersOverlapRate + directConnectionBonus);

  const diversityScore = calculateDiversityScoreInMemory(myGraph, targetGraph);

  const trendingAlignment = calculateTrendingAlignmentInMemory(recentRatings.me, recentRatings.target);
  const activityRecency = calculateActivityRecencyInMemory(recentRatings.target);
  const watchActivityScore = calculateWatchActivityScoreInMemory(myGraph, targetGraph);
  // trendingAlignment gets the majority share — it's the one signal nothing
  // else in this formula captures ("are they engaging with the same content
  // right now"); activityRecency/watchActivityScore are secondary quality
  // signals splitting the remainder evenly.
  const bonusScore = Math.min(1, 0.5 * trendingAlignment + 0.25 * activityRecency + 0.25 * watchActivityScore);

  const finalScore =
    0.35 * collaborativeScore +
    0.25 * contentScore +
    0.2 * socialScore +
    0.15 * diversityScore +
    0.05 * bonusScore;

  const socialOverlap = {
    mutualFollowing,
    mutualFollowers,
    followingOverlapRate: Math.round(followingOverlapRate * 100),
    followersOverlapRate: Math.round(followersOverlapRate * 100),
  };

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
    socialOverlap,
    matchInsights: buildMatchInsights(genreCounts1, genreCounts2, favorites1, favorites2, socialOverlap, favoriteGenreIds),
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
    const ratingCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const pairRatings = await Rating.find({ user: { $in: [meId, targetUserId] }, createdAt: { $gte: ratingCutoff } })
      .select("user contentId createdAt")
      .sort({ createdAt: -1 })
      .lean();
    const myRecentRatings = pairRatings.filter((r) => r.user.toString() === meId);
    const targetRecentRatings = pairRatings.filter((r) => r.user.toString() === targetUserId);

    const favField = type === "movie" ? "favoriteMovies" : "favoriteSeries";
    const favoriteGenreIds = await buildFavoriteGenreIdsMap(type, [me[favField], target[favField]]);

    const { matchPercentage, breakdown, favorites1, favorites2 } = computeMatchBreakdown(
      me,
      target,
      cineKey,
      { type, genres, useCount, useAvgRating },
      { recentRatings: { me: myRecentRatings, target: targetRecentRatings }, favoriteGenreIds }
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

  const ratingCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const pairRatings = await Rating.find({ user: { $in: [meId, targetUserId] }, createdAt: { $gte: ratingCutoff } })
    .select("user contentId createdAt")
    .sort({ createdAt: -1 })
    .lean();
  const myRecentRatings = pairRatings.filter((r) => r.user.toString() === meId);
  const targetRecentRatings = pairRatings.filter((r) => r.user.toString() === targetUserId);

  const favField = type === "movie" ? "favoriteMovies" : "favoriteSeries";
  const favoriteGenreIds = await buildFavoriteGenreIdsMap(type, [me[favField], target[favField]]);

  // Same helper getMatchWithUser uses, with the same filters the client
  // used for its Cinematch call — so the score referenced here matches what
  // was already shown on screen instead of a second, different number.
  const { matchPercentage, breakdown, favorites1, favorites2, socialOverlap } = computeMatchBreakdown(
    me,
    target,
    cineKey,
    { type, genres, useCount, useAvgRating },
    { recentRatings: { me: myRecentRatings, target: targetRecentRatings }, favoriteGenreIds }
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
    // Conciseness constraints (word cap on `analysis`, item caps on the
    // three lists, the trailing "Be concise" line) are a real, live-tested
    // fix, not a style preference: DEFAULT_GROQ_MODEL (llmAdapter.js) runs
    // meaningfully more verbose than the previous Groq model when not
    // explicitly constrained, and a real test run of this exact prompt
    // without these limits hit finish_reason:"length" (truncated mid-JSON,
    // unparseable) at 500 completion tokens; with them, repeated real runs
    // landed around 150-200 tokens every time — comfortably inside the
    // budget in callGroq.
    instruction: [
      "Based on the following data, return ONLY valid JSON.",
      "Fields: analysis, strengths, weaknesses, conversation_starters, graph_ascii, match_title.",
      `analysis: 2-3 short sentences (40 words max total), written in natural ${languageName}, addressing the user directly ("you").`,
      "In analysis, mention the strongest shared genre, shared favorites count, and social overlap where possible, but keep it short.",
      "Do not mention or repeat the exact percentage/compatibility score number in the analysis — it's shown separately elsewhere.",
      "strengths, weaknesses, conversation_starters: short bullet phrases, at most 3 items each.",
      `match_title: a short, creative 2-4 word title capturing the vibe of this match (e.g. "Horror Cinephile Duo", "Slow-Burn Drama Fans"), written in ${languageName}.`,
      "Do not use markdown code blocks. Do not add any text outside the JSON. Be concise throughout.",
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

// Closeness, not a high-rating floor — matches computeMatchBreakdown's own
// avgRatingSimilarity (1 - |diff|/10), which scores two people agreeing at
// the low end exactly as well as agreeing at the high end. This endpoint
// used to require both ratings >= 7 with no closeness check at all (so a 7
// and a 10 counted as a "match" while two people both rating something a 2
// — clearly aligned taste, just a shared dislike — never showed up
// anywhere), which didn't reflect what the Sync score itself actually
// rewards. Deviation on the model's own 1-10 scale.
const SHARED_GENRE_CONTENT_MAX_RATING_DEVIATION = 2;

/**
 * Titles either side has rated, grouped by genre — included when both have
 * rated it and are within SHARED_GENRE_CONTENT_MAX_RATING_DEVIATION of each
 * other (agreeing they loved it and agreeing they disliked it both count,
 * only the rating GAP matters, not its level), OR when only one side has
 * rated it at all (the other renders "Not rated yet" client-side — this
 * used to be excluded entirely, which silently hid every title unless both
 * sides happened to have already rated it). Only excluded when both sides
 * rated it and disagree by more than the deviation. One round trip for
 * every genre in `genres` at once, since the expensive part (the two Rating
 * queries + the batched Movie/Series fetch) is genre-independent; only the
 * final filter step varies per genre. Unbounded per genre — the client's
 * own poster row/coverflow handles however many come back.
 *
 * @route  POST /api/match/:targetUserId/shared-genre-content
 * @access Private
 */
export const getSharedGenreContent = asyncHandler(async (req, res) => {
  const meId = req.user.id;
  const { targetUserId } = req.params;
  const { type, genres = [] } = req.body;

  if (type !== "movie" && type !== "series") {
    return sendError(res, 'type must be "movie" or "series"', 400);
  }
  if (!Array.isArray(genres) || genres.length === 0) {
    return sendSuccess(res, {}, "No genres requested");
  }

  const Model = mongoose.model(type === "movie" ? "Movie" : "Series");
  const genreMap = type === "movie" ? MOVIE_GENRE_MAP : SERIES_GENRE_MAP;
  const titleField = type === "movie" ? "title" : "name";
  const dateField = type === "movie" ? "release_date" : "first_air_date";

  const ratings = await Rating.find({
    user: { $in: [meId, targetUserId] },
    contentType: type,
  })
    .select("user contentId value")
    .lean();

  const myRatingById = new Map();
  const targetRatingById = new Map();
  for (const r of ratings) {
    // contentId is schema-typed as String, but a chunk of this DB's seeded
    // Rating docs actually store it as a raw ObjectId (bypassing Mongoose's
    // own cast, e.g. from a bulk insert that wrote real ObjectId values
    // instead of going through .create()/.save()) — .lean() returns
    // whatever BSON type is really stored, so `r.contentId` here is a
    // String for some rows and an ObjectId object for others. Using it
    // as-is as a Map key silently broke this for every ObjectId-typed row:
    // Map keys compare objects by reference, so `d._id.toString()` (always
    // a real string) below could never find a match under an ObjectId-object
    // key — real confirmed live: `$in: candidateIds` still matched the
    // right Mongo document either way (the driver compares BSON values, not
    // JS types), so the poster showed up, but its own rating lookup missed
    // and both sides silently rendered "Not rated yet" despite a real
    // rating existing. String(...) normalizes either shape to the same
    // canonical id string `d._id.toString()` will also produce.
    const contentId = String(r.contentId);
    if (r.user.toString() === meId) myRatingById.set(contentId, r.value);
    else if (r.user.toString() === targetUserId) targetRatingById.set(contentId, r.value);
  }
  const candidateIds = [...new Set([...myRatingById.keys(), ...targetRatingById.keys()])].filter((id) => {
    const mine = myRatingById.get(id);
    const theirs = targetRatingById.get(id);
    // Only one side has rated it — no disagreement to check, always include.
    if (mine == null || theirs == null) return true;
    return Math.abs(mine - theirs) <= SHARED_GENRE_CONTENT_MAX_RATING_DEVIATION;
  });

  if (candidateIds.length === 0) {
    return sendSuccess(res, Object.fromEntries(genres.map((g) => [g, []])), "No rated shared content");
  }

  const docs = await Model.find({ _id: { $in: candidateIds } })
    .select(`_id ${titleField} poster_path vote_average ${dateField} genre_ids`)
    .lean();
  // Both users' own rating for this title (undefined on whichever side
  // hasn't rated it — already fetched above to build the candidate set,
  // surfaced here so the client can show "you rated it X, they rated it Y"
  // / "Not rated yet" without a second call.
  const enriched = docs.map((d) => ({
    ...d,
    myRating: myRatingById.get(d._id.toString()),
    targetRating: targetRatingById.get(d._id.toString()),
  }));

  const result = {};
  for (const genre of genres) {
    const targetGenreIds = resolveGenreIds(genreMap, [genre]);
    result[genre] = enriched
      .filter((d) => Array.isArray(d.genre_ids) && d.genre_ids.some((gid) => targetGenreIds.includes(gid)))
      // Both-rated-and-closest agreement first, then whichever's only rated
      // by one side (no real gap to sort by, so they trail the ranked ones
      // rather than being interleaved arbitrarily among them).
      .sort((a, b) => {
        const diffOf = (d) => (d.myRating != null && d.targetRating != null ? Math.abs(d.myRating - d.targetRating) : Infinity);
        return diffOf(a) - diffOf(b);
      });
  }

  sendSuccess(res, result, "Shared genre content fetched");
});

/**
 * Both users' own rating (if any) for an arbitrary set of content ids — no
 * threshold, no mutual-rating requirement (unlike getSharedGenreContent
 * above, which needs both sides' ratings within SHARED_GENRE_CONTENT_MAX_RATING_DEVIATION
 * of each other). Built for the Favorites card's detail box, where a
 * favorited title is often rated by one side, both, or neither.
 *
 * @route  POST /api/match/:targetUserId/content-ratings
 * @access Private
 */
export const getContentRatings = asyncHandler(async (req, res) => {
  const meId = req.user.id;
  const { targetUserId } = req.params;
  const { type, ids = [] } = req.body;

  if (type !== "movie" && type !== "series") {
    return sendError(res, 'type must be "movie" or "series"', 400);
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return sendSuccess(res, {}, "No ids requested");
  }

  const ratings = await Rating.find({
    user: { $in: [meId, targetUserId] },
    contentType: type,
    contentId: { $in: ids },
  })
    .select("user contentId value")
    .lean();

  const result = {};
  for (const id of ids) result[id] = {};
  for (const r of ratings) {
    const bucket = result[r.contentId.toString()];
    if (!bucket) continue;
    if (r.user.toString() === meId) bucket.myRating = r.value;
    else if (r.user.toString() === targetUserId) bucket.targetRating = r.value;
  }

  sendSuccess(res, result, "Content ratings fetched");
});

// Deliberately its own constant, not RATING_RECENCY_WINDOW_MS (the 90-day
// window that actually feeds computeMatchBreakdown's own bonus/"Activity"
// score via trendingAlignment/activityRecency) — per direct ask, this only
// changes what the *Activity detail card* displays ("what you've both been
// watching lately" reads better over the last month than the last quarter),
// without touching the real match-percentage math anywhere.
const RECENT_ACTIVITY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Titles both the requesting user and targetUserId have rated within the
 * last RECENT_ACTIVITY_WINDOW_MS — the actual overlap set
 * computeMatchBreakdown's own trendingAlignment sub-score is a Jaccard
 * ratio *of*, made visible instead of just scored. Deliberately an
 * intersection (both sides, not one-sided-OK like getSharedGenreContent's
 * own broadened rule) — Activity is specifically about co-engagement
 * ("did you both watch/rate this around the same time"), not "here's
 * something either of you might like", which is what Shared Genres/
 * Favorites already cover.
 *
 * @route  POST /api/match/:targetUserId/recent-activity
 * @access Private
 */
export const getRecentSharedActivity = asyncHandler(async (req, res) => {
  const meId = req.user.id;
  const { targetUserId } = req.params;
  const { type } = req.body;

  if (type !== "movie" && type !== "series") {
    return sendError(res, 'type must be "movie" or "series"', 400);
  }

  const Model = mongoose.model(type === "movie" ? "Movie" : "Series");
  const titleField = type === "movie" ? "title" : "name";
  const dateField = type === "movie" ? "release_date" : "first_air_date";

  const cutoff = new Date(Date.now() - RECENT_ACTIVITY_WINDOW_MS);
  const ratings = await Rating.find({
    user: { $in: [meId, targetUserId] },
    contentType: type,
    createdAt: { $gte: cutoff },
  })
    .select("user contentId value createdAt")
    .lean();

  const myRatingById = new Map();
  const targetRatingById = new Map();
  for (const r of ratings) {
    // Same normalization as getSharedGenreContent — contentId is a mix of
    // real Strings and raw ObjectId values across this DB's seeded rows.
    const contentId = String(r.contentId);
    if (r.user.toString() === meId) myRatingById.set(contentId, { value: r.value, createdAt: r.createdAt });
    else if (r.user.toString() === targetUserId) targetRatingById.set(contentId, { value: r.value, createdAt: r.createdAt });
  }

  const sharedIds = [...myRatingById.keys()].filter((id) => targetRatingById.has(id));

  if (sharedIds.length === 0) {
    return sendSuccess(res, [], "No recent shared activity");
  }

  const docs = await Model.find({ _id: { $in: sharedIds } })
    .select(`_id ${titleField} poster_path vote_average ${dateField}`)
    .lean();

  const enriched = docs
    .map((d) => {
      const mine = myRatingById.get(d._id.toString());
      const theirs = targetRatingById.get(d._id.toString());
      return {
        ...d,
        myRating: mine.value,
        targetRating: theirs.value,
        // Whichever of the two rated it more recently — sorting by this
        // surfaces "the thing you two most recently both landed on" first,
        // not just an arbitrary DB order.
        mostRecentAt: mine.createdAt > theirs.createdAt ? mine.createdAt : theirs.createdAt,
      };
    })
    .sort((a, b) => b.mostRecentAt - a.mostRecentAt);

  sendSuccess(res, enriched, "Recent shared activity fetched");
});

/**
 * Paginated list of users BOTH the requester and targetUserId follow (people
 * both of us follow, not raw followers/following of either side alone — the
 * existing getMyFollowing/getMyFollowers endpoints return one user's own
 * unfiltered list). Powers the Social Overlap card's mutual-connections
 * avatar grid.
 *
 * @route  GET /api/match/:targetUserId/mutual-connections
 * @access Private
 */
export const getMutualConnections = asyncHandler(async (req, res) => {
  const meId = req.user.id;
  const { targetUserId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const [me, target] = await Promise.all([
    User.findById(meId).select("following").lean(),
    User.findById(targetUserId).select("following").lean(),
  ]);
  if (!target) return sendError(res, "User not found", 404);

  const targetFollowingSet = new Set((target.following || []).map((id) => id.toString()));
  const mutualIds = (me.following || []).map((id) => id.toString()).filter((id) => targetFollowingSet.has(id));

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const pageIds = mutualIds.slice(skip, skip + parseInt(limit));

  const users = await User.find({ _id: { $in: pageIds } })
    .select("_id username profile_pic_url")
    .lean();
  // $in doesn't preserve order — re-sort to match pageIds so pagination
  // stays stable/deterministic across page requests.
  const byId = new Map(users.map((u) => [u._id.toString(), u]));
  const ordered = pageIds.map((id) => byId.get(id)).filter(Boolean);

  sendPaginated(res, ordered, mutualIds.length, parseInt(page), parseInt(limit), "Mutual connections fetched");
});
