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
}
  // --- BİTİŞ ---

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