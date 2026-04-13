/**
 * Content-Based Filtering Service
 * Calculates: Similarity between favorite movies/series
 */

import User from "../models/User.js";



/**
 * Alternative: Simple overlap score (faster)
 * Only looks at the number of shared favorites
 */
export const calculateFavoriteOverlap = async (userId1, userId2, type = "movie") => {
  try {
    const favoriteField = type === "movie" ? "favoriteMovies" : "favoriteSeries";

    const user1 = await User.findById(userId1).select(favoriteField).lean();
    const user2 = await User.findById(userId2).select(favoriteField).lean();

    if (!user1 || !user2) return 0;

    const favorites1 = user1[favoriteField] || [];
    const favorites2 = user2[favoriteField] || [];

    if (favorites1.length === 0 || favorites2.length === 0) return 0;

    // Count of shared movies
    const set1 = new Set(favorites1.map((id) => id.toString()));
    const intersection = favorites2.filter((id) => set1.has(id.toString()))
      .length;

    // Jaccard similarity
    const union = new Set([
      ...favorites1.map((id) => id.toString()),
      ...favorites2.map((id) => id.toString()),
    ]).size;

    return union === 0 ? 0 : intersection / union;
  } catch (error) {
    return 0;
  }
};

export default {
  calculateFavoriteOverlap,
};
