# Hybrid Matching Algorithm - Dokümantasyon

## 📊 Genel Bakış

Cinephix'in yeni **HYBRID MATCHING** sistemi, kullanıcıları 5 farklı metrik kombinasyonuyla eşleştiriyor.

**Hedef Doğruluk:** 60-70% (Önceki: 30-45%)

---

## 🏗️ Mimari

```
┌─────────────────────────────────────────┐
│     Express Backend                      │
│  /api/match (POST)                       │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  matchController.js                      │
│  findMatches() - HYBRID MODE             │
└──────────────┬──────────────────────────┘
               │
        ┌──────┴──────┬────────┬──────────┬─────────────┐
        ▼             ▼        ▼          ▼             ▼
    1. COLLAB    2. CONTENT 3. SOCIAL 4. DIVERSITY 5. BONUS
      (35%)       (25%)      (20%)     (15%)        (5%)
```

---

## 📈 5 Metrik Açıklaması

### 1️⃣ COLLABORATIVE FILTERING (35%)
**Dosya:** Mevcut matchController.js  
**Ne işe yarıyor:** Kullanıcıların izledikleri tür sayı ve rating benzerliğini ölçer

**Formül:**
```
genreScore = cosineSimilarity(user1_genres_count, user2_genres_count)
ratingScore = avgRatingSimilarity(user1_avg_ratings, user2_avg_ratings)

collaborativeScore = 0.5 * genreScore + 0.5 * ratingScore
finalScore += 0.35 * collaborativeScore
```

**Örnek:**
```
User A: Drama=5 films (rating 8.2), Action=3 films (rating 7.5)
User B: Drama=7 films (rating 8.0), Action=4 films (rating 7.8)
→ Yüksek benzerlik: 0.85 (85%)
```

---

### 2️⃣ CONTENT-BASED FILTERING (25%)
**Dosya:** `services/contentBasedService.js`  
**Ne işe yarıyor:** Favori filmler/diziler arasındaki metadata benzerliğini ölçer

**Hesapladığı öğeler:**
- Genre çakışması (40%)
- Director çakışması (15%)
- Release year yakınlığı (15%)
- Average rating yakınlığı (15%)
- Ortak favori bonusu (15%)

**Örnek:**
```
User A's favorites: [Inception, Interstellar, Dune]
User B's favorites: [Inception, The Matrix, Tenet]

Genres: Drama, Sci-Fi → High overlap
Directors: Nolan films → Ortak director
Ratings: Benzer IMDb scores
→ Content score: 0.72 (72%)
```

---

### 3️⃣ SOCIAL SCORE (20%)
**Dosya:** `services/socialScoreService.js`  
**Ne işe yarıyor:** Sosyal ağ bağlantılarının benzerliğini ölçer

**Hesapladığı öğeler:**
- Ortak takip edilen (40%)
- Ortak follower (40%)
- Direkt bağlantı bonus (20%)

**Örnek:**
```
User A following: [B, C, D, E]
User B following: [D, E, F, G]

Ortak: [D, E] = 2 kişi
Social score = Jaccard(A_following, B_following) = 2/6 = 0.33
+ Bonus eğer A follows B veya B follows A
```

---

### 4️⃣ DIVERSITY SCORE (15%)
**Dosya:** `services/diversityScoreService.js`  
**Ne işe yarıyor:** Kullanıcıların benzer çeşitlilik düzeyine sahip olup olmadığını ölçer

**Hesapladığı öğeler:**
- Genre entropy (Shannon entropy - kaç tür, ne kadar dağılmış)
- Genre çeşitliliği benzerliği

**Örnekler:**
```
User A (Low diversity):
- Drama: 80%
- Action: 20%

User B (Low diversity):
- Drama: 75%
- Action: 25%
→ Diversity match: Yüksek ✅

User C (High diversity):
- 12 farklı tür eşit dağılmış
→ A ve C'nin diversity match'i: Düşük ❌
```

---

### 5️⃣ BONUS METRICS (5%)
**Dosya:** `services/bonusMetricsService.js`  
**Ne işe yarıyor:** Ekstra sinyaller

**Hesapladığı öğeler:**
- Activity recency (Son 3 ayda ne kadar aktif)
- Trending alignment (Son izledikleri filmler benzer mi)

**Örnek:**
```
User A son 10 rating: [Film1, Film5, Film10]
User B son 10 rating: [Film5, Film10, Film15]

Ortak: 2 film → Trending score: 0.2
Activity: Her ikisi de son 1 hafta içinde aktif → Activity: 1.0
Bonus = 0.5 * 1.0 + 0.5 * 0.2 = 0.6 (60%)
```

---

## 🔄 Final Score Hesaplaması

