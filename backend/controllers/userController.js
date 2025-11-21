// controllers/userController.js
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";

// --- YENİ EKLENEN IMPORT ---
// Notification modelini de buraya import ediyoruz
import Notification from "../models/Notification.js";
import Rating from "../models/Rating.js";
// --- BİTİŞ ---
import mongoose from 'mongoose'; // <-- YENİ IMPORT (GEREKLİ)

// @desc    Yeni bir kullanıcı kaydeder
// @route   POST /api/users/register
export const registerUser = async (req, res) => {
  // (Mevcut kodunuz - dokunulmadı)
  const { username, email, password } = req.body;

  try {
    // 1. Kullanıcı zaten var mı?
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res
        .status(400)
        .json({ message: "Bu e-posta adresi zaten kullanılıyor." });
    }

    // 2. Parolayı hash'le
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Yeni kullanıcıyı oluştur
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    // 4. Token oluştur ve geri döndür
    if (user) {
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "30d",
      });
      res.status(201).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        token,
      });
    } else {
      res.status(400).json({ message: "Geçersiz kullanıcı verisi." });
    }
  } catch (error) {
    res.status(500).json({ message: "Sunucu hatası", error: error.message });
  }
};

// @desc    Kullanıcı girişi yapar ve token döndürür
// @route   POST /api/users/login
export const loginUser = async (req, res) => {
  // (Mevcut kodunuz - dokunulmadı)
  const { email, password } = req.body;

  try {
    // 1. Kullanıcıyı e-postaya göre bul
    const user = await User.findOne({ email });

    // 2. Kullanıcı varsa ve parola eşleşiyorsa
    if (user && (await bcrypt.compare(password, user.password))) {
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "30d",
      });
      res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        token,
      });
    } else {
      res
        .status(401)
        .json({ message: "Geçersiz e-posta veya parola." }); // 401: Unauthorized
    }
  } catch (error) {
    res.status(500).json({ message: "Sunucu hatası", error: error.message });
  }
};

// @desc    Tüm kullanıcıları getirir (yalnızca test amaçlı)
// @route   GET /api/users
export const getUsers = async (req, res) => {
  // (Mevcut kodunuz - dokunulmadı)
  try {
    const users = await User.find({}).select("-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Sunucu hatası", error: error.message });
  }
};

// controllers/userController.js

// ... (registerUser, loginUser, getUsers fonksiyonları aynı kalır)

// @desc    Bir kullanıcıyı takip etme
// @route   POST /api/users/:id/follow
// @access  Private (Giriş Gerekli)
export const followUser = async (req, res) => {
  const loggedInUserId = req.user.id; // Giriş yapan kişi (test2)
  const userToFollowId = req.params.id; // Takip edilecek kişi (test1)

  // 1. Kendini takip edemez
  if (loggedInUserId === userToFollowId) {
    return res.status(400).json({ message: "Kendinizi takip edemezsiniz." });
  }

  try {
    // 2. Takip edilecek kullanıcının var olduğundan emin olalım
    const userToFollow = await User.findById(userToFollowId);
    if (!userToFollow) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }
    
    // 3. Zaten takip ediyor mu? (req.user'dan kontrol edebiliriz)
    if (req.user.following.includes(userToFollowId)) {
        return res.status(400).json({ message: "Bu kullanıcıyı zaten takip ediyorsunuz." });
    }

    // 4. DEĞİŞİKLİK: .save() yerine .updateOne() kullanarak
    //    doğrudan veritabanına komut gönderiyoruz.

    // Takip eden kişinin (test2) 'following' listesine 'test1'in ID'sini ekle
    await User.updateOne(
        { _id: loggedInUserId },
        { $addToSet: { following: userToFollowId } }
    );

    // Takip edilen kişinin (test1) 'followers' listesine 'test2'nin ID'sini ekle
    await User.updateOne(
        { _id: userToFollowId },
        { $addToSet: { followers: loggedInUserId } }
    );

    // 5. BİLDİRİM OLUŞTUR (Bu kısım aynı kalır)
    await Notification.findOneAndDelete({
      user: userToFollowId,
      sender: loggedInUserId,
      type: 'follow'
    });
    
    await Notification.create({
      user: userToFollowId,
      sender: loggedInUserId,
      type: 'follow'
    });

    res.status(200).json({ message: "Kullanıcı başarıyla takip edildi." });

  } catch (error) {
    res.status(500).json({ message: "Sunucu hatası", error: error.message });
  }
};

