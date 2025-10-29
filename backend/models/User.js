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
  }]
  // --- BİTİŞ ---

}, { timestamps: true }); // Bu seçenek sizde zaten mevcuttu

const User = mongoose.model('User', userSchema);

export default User;