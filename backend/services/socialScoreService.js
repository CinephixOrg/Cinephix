/**
 * Social Score Service
 * Hesaplar: Ortak takip edilen insanlar, ortak followers, vb.
 */

import User from "../models/User.js";

/**
 * İki kullanıcının ortak takip ettikleri kişi sayısı
 * Örnek: A takip ediyor [B, C, D], Takip ediliyor [E, F]
 *        C takip ediyor [B, A, G], Takip ediliyor [D, H]
 *        Ortak: [B] → 1 kişi
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
 * İki kullanıcının ortak follower'ları
 * Yani: Ikisini de takip eden kişiler
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
 * İki kullanıcının social ağında ne kadar yakın olduğu
 * 
 * @param {String} userId1
 * @param {String} userId2
 * @returns {Number} 0-1 arası score
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

    // 1. Ortak takip edilen (40%)
    const mutualFollowingScore = calculateMutualFollowing(
      user1.following,
      user2.following
    );
    socialScore += mutualFollowingScore * 0.4;

    // 2. Ortak follower (40%)
    const mutualFollowersScore = calculateMutualFollowers(
      user1.followers,
      user2.followers
    );
    socialScore += mutualFollowersScore * 0.4;

    // 3. BONUS: Biri diğerini takip ediyorsa (20%)
    const user1FollowsUser2 = (user1.following || [])
      .map((id) => id.toString())
      .includes(userId2);

    const user2FollowsUser1 = (user2.following || [])
      .map((id) => id.toString())
      .includes(userId1);

    if (user1FollowsUser2 || user2FollowsUser1) {
      socialScore += 0.2; // Direkt bağlantı var
    } else if (
      (user1.followers && user1.followers.length > 0) ||
      (user2.followers && user2.followers.length > 0)
    ) {
      // Mutual connections'a göre scale et
      const avgFollowers =
        ((user1.followers?.length || 0) + (user2.followers?.length || 0)) / 2;
      const connectionStrength = Math.min(1, avgFollowers / 100); // Max 100 followers
      socialScore += connectionStrength * 0.15;
    }

    return Math.min(1, socialScore);
  } catch (error) {
    console.error("Social score calculation error:", error);
    return 0;
  }
};

/**
 * Network distance: Kaç "hop" uzaklıkta olduğu (1st, 2nd degree)
 * Bu hesaplama pahalı olabilir, opsiyonel
 */
export const calculateNetworkDistance = async (userId1, userId2) => {
  try {
    const user1 = await User.findById(userId1)
      .select("following followers")
      .lean();

    if (!user1) return 3; // "3+ hops" uzak

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
      // TODO: Burada 2nd degree check yapılabilir
      return 2;
    }

    // 3+ degree (no connection)
    return 3;
  } catch (error) {
    console.error("Network distance calculation error:", error);
    return 3;
  }
};

export default {
  calculateSocialScore,
  calculateNetworkDistance,
};