// @desc    Bir kullanıcıyı takipten çıkma
// @route   POST /api/users/:id/unfollow
// @access  Private (Giriş Gerekli)
export const unfollowUser = async (req, res) => {
  const loggedInUserId = req.user.id;
  const userToUnfollowId = req.params.id;

  try {
    // 1. DEĞİŞİKLİK: .save() yerine .updateOne() kullan

    // Takip eden kişinin 'following' listesinden ID'yi çıkar
    await User.updateOne(
        { _id: loggedInUserId },
        { $pull: { following: userToUnfollowId } }
    );

    // Takip edilen kişinin 'followers' listesinden ID'yi çıkar
    await User.updateOne(
        { _id: userToUnfollowId },
        { $pull: { followers: loggedInUserId } }
    );
    
    // Takipten çıkınca 'follow' bildirimini sil
    await Notification.deleteOne({
      user: userToUnfollowId,
      sender: loggedInUserId,
      type: 'follow'
    });

    res.status(200).json({ message: "Kullanıcı takipten çıkıldı." });

  } catch (error) {
    res.status(500).json({ message: "Sunucu hatası", error: error.message });
  }
};

// @desc    Giriş yapan kullanıcının bildirimlerini getirme
// @route   GET /api/notifications
// @access  Private (Giriş Gerekli)
export const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.user.id })
            .populate('sender', 'username') // Bildirimi gönderenin sadece username'ini al
            .sort({ createdAt: -1 }); // En yeniden eskiye sırala

        res.status(200).json(notifications);

        // İPUCU: Bildirimleri getirdikten sonra 'okundu' olarak işaretlemek iyi bir yöntemdir.
        // Bunu frontend'den ayrı bir istek (PUT /api/notifications/read) ile yapabilir
        // veya burada otomatik olarak yapabilirsiniz:
        // await Notification.updateMany({ user: req.user.id, read: false }, { $set: { read: true } });

    } catch (error) {
        res.status(500).json({ message: "Sunucu hatası", error: error.message });
    }
};

// @desc    Giriş yapan kullanıcının TAKİP ETTİKLERİ listesini getirir
// @route   GET /api/users/me/following
// @access  Private (Giriş Gerekli)
export const getMyFollowing = async (req, res) => {
    try {
        // 1. Giriş yapan kullanıcıyı bul
        const user = await User.findById(req.user.id)
            // 2. 'following' alanını populate et (sadece ID değil, tüm kullanıcı objesini al)
            .populate('following', '_id username'); // Sadece id ve username'i al

        if (!user) {
            return res.status(404).json({ message: "Kullanıcı bulunamadı." });
        }

        // 3. Sadece following listesini döndür
        res.status(200).json(user.following);

    } catch (error) {
        res.status(500).json({ message: "Sunucu hatası", error: error.message });
    }
};

// @desc    Giriş yapan kullanıcının TAKİPÇİLERİ listesini getirir
// @route   GET /api/users/me/followers
// @access  Private (Giriş Gerekli)
export const getMyFollowers = async (req, res) => {
    try {
        // 1. Giriş yapan kullanıcıyı bul
        const user = await User.findById(req.user.id)
            // 2. 'followers' alanını populate et
            .populate('followers', '_id username'); // Sadece id ve username'i al

        if (!user) {
            return res.status(404).json({ message: "Kullanıcı bulunamadı." });
        }
        
        // 3. Sadece followers listesini döndür
        res.status(200).json(user.followers);

    } catch (error) {
        res.status(500).json({ message: "Sunucu hatası", error: error.message });
    }
};