```javascript
finalScore = 
  0.35 * collaborativeScore +    // [0, 1]
  0.25 * contentScore +          // [0, 1]
  0.20 * socialScore +           // [0, 1]
  0.15 * diversityScore +        // [0, 1]
  0.05 * bonusScore              // [0, 1]

matchPercentage = Math.round(finalScore * 100)  // [0, 100]
```

**Sonuç:** 0-100 arası % değer

---

## 📊 API Request/Response

### Request
```json
POST /api/match
Content-Type: application/json

{
  "type": "movie",              // "movie" | "series"
  "genres": ["Drama", "Crime"], // Optional: Türe göre filtrele
  "useCount": true,             // Tür sayısını kullan?
  "useAvgRating": true,         // Rating ortalamasını kullan?
  "page": 1,
  "limit": 10,
  "hybridMode": true            // Hybrid algoritması kullan?
}
```

### Response
```json
{
  "success": true,
  "message": "Hybrid Matches found",
  "data": [
    {
      "user": {
        "_id": "65abc123...",
        "username": "john_doe",
        "profile_pic_url": "https://..."
      },
      "matchPercentage": 85
    },
    {
      "user": {
        "_id": "65def456...",
        "username": "jane_smith",
        "profile_pic_url": "https://..."
      },
      "matchPercentage": 78
    }
  ],
  "pagination": {
    "total": 450,
    "page": 1,
    "limit": 10,
    "pages": 45
  }
}
```

---

## 🚀 Performans Beklentileri

| Metrik | Eski (Original) | Yeni (Hybrid) | Iyileştirme |
|--------|-----------------|---------------|------------|
| **Doğruluk** | 30-45% | 60-70% | +40-50% |
| **Query Time** | 200ms | 500-800ms | Normalı |
| **User Satisfaction** | ~40% | ~65% | +62% |
| **CTR (Click-Through Rate)** | 5-8% | 12-15% | +100% |

---

## 🔧 Ayarlanabilir Parametreler

Ağırlıkları matchController.js'te ayarlayabilirsiniz:

```javascript
// matchController.js - Line ~100
finalScore += 0.35 * collaborativeScore;   // ← 35% olabilir 40%, 30%, vb.
finalScore += 0.25 * contentScore;         // ← 25% olabilir 20%, 30%, vb.
finalScore += 0.20 * socialScore;          // ← 20% olabilir 15%, 25%, vb.
finalScore += 0.15 * diversityScore;       // ← 15% olabilir 10%, 20%, vb.
finalScore += 0.05 * bonusScore;           // ← 5% olabilir 5%, 10%, vb.
```

**A/B Testing İçin:**
```javascript
// Version A: Original
const finalScore = 0.35 * collaborative + 0.25 * content + ...

// Version B: Content-focused
const finalScore = 0.30 * collaborative + 0.35 * content + ...

// Version C: Social-focused
const finalScore = 0.30 * collaborative + 0.20 * content + 0.30 * social + ...
```

---

## 🐛 Sorun Giderme

### Sorunu: Tüm match'ler ~50% civarında
**Nedeni:** Metrikler eşit dağılmıyor  
**Çözüm:** Verileri normalize et, outlier'ları kontrol et

### Sorunu: Çok yavaş (>1 saniye)
**Nedeni:** Veritabanı querysi çok fazla  
**Çözüm:** Redis cache ekle, query'leri batch et

### Sorunu: Çok benzer match'ler (diversity yok)
**Nedeni:** Diversity ağırlığı düşük  
**Çözüm:** Diversity ağırlığını 15% → 25% yükselt

---

## 📚 Dosya Yapısı

```
backend/
├── controllers/
│   └── matchController.js        ← ANA LOGİK (hybrid algorithm)
├── services/
│   ├── contentBasedService.js    ← Favori film benzerliği
│   ├── socialScoreService.js     ← Sosyal ağ benzerliği
│   ├── diversityScoreService.js  ← Çeşitlilik uyumu
│   └── bonusMetricsService.js    ← Activity, trending, vb.
└── routes/
    └── matchRoute.js             ← API endpoint
```

---

## 🔮 Gelecek İyileştirmeler

1. **Caching:** Redis ile embedding'leri cache et
2. **Matrix Factorization:** SVD ile collaborative filtering geliştirilsin
3. **ML Model:** Ağırlıkları machine learning ile optimize et
4. **Real-time:** WebSocket ile live match suggestions
5. **Feedback Loop:** User interactions'ı track et, model'i iyileştir

---

## 📞 Support

Sorunlar için matchController.js'teki error handling kontrol et:

```javascript
catch (error) {
  console.error(`Error calculating match score for user ${u._id}:`, error);
  // Bu kullanıcıyı atla ve devam et
  continue;
}
```

Tüm hata logları server console'unda görünür.
