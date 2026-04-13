/**
 * Social Score Service
 * Calculates: Mutual following, shared followers, etc.
 */

import User from "../models/User.js";

/**
 * Number of people two users both follow
 * Example: A follows [B, C, D], Followers [E, F]
 *          C follows [B, A, G], Followers [D, H]
 *          Common: [B] → 1 person
 */
const calculateMutualFollowing = (following1, following2) => {
  if (!following1 || !following2 || following1.length === 0 || following2.length === 0) {
    return 0;
  }

  const set1 = new Set(following1.map((id) => id.toString()));
  const set2 = new Set(following2.map((id) => id.toString()));

  const intersection = [...set1].filter((x) => set2.has(x)).length;
  const union = new Set([...set1, ...set2]).size;

  return union === 0 ? 0 : intersection / union; // Jaccard similarity
};

/**
 * Users with common followers
 * In other words: People who follow both of them
 */
const calculateMutualFollowers = (followers1, followers2) => {
  if (!followers1 || !followers2 || followers1.length === 0 || followers2.length === 0) {
    return 0;
  }

  const set1 = new Set(followers1.map((id) => id.toString()));
  const set2 = new Set(followers2.map((id) => id.toString()));

  const intersection = [...set1].filter((x) => set2.has(x)).length;
  const union = new Set([...set1, ...set2]).size;

  return union === 0 ? 0 : intersection / union;
};

/**
 * How close two users are in the social network
 * 
 * @param {String} userId1
 * @param {String} userId2
 * @returns {Number} Score between 0-1
 */
export const calculateSocialScore = async (userId1, userId2) => {
  try {
    const user1 = await User.findById(userId1)
      .select("following followers")
      .lean();

    const user2 = await User.findById(userId2)
      .select("following followers")
      .lean();

    if (!user1 || !user2) return 0;

    let socialScore = 0;

    // 1. Mutual following (40%)
    const mutualFollowingScore = calculateMutualFollowing(
      user1.following,
      user2.following
    );
    socialScore += mutualFollowingScore * 0.4;

    // 2. Mutual followers (40%)
    const mutualFollowersScore = calculateMutualFollowers(
      user1.followers,
      user2.followers
    );
    socialScore += mutualFollowersScore * 0.4;

    // 3. BONUS: If one follows the other (20%)
    const user1FollowsUser2 = (user1.following || [])
      .map((id) => id.toString())
      .includes(userId2);

    const user2FollowsUser1 = (user2.following || [])
      .map((id) => id.toString())
      .includes(userId1);

    if (user1FollowsUser2 || user2FollowsUser1) {
      socialScore += 0.2; // Direct connection exists
    } else if (
      (user1.followers && user1.followers.length > 0) ||
      (user2.followers && user2.followers.length > 0)
    ) {
      // Scale based on mutual connections
      const avgFollowers =
        ((user1.followers?.length || 0) + (user2.followers?.length || 0)) / 2;
      const connectionStrength = Math.min(1, avgFollowers / 100); // Max 100 followers
      socialScore += connectionStrength * 0.15;
    }

    return Math.min(1, socialScore);
  } catch (error) {
    return 0;
  }
};

/**
 * Network distance: How many "hops" apart they are (1st, 2nd degree)
 * This calculation can be expensive, optional
 */
export const calculateNetworkDistance = async (userId1, userId2) => {
  try {
    const user1 = await User.findById(userId1)
      .select("following followers")
      .lean();

    if (!user1) return 3; // "3+ hops" away

    const following1Set = new Set(
      (user1.following || []).map((id) => id.toString())
    );
    const followers1Set = new Set(
      (user1.followers || []).map((id) => id.toString())
    );

    // Direct connection (1st degree)
    if (
      following1Set.has(userId2) ||
      followers1Set.has(userId2)
    ) {
      return 1;
    }

    // 2nd degree (mutual connection)
    if (
      (user1.following || []).length > 0 ||
      (user1.followers || []).length > 0
    ) {
      // TODO: 2nd degree check can be done here
      return 2;
    }

    // 3+ degree (no connection)
    return 3;
  } catch (error) {

    return 3;
  }
};

export default {
  calculateSocialScore,
  calculateNetworkDistance,
};