// @desc    Kullanıcı adlarına göre kullanıcı ara
// @route   GET /api/users/search?q=[query]
// @access  Private (Giriş Gerekli)
export const searchUsers = async (req, res) => {
  const query = req.query.q; // Arama sorgusunu al (örn: 'test')

  if (!query) {
    return res.status(400).json({ message: "Arama sorgusu gerekli." });
  }

  try {
    // MongoDB'de 'username' alanında, büyük/küçük harf duyarsız ($options: 'i')
    // ve kısmi eşleşmeli ($regex) bir arama yap.
    const users = await User.find({
      username: { $regex: query, $options: 'i' },
      _id: { $ne: req.user.id } // Arayan kişinin kendisini sonuçlardan çıkar
    })
    .select('_id username') // Sadece ID ve username'i döndür
    .limit(10); // Sonuçları 10 ile sınırla

    res.status(200).json(users);

  } catch (error) {
    res.status(500).json({ message: "Sunucu hatası", error: error.message });
  }
};

// backend/controllers/userController.js

// ... (searchUsers fonksiyonunun bittiği yer)

// @desc    Kullanıcının favori listesini (film veya dizi) günceller
// @route   PUT /api/users/me/favorites
// @access  Private
export const updateFavorites = async (req, res) => {
  const { type, list } = req.body; // type: 'movie' or 'series', list: string[] of _ids
  const userId = req.user.id;

  if (!type || !list) {
    return res.status(400).json({ message: "Tip ve liste gerekli." });
  }
  if (list.length > 5) {
    return res.status(400).json({ message: "Favori listesi en fazla 5 öğe içerebilir." });
  }

  try {
    const fieldToUpdate = type === 'movie' ? 'favoriteMovies' : 'favoriteSeries';
    
    // 1. Kullanıcının listesini güncelle
    await User.findByIdAndUpdate(
      userId,
      { [fieldToUpdate]: list }, // Listeyi doğrudan gelen yeni listeyle değiştir
      { new: true, runValidators: true }
    );
    
    // 2. GÜNCELLEME: Populate etme. Sadece güncel ID listesini geri döndür.
    res.status(200).json(list);

  } catch (error) {
    res.status(500).json({ message: "Favoriler güncellenemedi.", error: error.message });
  }
};

// controllers/userController.js dosyasının sonuna ekle:

// ... (mevcut updateFavorites fonksiyonunun bittiği yer)

/**
 * @desc   Kullanıcının public profil bilgilerini getirir (ProfilePage için)
 * @route  GET /api/users/profile/:id
 * @access Private
 */
