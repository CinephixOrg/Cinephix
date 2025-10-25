// backend/controllers/ratingController.js (YENİ DOSYA)
import Rating from '../models/Rating.js';

// @desc    Bir içeriğe puan ekle VEYA güncelle
// @route   POST /api/ratings
// @access  Private
export const addOrUpdateRating = async (req, res) => {
    const { contentId, contentType, value } = req.body;
    const userId = req.user.id; // authMiddleware'den gelir

    try {
        // "Upsert": Eğer bu kullanıcı ve contentId için bir kayıt varsa GÜNCELLE,
        // yoksa YENİ KAYIT OLUŞTUR.
        const newRating = await Rating.findOneAndUpdate(
            { user: userId, contentId: contentId }, // Sorgu
            { contentType: contentType, value: value }, // Güncelleme
            { 
                upsert: true, // Yoksa oluştur
                new: true, // Güncellenmiş/yeni dokümanı döndür
                runValidators: true // Schema'daki min/max kontrollerini çalıştır
            }
        );
        res.status(200).json(newRating);
    } catch (error) {
        res.status(500).json({ message: "Puan kaydedilemedi", error: error.message });
    }
};

// @desc    Kullanıcının bir içeriğe verdiği puanı getir
// @route   GET /api/ratings/me/:contentId
// @access  Private
export const getMyRating = async (req, res) => {
    const { contentId } = req.params;
    const userId = req.user.id;

    try {
        const rating = await Rating.findOne({ user: userId, contentId: contentId });

        if (!rating) {
            // Puan vermemiş olması bir hata değildir, sadece "bulunamadı"
            return res.status(404).json({ message: "Kullanıcı bu içeriği puanlamamış." });
        }

        res.status(200).json(rating);
    } catch (error) {
        res.status(500).json({ message: "Sunucu hatası", error: error.message });
    }
};