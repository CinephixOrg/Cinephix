/**
 * Diversity Score Service
 * Hesaplar: Kullanıcılar ne kadar farklı tür izlediği
 * 
 * Amaç: Sadece aynı türü izleyen insanlarla match etmesin,
 * çeşitli zevkleri olanları tercih etsin
 */

import User from "../models/User.js";

/**
 * Genre distribution entropy hesapla
 * Düşük entropy = Sadece 1-2 tür → Low diversity
 * Yüksek entropy = Birçok türe dağılmış → High diversity
 * 
 * Formula: Shannon Entropy = -Σ (p_i * log(p_i))
 */
const calculateGenreDiversityEntropy = (cineGraph) => {
  if (!cineGraph || Object.keys(cineGraph).length === 0) {
    return 0;
  }

  // Genre count'larını al
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
  return maxEntropy === 0 ? 0 : entropy / maxEntropy; // 0-1 arası
};

/**
 * Gini coefficient: Genre dağılımının ne kadar dengesiz olduğu
 * 0 = Mükemmel denge (tüm türlere eşit film)
 * 1 = Tam dengesiz (sadece 1 türe film)
 */
const calculateGenreGiniCoefficient = (cineGraph) => {
  if (!cineGraph || Object.keys(cineGraph).length === 0) {
    return 1; // Hiç veri yok = maksimum dengesizlik
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
 * Genre farklılığını hesapla
 * İki kullanıcının izlediği türlerin birbirinden farklı olması
 */
const calculateGenreDifference = (cineGraph1, cineGraph2) => {
  if (!cineGraph1 || !cineGraph2) return 0.5; // Neutral

  const genres1 = new Set(Object.keys(cineGraph1));
  const genres2 = new Set(Object.keys(cineGraph2));

  // Fark (symmetric difference)
  const difference = new Set([
    ...genres1.values(),
    ...genres2.values(),
  ].filter((g) => !genres1.has(g) || !genres2.has(g)));

  const union = new Set([...genres1, ...genres2]);

  if (union.size === 0) return 0;

  return difference.size / union.size; // 0-1
};

/**
 * ANA FONKSİYON: İki kullanıcının çeşitliliğinin ne kadar uyumlu olduğu
 * 
 * Amaç: Benzer çeşitliliğe sahip insanları match etmek
 * Örnek:
 *  - User A: Drama (80%), Action (20%) → Low diversity
 *  - User B: Drama (80%), Action (20%) → Low diversity
 *  - Uyum: Yüksek (ikisi de selective)
 *
 *  - User C: 10 farklı tür eşit → High diversity
 *  - A ve C: Düşük uyum (çok farklı)
 * 
 * @param {String} userId1
 * @param {String} userId2
 * @param {String} type - "movie" veya "series"
 * @returns {Number} 0-1 arası score
 */
export const calculateDiversityScore = async (userId1, userId2, type = "movie") => {
  try {
    const cineGraphField = type === "movie" ? "movieCineGraph" : "seriesCineGraph";

    const user1 = await User.findById(userId1).select(cineGraphField).lean();
    const user2 = await User.findById(userId2).select(cineGraphField).lean();

    if (!user1 || !user2) return 0.5;

    const cineGraph1 = user1[cineGraphField] || {};
    const cineGraph2 = user2[cineGraphField] || {};

    // 1. HER KULLANICININ DIVERSITY'SİNİ HESAPLA
    const entropy1 = calculateGenreDiversityEntropy(cineGraph1);
    const entropy2 = calculateGenreDiversityEntropy(cineGraph2);

    // Entropy farkı (ne kadar benzer diversity'ye sahip)
    const entropyDifference = Math.abs(entropy1 - entropy2);
    const entropyAlignment = 1 - Math.min(1, entropyDifference);

    // 2. GENRE FARKLILIĞINI HESAPLA
    const genreDifference = calculateGenreDifference(cineGraph1, cineGraph2);

    // 3. DIVERSITY SCORE HESAPLA
    // Formula:
    // - Benzer diversity level'a sahip olması iyi (50%)
    // - Farklı türleri birbirini tamamlaması iyi (50%)

    const diversityScore = 0.5 * entropyAlignment + 0.5 * genreDifference;

    return Math.min(1, diversityScore);
  } catch (error) {
    return 0.5; // Neutral
  }
};

/**
 * Total watchcount farklılığı
 * Casual watcher ile cinephile'in eşleşmesi pek iyi değil
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

    // Watch activity ratio (1 ile 10 arası normalize)
    const ratio = Math.max(totalCount1, totalCount2) / Math.min(totalCount1, totalCount2);

    // Ratio'nun 3'e kadar benzer kabul et (farklıysa score azal)
    // 1.0 = identical activity → 1.0 score
    // 3.0 = 3x different → 0.5 score
    // 10+ = çok farklı → 0.0 score

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