export const getUserProfile = async (req, res) => {
  try {
    // .findById() kullanarak :id parametresindeki kullanıcının
    // şifresi HARİÇ tüm bilgilerini getiriyoruz.
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }
    
    // Frontend'e kullanıcının bio, username, createdAt gibi bilgilerini yolla
    res.status(200).json(user);

  } catch (error) {
    console.error("Profil getirme hatası:", error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// controllers/userController.js

// ... (mevcut getUserProfile fonksiyonunun hemen altına)

// controllers/userController.js

// ... (getUserProfile fonksiyonunun bittiği yerin hemen altına)

// controllers/userController.js

// ... (getUserProfile fonksiyonunun bittiği yerin hemen altına)

/**
 * @desc   Kullanıcının AYRIŞTIRILMIŞ favori listesini getirir
 * @route  GET /api/users/favorites/:id
 * @access Private
 */
export const getUserFavorites = async (req, res) => {
  try {
    // 1. Kullanıcıyı bul ve favorileri doldur
    const user = await User.findById(req.params.id)
      .populate('favoriteMovies')
      .populate('favoriteSeries');

    // 2. Kritik kontrol
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }
    
    // 3. --- DEĞİŞİKLİK BURADA ---
    // Artık listeleri birleştirmiyoruz (mergedFavorites YOK).
    // Frontend'e iki ayrı anahtar (key) ile bir obje yolluyoruz.
    res.status(200).json({
      movies: user.favoriteMovies || [],
      series: user.favoriteSeries || []
    });

  } catch (error) {
    // 5. Hata cevabını gönder
    console.error("Favori getirme hatası:", error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// controllers/userController.js dosyasının sonuna ekle:

// ... (mevcut getUserFavorites fonksiyonunun bittiği yer)

/**
 * @desc   Kullanıcının biosunu günceller
 * @route  PATCH /api/users/profile/:id/bio
 * @access Private
 */
export const updateUserBio = async (req, res) => {
  try {
    // 1. Güvenlik Kontrolü:
    // Sadece giriş yapmış kullanıcının kendi profilini güncelleyebildiğinden emin ol.
    // req.params.id -> URL'den gelen ID
    // req.user.id   -> Token'dan (authMiddleware) gelen, giriş yapmış kullanıcının ID'si
    if (req.params.id !== req.user.id) {
      return res.status(403).json({ message: "Sadece kendi profilinizi güncelleyebilirsiniz." });
    }

    // 2. Frontend'den gelen yeni bio metnini al
    const { bio } = req.body;

    // 3. Kullanıcıyı bul ve biosunu güncelle
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id, // Güvenlik için req.user.id'yi kullan
      { bio: bio },
      { new: true, runValidators: true } // 'new: true' güncellenmiş belgeyi döndürür
    ).select('-password'); // ŞİFREYİ ASLA geri gönderme

    if (!updatedUser) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }

    // 4. Frontend'e güncellenmiş profil verisini geri yolla
    // (ProfilePage.jsx'teki setProfile(response.data) bu veriyi bekliyor)
    res.status(200).json(updatedUser);

  } catch (error) {
    console.error("Bio güncelleme hatası:", error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// controllers/userController.js (içinde)

/**
 * @desc   Bir kullanıcının verdiği tüm oyları getirir
 * @route  GET /api/users/ratings/:id
 * @access Private
 */
export const getUserRatings = async (req, res) => {
  try {
    // Veritabanından, 'user' alanı 'req.params.id' ile eşleşen tüm oyları bul.
    
    // --- DEĞİŞİKLİK BURADA ---
    // 'content' ve 'rating' yerine, senin modelindeki
    // 'contentId' ve 'value' alanlarını seçiyoruz.
    const ratings = await Rating.find({ user: req.params.id })
      .select("contentId value"); // <-- DÜZELTİLDİ
    // --- BİTİŞ ---

    res.status(200).json(ratings);

  } catch (error) {
    console.error("Oylar çekilirken hata:", error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

/**
 * @desc   Profil resmi yükler
 * @route  POST /api/users/profile-pic/:userId
 * @access Private
 */
export const uploadProfilePic = async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "profile_pics",
    });

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { profile_pic_url: result.secure_url }, // Cloudinary'den dönen URL'yi kaydedin
      { new: true } // Güncellenmiş kullanıcıyı döndür
    );

    if (!user) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }

    res.status(200).json({ profilePicUrl: user.profile_pic_url });
  } catch (error) {
    console.error("Profil resmi yüklenirken hata:", error);
    res.status(500).json({ message: "Profil resmi yüklenemedi." });
  }
};

// controllers/userController.js (içinde)

/**
 * @desc   Kullanıcının watchlist'ine göre CineGraph (tür) istatistiklerini getirir
 * @route  GET /api/users/me/cinegraph
 * @access Private
 */

// --- 1. TMDB TÜR SÖZLÜKLERİ (ID'leri isme çevirmek için) ---
const MOVIE_GENRE_MAP = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Science Fiction",
  10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western"
};

const SERIES_GENRE_MAP = {
  10759: "Action & Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  10762: "Kids", 9648: "Mystery", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk",
  10768: "War & Politics", 37: "Western"
};
// --- BİTİŞ ---

export const getUserCineGraph = async (req, res) => {
  try {
    // 1. Modelleri global bağlantıdan çağır
    const Movie = mongoose.model('Movie');
    const Series = mongoose.model('Series');

    // 2. Watchlist'i DB'den çek
    const user = await User.findById(req.user.id).select('watchlist');
    if (!user || !user.watchlist) {
      return res.status(404).json({ message: "Watchlist bulunamadı" });
    }
    const watchlist = user.watchlist;

    // 3. Watchlist'i ID'lere ayır
    const movieIds = watchlist
      .filter(item => item.itemType === 'movie')
      .map(item => item.itemId);
      
    const seriesIds = watchlist
      .filter(item => item.itemType === 'series')
      .map(item => item.itemId);

    // 4. --- DÜZELTME: 'genres' YERİNE 'genre_ids' ÇEK ---
    const movies = await Movie.find({ '_id': { $in: movieIds } }).select('genre_ids');
    const series = await Series.find({ '_id': { $in: seriesIds } }).select('genre_ids');
    // --- BİTİŞ ---

    // 5. --- DÜZELTME: TÜR ADLARINI SÖZLÜKTEN BUL VE SAY ---
    const movieGenreCounts = {};
    const seriesGenreCounts = {};

    // Film türlerini say
    for (const movie of movies) {
      if (movie.genre_ids && Array.isArray(movie.genre_ids)) {
        for (const genreId of movie.genre_ids) {
          const genreName = MOVIE_GENRE_MAP[genreId]; // ID'yi isme çevir (örn: 14 -> "Fantasy")
          if (genreName) { // Eğer sözlükte varsa
            movieGenreCounts[genreName] = (movieGenreCounts[genreName] || 0) + 1;
          }
        }
      }
    }
    
    // Dizi türlerini say
    for (const show of series) {
      if (show.genre_ids && Array.isArray(show.genre_ids)) {
        for (const genreId of show.genre_ids) {
          const genreName = SERIES_GENRE_MAP[genreId]; // ID'yi isme çevir
          if (genreName) {
            seriesGenreCounts[genreName] = (seriesGenreCounts[genreName] || 0) + 1;
          }
        }
      }
    }
    // --- BİTİŞ ---
    
    // 6. Frontend'e yolla (Bu kısım aynı)
    res.status(200).json({
      movieStats: movieGenreCounts, // Örn: { "Fantasy": 1, "Action": 5 }
      seriesStats: seriesGenreCounts
    });

  } catch (error) {
    console.error("CineGraph verisi çekilirken hata:", error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// controllers/userController.js

// ... (Önceki tüm kodlar ve genre map'ler burada) ...

/**
 * @desc   Kullanıcıyı diğerleriyle eşleştirir (CineMatch Algoritması)
 * @route  POST /api/users/matches
 * @access Private
 * @body   { type: 'movie'|'series', genres: ['Action', 'Horror'] (opsiyonel) }
 */
export const findMatches = async (req, res) => {
  const { type, genres } = req.body; // Filtreler
  const currentUserId = req.user.id;

  if (!type || (type !== 'movie' && type !== 'series')) {
    return res.status(400).json({ message: "Geçerli bir tür (movie veya series) seçmelisiniz." });
  }

  try {
    const Movie = mongoose.model('Movie');
    const Series = mongoose.model('Series');
    const TargetModel = type === 'movie' ? Movie : Series;
    const GenreMap = type === 'movie' ? MOVIE_GENRE_MAP : SERIES_GENRE_MAP;

    // 1. TÜM KULLANICILARI VE WATCHLIST'LERİNİ ÇEK (Kendin hariç)
    // (Gerçek bir app'te bu limitli olmalı, şimdilik 100 kişiyle sınırlı)
    const allUsers = await User.find({ _id: { $ne: currentUserId } })
      .select('_id username profile_pic_url watchlist')
      .limit(100)
      .lean();

    // Kendi verini çek
    const currentUser = await User.findById(currentUserId).select('watchlist').lean();
    
    if (!currentUser.watchlist || currentUser.watchlist.length === 0) {
      return res.status(400).json({ message: "Eşleşme yapmak için önce watchlist'ine bir şeyler eklemelisin." });
    }

    // 2. VERİMLİLİK: Tüm kullanıcıların watchlist'indeki içerik ID'lerini topla
    // Böylece DB'ye tek bir sorgu atıp tüm filmlerin türlerini öğrenebiliriz.
    let allContentIds = new Set();
    
    // Kendi listendekiler
    currentUser.watchlist.forEach(item => {
      if (item.itemType === type) allContentIds.add(item.itemId);
    });

    // Diğerlerinin listesindekiler
    allUsers.forEach(u => {
      u.watchlist.forEach(item => {
        if (item.itemType === type) allContentIds.add(item.itemId);
      });
    });

    // 3. İÇERİK DETAYLARINI (TÜRLERİNİ) ÇEK
    const contentDetails = await TargetModel.find({ _id: { $in: Array.from(allContentIds) } })
      .select('_id genre_ids')
      .lean();

    // Hızlı erişim için Map yap: { "film_id": ["Action", "Comedy"] }
    const contentGenreMap = {};
    contentDetails.forEach(c => {
      const genreNames = c.genre_ids?.map(id => GenreMap[id]).filter(Boolean) || [];
      contentGenreMap[c._id.toString()] = genreNames;
    });

    // 4. OYLARI ÇEK (Tüm ilgili oylar)
    const allRatings = await Rating.find({ 
      contentType: type,
      contentId: { $in: Array.from(allContentIds) }
    }).select('user contentId value').lean();

    // Oyları kullanıcıya göre grupla: { "user_id": { "film_id": 8 } }
    const userRatingsMap = {};
    allRatings.forEach(r => {
      if (!userRatingsMap[r.user]) userRatingsMap[r.user] = {};
      userRatingsMap[r.user][r.contentId] = r.value;
    });

    // --- YARDIMCI FONKSİYON: KULLANICI PROFİLİ (VEKTÖR) OLUŞTUR ---
    const calculateUserVector = (userObj) => {
      const vector = {}; // { "Action": 8.5, "Horror": 4.0 }
      const counts = {}; // { "Action": 2, "Horror": 1 }

      // Kullanıcının oylarına bak (Yoksa varsayılan 5 puan verelim ki izlemesi de saysın)
      const myRatings = userRatingsMap[userObj._id] || {};

      userObj.watchlist.forEach(item => {
        if (item.itemType !== type) return;
        
        const itemGenres = contentGenreMap[item.itemId] || [];
        // Eğer kullanıcı oy vermişse onu al, yoksa nötr (5) kabul et
        // (veya sadece izlemiş olmayı puan olarak sayma, tercih meselesi. Şimdilik puanı alıyoruz)
        const rating = myRatings[item.itemId] || 5; 

        itemGenres.forEach(genre => {
          if (!vector[genre]) { vector[genre] = 0; counts[genre] = 0; }
          vector[genre] += rating;
          counts[genre] += 1;
        });
      });

      // Ortalamayı al
      Object.keys(vector).forEach(g => {
        vector[g] = vector[g] / counts[g];
      });

      return vector;
    };

    // 5. PROFİLLERİ HESAPLA
    const myVector = calculateUserVector(currentUser);
    
    // Eğer kullanıcının hiç verisi yoksa
    if (Object.keys(myVector).length === 0) {
        return res.status(200).json([]);
    }

    const matches = allUsers.map(otherUser => {
      const otherVector = calculateUserVector(otherUser);
      
      // BENZERLİK HESAPLA (Algoritma Çekirdeği)
      let score = 0;
      let commonGenres = 0;

      // Hangi türleri karşılaştıracağız?
      // Eğer frontend'den 'genres' filtresi geldiyse SADECE onları karşılaştır.
      // Yoksa tüm ortak türleri karşılaştır.
      const genresToCompare = (genres && genres.length > 0) 
        ? genres 
        : Object.keys(myVector); // Benim izlediğim her şeyi karşılaştır

      genresToCompare.forEach(genre => {
        // Eğer karşı tarafta bu tür varsa farkı hesapla
        if (otherVector[genre]) {
          const myScore = myVector[genre];
          const otherScore = otherVector[genre];
          
          // Fark ne kadar azsa, puan o kadar yüksek olmalı.
          // 10 üzerinden farkı alıyoruz.
          // Fark 0 ise -> 10 puan. Fark 9 ise -> 1 puan.
          const diff = Math.abs(myScore - otherScore);
          score += (10 - diff); 
          commonGenres++;
        }
      });

      // Ortak hiçbir şey yoksa uyum 0'dır
      if (commonGenres === 0) return null;

      // Ortalama uyum puanı (0-100 arası yüzdeye çevirelim)
      // score / commonGenres -> 0-10 arası ortalama benzerlik
      // * 10 -> 0-100 arası yüzde
      const matchPercentage = (score / commonGenres) * 10;

      return {
        user: otherUser,
        matchPercentage: Math.round(matchPercentage),
        sharedGenres: commonGenres
      };
    })
    .filter(Boolean) // null olanları (ortak noktası olmayanları) at
    .sort((a, b) => b.matchPercentage - a.matchPercentage) // En yüksek puana göre sırala
    .slice(0, 10); // İlk 10 kişiyi al

    res.status(200).json(matches);

  } catch (error) {
    console.error("Eşleşme hatası:", error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};