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
    required: [true, 'Kullanıcı adı zorunludur.'],
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
    required: [true, 'Parola zorunludur.'],
    minlength: 6 // Minimum parola uzunluğu
  },
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
  // --- BİTİŞ ---
  watchlist: { type: [WatchItemSchema], default: [] }, // Bu alan sizde mevcuttu

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
    avgRating: Number
  },
  default: {}
},
seriesCineGraph: {
  type: Map,
  of: {
    count: Number,
    avgRating: Number
  },
  default: {}
}
  // --- BİTİŞ ---

}, { timestamps: true }); // Bu seçenek sizde zaten mevcuttu

// ===== DATABASE INDEXES (Issue #13) =====
// Fast lookups for authentication
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

// Fast lookups for user profiles and connections
userSchema.index({ followers: 1 });
userSchema.index({ following: 1 });

// Compound index for efficient watchlist queries
userSchema.index({ _id: 1, watchlist: 1 });

const User = mongoose.model('User', userSchema);

export default User;