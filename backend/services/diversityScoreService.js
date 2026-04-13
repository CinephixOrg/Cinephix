/**
 * Diversity Score Service
 * Calculates: How diversely users watch different genres
 * 
 * Purpose: Don't match with people who watch only the same genre,
 * prefer people with diverse tastes
 */

import User from "../models/User.js";

/**
 * Calculate genre distribution entropy
 * Low entropy = Only 1-2 genres → Low diversity
 * High entropy = Spread across many genres → High diversity
 * 
 * Formula: Shannon Entropy = -Σ (p_i * log(p_i))
 */
const calculateGenreDiversityEntropy = (cineGraph) => {
  if (!cineGraph || Object.keys(cineGraph).length === 0) {
    return 0;
  }

  // Get genre counts
  const genreCounts = Object.values(cineGraph).map((g) => g.count || 0);
  const totalCount = genreCounts.reduce((a, b) => a + b, 0);

  if (totalCount === 0) return 0;

  // Her genre'in probability'sini hesapla
  const probabilities = genreCounts.map((count) => count / totalCount);

  // Shannon entropy
  let entropy = 0;
  for (const p of probabilities) {
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  // Normalize (max entropy = log2(number of genres))
  const maxEntropy = Math.log2(genreCounts.length);
  return maxEntropy === 0 ? 0 : entropy / maxEntropy; // Between 0-1
};

/**
 * Gini coefficient: How unbalanced genre distribution is
 * 0 = Perfect balance (equal movies across all genres)
 * 1 = Completely unbalanced (movies only in 1 genre)
 */
const calculateGenreGiniCoefficient = (cineGraph) => {
  if (!cineGraph || Object.keys(cineGraph).length === 0) {
    return 1; // No data = maximum imbalance
  }

  const genreCounts = Object.values(cineGraph)
    .map((g) => g.count || 0)
    .sort((a, b) => a - b);

  const n = genreCounts.length;
  const sum = genreCounts.reduce((a, b) => a + b, 0);

  if (sum === 0) return 1;

  let gini = 0;
  for (let i = 0; i < n; i++) {
    gini += (2 * (i + 1) - n - 1) * genreCounts[i];
  }

  return gini / (n * sum);
};

/**
 * Calculate genre difference
 * How different the genres watched by two users are from each other
 */
const calculateGenreDifference = (cineGraph1, cineGraph2) => {
  if (!cineGraph1 || !cineGraph2) return 0.5; // Neutral

  const genres1 = new Set(Object.keys(cineGraph1));
  const genres2 = new Set(Object.keys(cineGraph2));

  // Difference (symmetric difference)
  const difference = new Set([
    ...genres1.values(),
    ...genres2.values(),
  ].filter((g) => !genres1.has(g) || !genres2.has(g)));

  const union = new Set([...genres1, ...genres2]);

  if (union.size === 0) return 0;

  return difference.size / union.size; // 0-1
};

/**
 * MAIN FUNCTION: How compatible the diversity of two users is
 * 
 * Purpose: Match people with similar diversity levels
 * Example:
 *  - User A: Drama (80%), Action (20%) → Low diversity
 *  - User B: Drama (80%), Action (20%) → Low diversity
 *  - Compatibility: High (both are selective)
 *
 *  - User C: 10 different genres equally → High diversity
 *  - A and C: Low compatibility (very different)
 * 
 * @param {String} userId1
 * @param {String} userId2
 * @param {String} type - "movie" or "series"
 * @returns {Number} Score between 0-1
 */
export const calculateDiversityScore = async (userId1, userId2, type = "movie") => {
  try {
    const cineGraphField = type === "movie" ? "movieCineGraph" : "seriesCineGraph";

    const user1 = await User.findById(userId1).select(cineGraphField).lean();
    const user2 = await User.findById(userId2).select(cineGraphField).lean();

    if (!user1 || !user2) return 0.5;

    const cineGraph1 = user1[cineGraphField] || {};
    const cineGraph2 = user2[cineGraphField] || {};

    // 1. CALCULATE EACH USER'S DIVERSITY
    const entropy1 = calculateGenreDiversityEntropy(cineGraph1);
    const entropy2 = calculateGenreDiversityEntropy(cineGraph2);

    // Entropy difference (how similar diversity they have)
    const entropyDifference = Math.abs(entropy1 - entropy2);
    const entropyAlignment = 1 - Math.min(1, entropyDifference);

    // 2. CALCULATE GENRE DIFFERENCE
    const genreDifference = calculateGenreDifference(cineGraph1, cineGraph2);

    // 3. CALCULATE DIVERSITY SCORE
    // Formula:
    // - Similar diversity level is good (50%)
    // - Different genres complement each other is good (50%)

    const diversityScore = 0.5 * entropyAlignment + 0.5 * genreDifference;

    return Math.min(1, diversityScore);
  } catch (error) {
    return 0.5; // Neutral
  }
};

/**
 * Total watchcount difference
 * A casual watcher matching with a cinephile isn't ideal
 */
export const calculateWatchActivityScore = async (userId1, userId2, type = "movie") => {
  try {
    const cineGraphField = type === "movie" ? "movieCineGraph" : "seriesCineGraph";

    const user1 = await User.findById(userId1).select(cineGraphField).lean();
    const user2 = await User.findById(userId2).select(cineGraphField).lean();

    if (!user1 || !user2) return 0.5;

    const cineGraph1 = user1[cineGraphField] || {};
    const cineGraph2 = user2[cineGraphField] || {};

    // Total watch count
    const totalCount1 = Object.values(cineGraph1).reduce(
      (sum, g) => sum + (g.count || 0),
      0
    );
    const totalCount2 = Object.values(cineGraph2).reduce(
      (sum, g) => sum + (g.count || 0),
      0
    );

    if (totalCount1 === 0 || totalCount2 === 0) return 0.5;

    // Watch activity ratio (normalize between 1-10)
    const ratio = Math.max(totalCount1, totalCount2) / Math.min(totalCount1, totalCount2);

    // Ratio up to 3 is considered similar (lower if too different)
    // 1.0 = identical activity → 1.0 score
    // 3.0 = 3x different → 0.5 score
    // 10+ = very different → 0.0 score

    if (ratio <= 1) return 1.0;
    if (ratio >= 10) return 0.0;

    return 1 - (ratio - 1) / 9; // Linear interpolation
  } catch (error) {
    return 0.5;
  }
};

export default {
  calculateDiversityScore,
  calculateWatchActivityScore,
  calculateGenreDiversityEntropy,
  calculateGenreGiniCoefficient,
};
