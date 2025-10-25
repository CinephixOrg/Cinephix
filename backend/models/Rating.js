// backend/models/Rating.js (YENİ DOSYA)
import mongoose from 'mongoose';
const { Schema } = mongoose;

const ratingSchema = new Schema({
    // Puanı veren kullanıcı
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Puanlanan içerik (movie veya series ID'si)
    contentId: {
        type: String, // Veya ObjectId, sizin watchlist'inizle aynı olmalı
        required: true
    },
    // İçerik tipi
    contentType: {
        type: String,
        enum: ['movie', 'series'],
        required: true
    },
    // 1-10 arası verilen puan
    value: {
        type: Number,
        required: true,
        min: 1,
        max: 10
    }
}, { timestamps: true });

// Bir kullanıcının bir içeriğe SADECE BİR KEZ puan verebilmesini sağlar
ratingSchema.index({ user: 1, contentId: 1 }, { unique: true });

const Rating = mongoose.model('Rating', ratingSchema);
export default Rating;