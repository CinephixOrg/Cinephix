/**
 * HYBRID MATCHING ALGORITHM - TEST FILE
 * 
 * Çalıştırmak için:
 * node backend/scripts/test_hybrid_matching.js
 * 
 * Veya MongoDB'de direkt:
 * 1. Backend'i başlat: npm start
 * 2. Postman'de test et: POST http://localhost:5000/api/match
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '../.env') });

import User from '../models/User.js';
import Rating from '../models/Rating.js';
import { 
  calculateFavoriteOverlap 
} from '../services/contentBasedService.js';
import { calculateSocialScore } from '../services/socialScoreService.js';
import { 
  calculateDiversityScore,
  calculateWatchActivityScore 
} from '../services/diversityScoreService.js';
import { 
  calculateActivityRecency,
  calculateTrendingAlignment 
} from '../services/bonusMetricsService.js';

const MONGO_URI = process.env.MONGO_URI;

async function testHybridMatching() {
  try {
    // Veritabanına bağlan
    await mongoose.connect(MONGO_URI, { dbName: 'cleaned_db' });
    console.log('✅ MongoDB bağlantısı kuruldu\n');

    // Test için 2 kullanıcı al
    const users = await User.find().limit(2).lean();
    
    if (users.length < 2) {
      console.log('❌ Test için en az 2 kullanıcı gerekli');
      process.exit(1);
    }

    const user1 = users[0];
    const user2 = users[1];

    console.log(`📊 TEST: ${user1.username} ↔️ ${user2.username}\n`);
    console.log('=' .repeat(60));

    // ===== COLLABORATVE SCORE =====
    console.log('\n1️⃣  COLLABORATIVE FILTERING (35%)');
    console.log('-' .repeat(60));

    const myGraph1 = user1.movieCineGraph || {};
    const myGraph2 = user2.movieCineGraph || {};

    const genreScores = {};
    let totalGenreScore = 0, genreCount = 0;

    for (const genre in myGraph1) {
      if (myGraph2[genre]) {
        const count1 = myGraph1[genre].count || 0;
        const count2 = myGraph2[genre].count || 0;
        const sim = Math.min(count1, count2) / Math.max(count1, count2);
        genreScores[genre] = sim;
        totalGenreScore += sim;
        genreCount++;
      }
    }

    const avgGenreScore = genreCount > 0 ? totalGenreScore / genreCount : 0;
    const collaborativeScore = avgGenreScore * 0.35;

    console.log(`   Ortak türler: ${genreCount}`);
    console.log(`   Ortalama benzerlik: ${(avgGenreScore * 100).toFixed(1)}%`);
    console.log(`   Final collaborative score: ${(collaborativeScore * 100).toFixed(1)}%`);

    // ===== CONTENT-BASED SCORE =====
    console.log('\n2️⃣  CONTENT-BASED FILTERING (25%)');
    console.log('-' .repeat(60));

    const contentScore = await calculateFavoriteOverlap(user1._id, user2._id, 'movie');
    const contentScoreFinal = contentScore * 0.25;

    console.log(`   Favori film benzerliği: ${(contentScore * 100).toFixed(1)}%`);
    console.log(`   Final content score: ${(contentScoreFinal * 100).toFixed(1)}%`);

    // ===== SOCIAL SCORE =====
    console.log('\n3️⃣  SOCIAL SCORE (20%)');
    console.log('-' .repeat(60));

    const socialScore = await calculateSocialScore(user1._id, user2._id);
    const socialScoreFinal = socialScore * 0.20;

    console.log(`   Sosyal ağ benzerliği: ${(socialScore * 100).toFixed(1)}%`);
    console.log(`   Final social score: ${(socialScoreFinal * 100).toFixed(1)}%`);

    // ===== DIVERSITY SCORE =====
    console.log('\n4️⃣  DIVERSITY SCORE (15%)');
    console.log('-' .repeat(60));

    const diversityScore = await calculateDiversityScore(user1._id, user2._id, 'movie');
    const diversityScoreFinal = diversityScore * 0.15;

    console.log(`   Çeşitlilik uyumu: ${(diversityScore * 100).toFixed(1)}%`);
    console.log(`   Final diversity score: ${(diversityScoreFinal * 100).toFixed(1)}%`);

    // ===== BONUS METRICS =====
    console.log('\n5️⃣  BONUS METRICS (5%)');
    console.log('-' .repeat(60));

    const activityRecency = await calculateActivityRecency(user2._id);
    const trendingAlignment = await calculateTrendingAlignment(user1._id, user2._id);
    const bonusScore = (0.5 * activityRecency + 0.5 * trendingAlignment) * 0.05;

    console.log(`   Activity recency: ${(activityRecency * 100).toFixed(1)}%`);
    console.log(`   Trending alignment: ${(trendingAlignment * 100).toFixed(1)}%`);
    console.log(`   Final bonus score: ${(bonusScore * 100).toFixed(1)}%`);

    // ===== FINAL SCORE =====
    console.log('\n' + '=' .repeat(60));
    console.log('🎯 FINAL HYBRID SCORE');
    console.log('=' .repeat(60));

    const finalScore = 
      collaborativeScore + 
      contentScoreFinal + 
      socialScoreFinal + 
      diversityScoreFinal + 
      bonusScore;

    const matchPercentage = Math.round(finalScore * 100);

    console.log(`
   ✅ MATCH PERCENTAGE: ${matchPercentage}%
    
   Bileşenler:
   • Collaborative:  ${(collaborativeScore * 100).toFixed(1)}%
   • Content:        ${(contentScoreFinal * 100).toFixed(1)}%
   • Social:         ${(socialScoreFinal * 100).toFixed(1)}%
   • Diversity:      ${(diversityScoreFinal * 100).toFixed(1)}%
   • Bonus:          ${(bonusScore * 100).toFixed(1)}%
   ─────────────────────────
   TOPLAM:          ${matchPercentage}%
    `);

    // ===== INTERPRETATION =====
    console.log('\n📋 YORUM:');
    if (matchPercentage >= 80) {
      console.log('   🔥 Mükemmel match! Çok benzer zevklere sahipler.');
    } else if (matchPercentage >= 60) {
      console.log('   ✅ İyi match. Ortak ilgileri var.');
    } else if (matchPercentage >= 40) {
      console.log('   🤔 Orta seviye match. Bazı ortak noktalar var.');
    } else {
      console.log('   ❌ Düşük uyum. Zevkleri oldukça farklı.');
    }

    console.log('\n' + '=' .repeat(60));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Bağlantı kapatıldı');
    process.exit(0);
  }
}

testHybridMatching();
