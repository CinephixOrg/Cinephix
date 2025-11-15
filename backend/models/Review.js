// backend/models/Review.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const reviewSchema = new Schema({
  // Yorumu yapan kullanıcı
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User', // User modeline referans
    required: true
  },
  // Yorum yapılan içerik (movie veya series ID'si)
  // Rating.js'deki contentId ile aynı türde olmalı (String veya ObjectId)
  contentId: {
    type: String, // Veya Schema.Types.ObjectId
    required: true
  },
  // İçerik tipi
  contentType: {
    type: String,
    enum: ['movie', 'series'],
    required: true
  },
  // Yorum metni
  text: {
    type: String,
    required: [true, 'Yorum metni boş olamaz.'],
    trim: true,
    maxlength: 2000 // İsteğe bağlı karakter limiti
  },
  // İsteğe bağlı: Eğer oylamayı da yorumla birlikte saklamak istersen
  // rating: {
  //   type: Number,
  //   min: 1,
  //   max: 10
  // }
}, { timestamps: true }); // createdAt ve updatedAt alanlarını otomatik ekler

// Bir kullanıcının bir içeriğe SADECE BİR yorum yapabilmesini sağlar
// (Eğer birden fazla yoruma izin vermek istiyorsan bu satırı kaldır)
reviewSchema.index({ user: 1, contentId: 1 }, { unique: true });

const Review = mongoose.model('Review', reviewSchema);
export default Review;