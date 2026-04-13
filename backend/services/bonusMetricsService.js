/**
 * Bonus Metrics Service
 * Additional scores: trending alignment, recency, etc.
 */

import User from "../models/User.js";
import Rating from "../models/Rating.js";

/**
 * Number of movies/series watched in the last 3 months
 * Finding an "active" user to calculate bonus
 */
export const calculateActivityRecency = async (userId) => {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // How many ratings were given in the last 3 months
    const recentRatings = await Rating.countDocuments({
      user: userId,
      createdAt: { $gte: threeMonthsAgo },
    });

    // 0-20 rating = 0 score, 20+ rating = 1 score
    return Math.min(1, recentRatings / 20);
  } catch (error) {
    return 0.5;
  }
};

/**
 * Similarity between last ratings of two users
 * In other words: Are they watching similar movies recently?
 */
export const calculateTrendingAlignment = async (userId1, userId2, limit = 10) => {
  try {
    // Get last 10 ratings of each user
    const ratings1 = await Rating.find({ user: userId1 })
      .select("content")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const ratings2 = await Rating.find({ user: userId2 })
      .select("content")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    if (ratings1.length === 0 || ratings2.length === 0) return 0.5;

    // Shared content (filter null values)
    const set1 = new Set(
      ratings1
        .filter((r) => r.content)
        .map((r) => r.content.toString())
    );
    const set2 = new Set(
      ratings2
        .filter((r) => r.content)
        .map((r) => r.content.toString())
    );

    if (set1.size === 0 || set2.size === 0) return 0.5;

    const intersection = [...set1].filter((x) => set2.has(x)).length;
    const union = new Set([...set1, ...set2]).size;

    return union === 0 ? 0 : intersection / union;
  } catch (error) {
    return 0.5;
  }
};

/**
 * Time-based weighting
 * Recently given ratings are weighted more heavily
 * 
 * Example: Rating1 = 1 week ago (weight = 1.0)
 *          Rating2 = 3 months ago (weight = 0.5)
 */
export const calculateRecencyWeight = (createdAtDate) => {
  const now = new Date();
  const daysDiff = (now - new Date(createdAtDate)) / (1000 * 60 * 60 * 24);

  // Within 7 days = 1.0 weight
  // 30 days = 0.7 weight
  // 180 days = 0.3 weight
  // 365+ days = 0.1 weight

  if (daysDiff <= 7) return 1.0;
  if (daysDiff <= 30) return 0.7;
  if (daysDiff <= 90) return 0.5;
  if (daysDiff <= 180) return 0.3;
  return 0.1;
};

/**
 * "How many mutual matches do they already have?"
 * Matching with someone who has many matches is scored lower
 * (It's better to match with less known people)
 */
export const calculateMutualConnectionsCount = async (userId1, userId2) => {
  try {
    const user1 = await User.findById(userId1)
      .select("following followers")
      .lean();

    const user2 = await User.findById(userId2)
      .select("following followers")
      .lean();

    if (!user1 || !user2) return 0;

    // Ortak followers
    const followers1 = new Set(
      (user1.followers || []).map((id) => id.toString())
    );
    const followers2 = new Set(
      (user2.followers || []).map((id) => id.toString())
    );

    const mutualFollowers = [...followers1].filter((x) =>
      followers2.has(x)
    ).length;

    // Ortak following
    const following1 = new Set(
      (user1.following || []).map((id) => id.toString())
    );
    const following2 = new Set(
      (user2.following || []).map((id) => id.toString())
    );

    const mutualFollowing = [...following1].filter((x) =>
      following2.has(x)
    ).length;

    return Math.sqrt(mutualFollowers * mutualFollowing);
  } catch (error) {
    return 0;
  }
};

/**
 * "Novelty" score starts with people they haven't matched with yet
 */
export const calculateNoveltyBonus = async (userId1, userId2) => {
  try {
    // TODO: If we have a match history table, we can check this
    // For now, return 0.5 (neutral)

    return 0.5;
  } catch (error) {
    return 0.5;
  }
};

export default {
  calculateActivityRecency,
  calculateTrendingAlignment,
  calculateRecencyWeight,
  calculateMutualConnectionsCount,
  calculateNoveltyBonus,
};
