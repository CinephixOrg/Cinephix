// models/User.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

// Bu sizin mevcut alt şemanız, dokunmuyoruz.
const WatchItemSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true }, // veya eğer id'ler string ise String
  itemType: { type: String, enum: ["movie", "series"], required: true },
  addedAt: { type: Date, default: Date.now },
});


const userSchema = new Schema({
  username: {
    type: String,
    required: [true, 'Username is required.'],
    unique: true,
    trim: true // Başındaki ve sonundaki boşlukları temizler
  },
  email: {
    type: String,
    required: [true, 'E-posta zorunludur.'],
    unique: true,
    match: [/.+\@.+\..+/, 'Lütfen geçerli bir e-posta adresi girin.'] // E-posta format kontrolü
  },
  password: {
    type: String,
    minlength: 6,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationCode: String,
  emailVerificationExpires: Date,
  passwordResetCode: String,
  passwordResetExpires: Date,
// --- YENİ ALANI BURAYA EKLE ---
  bio: {
    type: String,
    default: "",       // Varsayılan olarak boş bir string olsun
    maxlength: 250     // İsteğe bağlı: Maksimum karakter limiti
  },
  profile_pic_url: {
    type: String,
    default: "", // Varsayılan olarak boş bir string
  },
  visibility: {
    type: String,
    enum: ['public', 'private'],
    default: 'public'
  },
  // --- BİTİŞ ---

  accountTier: {
    type: String,
    enum: ['free', 'plus', 'premium', 'dev'],
    default: 'free'
  },
  tierUpdatedAt: {
    type: Date,
    default: Date.now
  },
  // Marks the single official Cinephix account (auto-posts trivia/tips/
  // polls/etc. to Medya via the officialContentService cron job) — a
  // separate concern from accountTier (billing/subscription), not
  // overloaded onto it, so tier-gating logic elsewhere is untouched.
  isOfficial: {
    type: Boolean,
    default: false,
  },
  watchlist: { type: [WatchItemSchema], default: [] }, // Bu alan sizde mevcuttu
  toWatchList: { type: [WatchItemSchema], default: [] },

  // --- YENİ EKLENEN TAKİP ALANLARI ---
  followers: [{
    type: Schema.Types.ObjectId,
    ref: 'User' // 'User' modeline referans veriyoruz
  }],
  following: [{
    type: Schema.Types.ObjectId,
    ref: 'User' // 'User' modeline referans veriyoruz
  }],
  favoriteMovies: [{
    type: Schema.Types.ObjectId,
    ref: 'Movie' // Sizin 'Movie' modelinizin adına referans
  }],
  favoriteSeries: [{
    type: Schema.Types.ObjectId,
    ref: 'Series' // Sizin 'Series' modelinizin adına referans
  }],
  movieCineGraph: {
  type: Map,
  of: {
    count: Number,
    ratedCount: { type: Number, default: 0 },
    avgRating: Number
  },
  default: {}
},
seriesCineGraph: {
  type: Map,
  of: {
    count: Number,
    ratedCount: { type: Number, default: 0 },
    avgRating: Number
  },
  default: {}
},
  // --- BİTİŞ ---

  // Daily-engagement streak, for the "streak" loyalty badge
  // (badgeController.js's bumpStreak/computeStreakBadge). `lastStreakDate`
  // is always truncated to a UTC calendar day (never a real timestamp) so
  // "was the user active yesterday vs. today" is a clean day-difference,
  // not a fragile <24h-elapsed check that a late-night vs. early-morning
  // action could break. `currentStreak` is only ever trusted after
  // checking `lastStreakDate` is today or yesterday — a streak with no
  // qualifying activity in the last 2 days has effectively decayed to 0,
  // but the stored number itself is only ever corrected lazily, on the
  // user's own next action, not by a cron job.
  currentStreak: { type: Number, default: 0 },
  lastStreakDate: { type: Date },

  // Single active "Currently Watching" status — a real explicit user
  // action (a button on Content Detail, not inferred from rating/
  // watchlist-add, which both mean "finished," the opposite signal), one
  // at a time (setting a new one replaces the old one, no array — keeps
  // the "who's watching what" feed one row per person). `startedAt` is a
  // real timestamp (not day-truncated like the streak fields above) since
  // this is read as "how long ago," shown to other viewers, not compared
  // by calendar day. Lazily expired on every read against a 1-day TTL
  // (userController.js's own isCurrentlyWatchingActive) rather than a cron
  // job — same "computed fresh, never physically cleared by a schedule"
  // convention `lastStreakDate`'s own decay already established — and
  // cleared for real (not just lazily) the moment the same item is added
  // to the Watched List (userWatchlistRoute.js's watchlist-add), the
  // natural "I finished it" signal, or the user manually stops it via the
  // same Content Detail button.
  currentlyWatching: {
    itemId: { type: Schema.Types.ObjectId },
    itemType: { type: String, enum: ["movie", "series"] },
    startedAt: { type: Date },
  },

}, { timestamps: true }); // Bu seçenek sizde zaten mevcuttu

// ===== DATABASE INDEXES (Issue #13) =====
// Note: email and username are implicitly indexed because they are unique: true

// Fast text search on username and email
userSchema.index({ username: "text", email: "text" });

// Fast lookups for user profiles and connections
userSchema.index({ followers: 1 });
userSchema.index({ following: 1 });

// Compound index for efficient watchlist queries
userSchema.index({ _id: 1, watchlist: 1 });

const User = mongoose.model('User', userSchema);

export default User;