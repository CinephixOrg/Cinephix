/**
 * Bonus Metrics Service
 * Ek skorlar: trending alignment, recency, vb.
 */

import User from "../models/User.js";
import Rating from "../models/Rating.js";

/**
 * Son 3 ay içinde izlenen film/dizi sayısı
 * "Aktif" kullanıcı bulmak için
 */
export const calculateActivityRecency = async (userId) => {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Son 3 ayda kaç rating verildi
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
 * İki kullanıcının son ratings'inin benzerliği
 * Yani: Son zamanda benzer filmler izliyorlar mı?
 */
export const calculateTrendingAlignment = async (userId1, userId2, limit = 10) => {
  try {
    // Her kullanıcının son 10 rating'ini al
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

    // Ortak content (null values'ı filter et)
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
 * Zaman-tabanlı ağırlıklandırma
 * Yeni verilen puanlar daha ağır sayılıyor
 * 
 * Örnek: Rating1 = 1 hafta önce (weight = 1.0)
 *        Rating2 = 3 ay önce (weight = 0.5)
 */
export const calculateRecencyWeight = (createdAtDate) => {
  const now = new Date();
  const daysDiff = (now - new Date(createdAtDate)) / (1000 * 60 * 60 * 24);

  // 7 gün içinde = 1.0 weight
  // 30 gün = 0.7 weight
  // 180 gün = 0.3 weight
  // 365+ gün = 0.1 weight

  if (daysDiff <= 7) return 1.0;
  if (daysDiff <= 30) return 0.7;
  if (daysDiff <= 90) return 0.5;
  if (daysDiff <= 180) return 0.3;
  return 0.1;
};

/**
 * "Ne kadar match'ler zaten bağlı?"
 * Çok match'i olan insanla eşleştiğinde score az sayılır
 * (Daha az tanınan birileriyle match etmek daha iyi)
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
 * "Novelty" skorunda bugüne kadar match edilmedikleri kişilerle başlıyor
 */
export const calculateNoveltyBonus = async (userId1, userId2) => {
  try {
    // TODO: Eğer match history table'ı varsa bunu kontrol edebiliriz
    // Şimdilik 0.5 (neutral) döndürelim

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
