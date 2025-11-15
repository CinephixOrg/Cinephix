// backend/controllers/reviewController.js
import Review from '../models/Review.js';
import User from '../models/User.js'; // Kullanıcı adını almak için

/**
 * @desc   Belirli bir içeriğe ait tüm yorumları getirir
 * @route  GET /api/reviews/content/:contentId
 * @access Public (Herkes görebilir)
 */
export const getContentReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ contentId: req.params.contentId })
      .populate('user', 'username') // Yorumu yapanın sadece kullanıcı adını al
      .sort({ createdAt: -1 }); // En yeniden eskiye sırala

    res.status(200).json(reviews);
  } catch (error) {
    console.error("Yorumlar çekilirken hata:", error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

/**
 * @desc   Yeni bir yorum ekler veya mevcut yorumu günceller
 * @route  POST /api/reviews
 * @access Private (Giriş Gerekli)
 * @body   { contentId: "...", contentType: "movie|series", text: "..." }
 */
export const addOrUpdateReview = async (req, res) => {
  const { contentId, contentType, text } = req.body;
  const userId = req.user.id; // authMiddleware'den gelir

  if (!contentId || !contentType || !text) {
    return res.status(400).json({ message: 'Eksik bilgi: contentId, contentType ve text gereklidir.' });
  }

  try {
    // upsert: true -> Eğer { user, contentId } eşleşmesi yoksa YENİ oluştur, varsa GÜNCELLE.
    // new: true -> Güncellenmiş veya yeni oluşturulmuş belgeyi geri döndür.
    // runValidators: true -> Modeldeki maxlength gibi kuralları kontrol et.
    const review = await Review.findOneAndUpdate(
      { user: userId, contentId: contentId }, // Bu kullanıcı bu içeriğe daha önce yorum yapmış mı?
      { contentType: contentType, text: text, user: userId }, // Yeni veya güncellenecek veri
      { new: true, upsert: true, runValidators: true }
    ).populate('user', 'username'); // Güncel yorumu kullanıcı adıyla geri döndür

    res.status(201).json(review); // 201: Created (veya Updated)

  } catch (error) {
    console.error("Yorum kaydedilirken hata:", error);
    if (error.code === 11000) { // unique index hatası (nadiren, upsert bunu genelde çözer)
      return res.status(400).json({ message: 'Bu içeriğe zaten yorum yapmışsınız.' });
    }
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

/**
 * @desc   Kullanıcının kendi yorumunu siler
 * @route  DELETE /api/reviews/:reviewId
 * @access Private (Giriş Gerekli)
 */
export const deleteMyReview = async (req, res) => {
  const reviewId = req.params.reviewId;
  const userId = req.user.id;

  try {
    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({ message: 'Yorum bulunamadı.' });
    }

    // Yorumu silmeye çalışan kişi, yorumun sahibi mi?
    if (review.user.toString() !== userId) {
      return res.status(403).json({ message: 'Bu yorumu silme yetkiniz yok.' });
    }

    await review.remove(); // Mongoose 5 ve altı için remove(), 6+ için deleteOne()
    // Veya: await Review.deleteOne({ _id: reviewId });

    res.status(200).json({ message: 'Yorum başarıyla silindi.' });

  } catch (error) {
    console.error("Yorum silinirken hata:", error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};