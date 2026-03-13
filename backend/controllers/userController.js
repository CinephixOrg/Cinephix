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

// New imports for consistent responses and error handling
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError, sendPaginated } from "../utils/response.js";
import { validateEmail } from "../middleware/validation.js";
import { MOVIE_GENRE_MAP, SERIES_GENRE_MAP } from "../utils/genreConstants.js";

// @desc    Yeni bir kullanıcı kaydeder
// @route   POST /api/users/register
export const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  // Input validation
  if (!username || !email || !password) {
    return sendError(res, 'Username, email, and password are required', 400);
  }

  if (!validateEmail(email)) {
    return sendError(res, 'Invalid email format', 400);
  }

  if (password.length < 6) {
    return sendError(res, 'Password must be at least 6 characters', 400);
  }

  // Check if user already exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    return sendError(res, 'Email already registered', 400);
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create user
  const user = await User.create({
    username,
    email,
    password: hashedPassword,
  });

  // Generate token
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });

  sendSuccess(res, {
    _id: user._id,
    username: user.username,
    email: user.email,
    token,
  }, 'User registered successfully', 201);
});

// @desc    Kullanıcı girişi yapar ve token döndürür
// @route   POST /api/users/login
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    return sendError(res, 'Email and password are required', 400);
  }

  if (!validateEmail(email)) {
    return sendError(res, 'Invalid email format', 400);
  }

  // Find user and verify password
  const user = await User.findOne({ email });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return sendError(res, 'Invalid email or password', 401);
  }

  // Generate token
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });

  sendSuccess(res, {
    _id: user._id,
    username: user.username,
    email: user.email,
    token,
  }, 'Login successful', 200);
});

// @desc    Tüm kullanıcıları getirir (yalnızca test amaçlı)
// @route   GET /api/users
export const getUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const users = await User.find({})
    .select('-password')
    .limit(parseInt(limit))
    .skip(skip)
    .lean();

  const total = await User.countDocuments();

  sendPaginated(res, users, total, parseInt(page), parseInt(limit), 'Users fetched');
});

// controllers/userController.js

// ... (registerUser, loginUser, getUsers fonksiyonları aynı kalır)

// @desc    Bir kullanıcıyı takip etme
// @route   POST /api/users/:id/follow
// @access  Private (Giriş Gerekli)
export const followUser = asyncHandler(async (req, res) => {
  const loggedInUserId = req.user.id;
  const userToFollowId = req.params.id;

  // Validation
  if (!userToFollowId.match(/^[0-9a-fA-F]{24}$/)) {
    return sendError(res, 'Invalid user ID', 400);
  }

  if (loggedInUserId === userToFollowId) {
    return sendError(res, 'You cannot follow yourself', 400);
  }

  const userToFollow = await User.findById(userToFollowId);
  if (!userToFollow) {
    return sendError(res, 'User not found', 404);
  }

  if (req.user.following.includes(userToFollowId)) {
    return sendError(res, 'You are already following this user', 400);
  }

  await User.updateOne(
    { _id: loggedInUserId },
    { $addToSet: { following: userToFollowId } }
  );

  await User.updateOne(
    { _id: userToFollowId },
    { $addToSet: { followers: loggedInUserId } }
  );

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

  sendSuccess(res, null, 'User followed successfully', 200);
});

// @desc    Bir kullanıcıyı takipten çıkma
// @route   POST /api/users/:id/unfollow
// @access  Private (Giriş Gerekli)
export const unfollowUser = asyncHandler(async (req, res) => {
  const loggedInUserId = req.user.id;
  const userToUnfollowId = req.params.id;

  await User.updateOne(
    { _id: loggedInUserId },
    { $pull: { following: userToUnfollowId } }
  );

  await User.updateOne(
    { _id: userToUnfollowId },
    { $pull: { followers: loggedInUserId } }
  );

  await Notification.deleteOne({
    user: userToUnfollowId,
    sender: loggedInUserId,
    type: 'follow'
  });

  sendSuccess(res, null, 'User unfollowed successfully', 200);
});

// @desc    Giriş yapan kullanıcının bildirimlerini getirme
// @route   GET /api/notifications
// @access  Private (Giriş Gerekli)
export const getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const notifications = await Notification.find({ user: req.user.id })
    .populate('sender', 'username profile_pic_url')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip)
    .lean();

  const total = await Notification.countDocuments({ user: req.user.id });

  sendPaginated(res, notifications, total, parseInt(page), parseInt(limit), 'Notifications fetched');
});

// @desc    Giriş yapan kullanıcının TAKİP ETTİKLERİ listesini getirir
// @route   GET /api/users/me/following
// @access  Private (Giriş Gerekli)
export const getMyFollowing = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const user = await User.findById(req.user.id)
        .populate({
            path: 'following',
            select: '_id username profile_pic_url',
            options: {
                skip: skip,
                limit: parseInt(limit)
            }
        })
        .lean();

    if (!user) {
        return sendError(res, 'User not found', 404);
    }

    const userWithCount = await User.findById(req.user.id).lean();
    const total = userWithCount.following ? userWithCount.following.length : 0;

    sendPaginated(res, user.following || [], total, parseInt(page), parseInt(limit), 'Following list fetched');
});

// @desc    Giriş yapan kullanıcının TAKİPÇİLERİ listesini getirir
// @route   GET /api/users/me/followers
// @access  Private (Giriş Gerekli)
export const getMyFollowers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const user = await User.findById(req.user.id)
        .populate({
            path: 'followers',
            select: '_id username profile_pic_url',
            options: {
                skip: skip,
                limit: parseInt(limit)
            }
        })
        .lean();

    if (!user) {
        return sendError(res, 'User not found', 404);
    }

    const userWithCount = await User.findById(req.user.id).lean();
    const total = userWithCount.followers ? userWithCount.followers.length : 0;

    sendPaginated(res, user.followers || [], total, parseInt(page), parseInt(limit), 'Followers list fetched');
});

// @desc    Kullanıcı adlarına göre kullanıcı ara
// @route   GET /api/users/search?q=[query]
// @access  Private (Giriş Gerekli)
export const searchUsers = asyncHandler(async (req, res) => {
  const query = req.query.query;
  const { page = 1, limit = 20 } = req.query;

  if (!query) {
    return sendError(res, 'Search query is required', 400);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const users = await User.find({
    username: { $regex: query, $options: 'i' },
    _id: { $ne: req.user.id }
  })
    .select('_id username profile_pic_url')
    .limit(parseInt(limit))
    .skip(skip)
    .lean();

  const total = await User.countDocuments({
    username: { $regex: query, $options: 'i' },
    _id: { $ne: req.user.id }
  });

  sendPaginated(res, users, total, parseInt(page), parseInt(limit), 'Users found');
});

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
export const getUserFavorites = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('favoriteMovies favoriteSeries')
    .populate('favoriteMovies', '_id title poster_path')
    .populate('favoriteSeries', '_id name poster_path')
    .lean();

  if (!user) {
    return sendError(res, 'User not found', 404);
  }
  
  sendSuccess(res, {
    movies: user.favoriteMovies || [],
    series: user.favoriteSeries || []
  }, 'User favorites fetched', 200);
});

// controllers/userController.js dosyasının sonuna ekle:

// ... (mevcut getUserFavorites fonksiyonunun bittiği yer)

/**
 * @desc   Kullanıcının biosunu günceller
 * @route  PATCH /api/users/profile/:id/bio
 * @access Private
 */
export const updateUserBio = asyncHandler(async (req, res) => {
  if (req.params.id !== req.user.id) {
    return sendError(res, 'You can only update your own profile', 403);
  }

  const { bio } = req.body;

  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    { bio },
    { new: true, runValidators: true }
  ).select('-password');

  if (!updatedUser) {
    return sendError(res, 'User not found', 404);
  }

  sendSuccess(res, updatedUser, 'Bio updated successfully', 200);
});

// controllers/userController.js (içinde)

/**
 * @desc   Bir kullanıcının verdiği tüm oyları getirir
 * @route  GET /api/users/ratings/:id
 * @access Private
 */
export const getUserRatings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const ratings = await Rating.find({ user: req.params.id })
    .select('contentId contentType value createdAt')
    .limit(parseInt(limit))
    .skip(skip)
    .sort({ createdAt: -1 })
    .lean();

  const total = await Rating.countDocuments({ user: req.params.id });

  sendSuccess(res, ratings, 'User ratings fetched', 200, {
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    pages: Math.ceil(total / Math.max(parseInt(limit), 1))
  });
});

/**
 * @desc   Profil resmi yükler
 * @route  POST /api/users/profile-pic/:userId
 * @access Private
 */
export const uploadProfilePic = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const file = req.file;

  // Validation
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return sendError(res, 'Invalid user ID', 400);
  }

  if (!file) {
    return sendError(res, 'No file uploaded', 400);
  }

  // Upload to Cloudinary using buffer stream
  const result = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'profile_pics' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(file.buffer);
  });

  // Update user with profile picture URL
  const user = await User.findByIdAndUpdate(
    id,
    { profile_pic_url: result.secure_url },
    { new: true }
  ).lean();

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  sendSuccess(res, { profilePicUrl: user.profile_pic_url }, 'Profile picture uploaded successfully', 200);
});

// controllers/userController.js (içinde)

/**
 * @desc   Kullanıcının watchlist'ine göre CineGraph (tür) istatistiklerini getirir
 * @route  GET /api/users/me/cinegraph
 * @access Private
 */

// backend/controllers/userController.js

export const getUserCineGraph = asyncHandler(async (req, res) => {
  const Movie = mongoose.model('Movie');
  const Series = mongoose.model('Series');

  let targetUserId = req.params.id;

  if (targetUserId === 'me' || !targetUserId) {
      targetUserId = req.user.id;
  }

  const user = await User.findById(targetUserId).select('watchlist').lean();
  
  if (!user) {
      return sendSuccess(res, { movieStats: {}, seriesStats: {} }, 'CineGraph fetched', 200);
  }
  
  if (!user.watchlist || user.watchlist.length === 0) {
    return sendSuccess(res, { movieStats: {}, seriesStats: {} }, 'CineGraph fetched', 200);
  }

  const watchlist = user.watchlist;

  const movieIds = watchlist.filter(item => item.itemType === 'movie').map(item => item.itemId);
  const seriesIds = watchlist.filter(item => item.itemType === 'series').map(item => item.itemId);

  const movies = await Movie.find({ '_id': { $in: movieIds } }).select('genre_ids').lean();
  const series = await Series.find({ '_id': { $in: seriesIds } }).select('genre_ids').lean();

  const movieGenreCounts = {};
  const seriesGenreCounts = {};

  for (const movie of movies) {
    if (movie.genre_ids && Array.isArray(movie.genre_ids)) {
      for (const genreId of movie.genre_ids) {
        const genreName = MOVIE_GENRE_MAP[genreId];
        if (genreName) {
           movieGenreCounts[genreName] = (movieGenreCounts[genreName] || 0) + 1;
        }
      }
    }
  }
  
  for (const show of series) {
    if (show.genre_ids && Array.isArray(show.genre_ids)) {
      for (const genreId of show.genre_ids) {
        const genreName = SERIES_GENRE_MAP[genreId];
        if (genreName) seriesGenreCounts[genreName] = (seriesGenreCounts[genreName] || 0) + 1;
      }
    }
  }

  sendSuccess(res, { movieStats: movieGenreCounts, seriesStats: seriesGenreCounts }, 'CineGraph fetched', 200);
});

// controllers/userController.js

/**
 * @desc   Kullanıcıyı diğerleriyle eşleştirir (CineMatch Algoritması)
 * @route  POST /api/users/matches
 * @access Private
 */
export const findMatches = asyncHandler(async (req, res) => {
  const { type, genres } = req.body;
  const currentUserId = req.user.id;

  if (!type || (type !== 'movie' && type !== 'series')) {
    return sendError(res, 'Valid type (movie or series) is required', 400);
  }

  const Movie = mongoose.model('Movie');
  const Series = mongoose.model('Series');
  const TargetModel = type === 'movie' ? Movie : Series;
  const GenreMap = type === 'movie' ? MOVIE_GENRE_MAP : SERIES_GENRE_MAP;

  // 1. Tüm kullanıcıları ve watchlist'lerini çek (Kendin hariç)
  const allUsers = await User.find({ _id: { $ne: currentUserId } })
    .select('_id username profile_pic_url watchlist')
    .limit(100)
    .lean();

  // Kendi verini çek
  const currentUser = await User.findById(currentUserId).select('watchlist').lean();
  
  if (!currentUser.watchlist || currentUser.watchlist.length === 0) {
    return sendError(res, 'Add items to your watchlist to find matches', 400);
  }

  // 2. Tüm içerik ID'lerini topla
  let allContentIds = new Set();
  
  currentUser.watchlist.forEach(item => {
    if (item.itemType === type) allContentIds.add(item.itemId);
  });

  allUsers.forEach(u => {
    u.watchlist.forEach(item => {
      if (item.itemType === type) allContentIds.add(item.itemId);
    });
  });

  // 3. İçerik detaylarını çek
  const contentDetails = await TargetModel.find({ _id: { $in: Array.from(allContentIds) } })
    .select('_id genre_ids')
    .lean();

  const contentGenreMap = {};
  contentDetails.forEach(c => {
    const genreNames = c.genre_ids?.map(id => GenreMap[id]).filter(Boolean) || [];
    contentGenreMap[c._id.toString()] = genreNames;
  });

  // 4. Oyları çek
  const allRatings = await Rating.find({ 
    contentType: type,
    contentId: { $in: Array.from(allContentIds) }
  }).select('user contentId value').lean();

  const userRatingsMap = {};
  allRatings.forEach(r => {
    if (!userRatingsMap[r.user]) userRatingsMap[r.user] = {};
    userRatingsMap[r.user][r.contentId] = r.value;
  });

  // Helper function to calculate user vector
  const calculateUserVector = (userObj) => {
    const vector = {};
    const counts = {};
    const myRatings = userRatingsMap[userObj._id] || {};

    userObj.watchlist.forEach(item => {
      if (item.itemType !== type) return;
      
      const itemGenres = contentGenreMap[item.itemId] || [];
      const rating = myRatings[item.itemId] || 5;

      itemGenres.forEach(genre => {
        if (!vector[genre]) { vector[genre] = 0; counts[genre] = 0; }
        vector[genre] += rating;
        counts[genre] += 1;
      });
    });

    Object.keys(vector).forEach(g => {
      vector[g] = vector[g] / counts[g];
    });

    return vector;
  };

  // Calculate user profile
  const myVector = calculateUserVector(currentUser);
  
  if (Object.keys(myVector).length === 0) {
    return sendSuccess(res, [], 'No matches found', 200);
  }

  // Calculate matches
  const matches = allUsers.map(otherUser => {
    const otherVector = calculateUserVector(otherUser);
    
    let score = 0;
    let commonGenres = 0;

    const genresToCompare = (genres && genres.length > 0) 
      ? genres 
      : Object.keys(myVector);

    genresToCompare.forEach(genre => {
      if (otherVector[genre]) {
        const myScore = myVector[genre];
        const otherScore = otherVector[genre];
        const diff = Math.abs(myScore - otherScore);
        score += (10 - diff); 
        commonGenres++;
      }
    });

    if (commonGenres === 0) return null;

    const matchPercentage = (score / commonGenres) * 10;

    return {
      user: otherUser,
      matchPercentage: Math.round(matchPercentage),
      sharedGenres: commonGenres
    };
  })
    .filter(Boolean)
    .sort((a, b) => b.matchPercentage - a.matchPercentage)
    .slice(0, 10);

  sendSuccess(res, matches, 'Matches found', 200);
});

export const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Validation
  if (!currentPassword || !newPassword) {
    return sendError(res, 'Current password and new password are required', 400);
  }

  if (newPassword.length < 6) {
    return sendError(res, 'New password must be at least 6 characters', 400);
  }

  // Kullanıcıyı şifresiyle birlikte bul (select ile şifreyi dahil et)
  const user = await User.findById(req.user.id).select('+password');

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  // Mevcut şifreyi kontrol et
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    return sendError(res, 'Current password is incorrect', 400);
  }

  // Yeni şifreyi hash'le ve kaydet
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  await user.save();

  sendSuccess(res, null, 'Password updated successfully', 200);
});

/**
 * @desc   Kullanıcı hesabını kalıcı olarak siler
 * @route  DELETE /api/users/profile
 * @access Private
 */
export const deleteAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  // --- TEMİZLİK İŞLEMİ ---
  // Kullanıcı silinmeden önce ona ait verileri de silelim.
  
  // 1. Verdiği oyları sil
  await Rating.deleteMany({ user: user._id });
  
  // 2. Bildirimlerini sil
  await Notification.deleteMany({ user: user._id });
  await Notification.deleteMany({ sender: user._id }); 

  // 3. Kullanıcıyı takipçi listelerinden temizle
  await User.updateMany(
      { following: user._id },
      { $pull: { following: user._id } }
  );
  await User.updateMany(
      { followers: user._id },
      { $pull: { followers: user._id } }
  );

  // --- SON OLARAK KULLANICIYI SİL ---
  await User.findByIdAndDelete(user._id);

  sendSuccess(res, null, 'Account and all associated data deleted successfully', 200);
});

// @desc    Get current logged-in user's profile
// @route   GET /api/users/me
// @access  Private
export const getMyProfile = asyncHandler(async (req, res) => {
  // authMiddleware attaches req.user with user data from token
  const user = req.user;

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  sendSuccess(res, user, 'Profile fetched', 200);
});

// @desc    Watchlist'e item ekle
// @route   POST /api/users/me/watchlist
// @access  Private
export const addToWatchlist = asyncHandler(async (req, res) => {
  const { id, type } = req.body;
  const userId = req.user.id;

  // Validation
  if (!id || !type) {
    return sendError(res, 'Item ID and type are required', 400);
  }

  if (!['movie', 'series'].includes(type)) {
    return sendError(res, 'Type must be "movie" or "series"', 400);
  }

  // Validate MongoDB ID
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return sendError(res, 'Invalid item ID', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  // Check if already in watchlist
  const exists = user.watchlist.find(
    (item) => item.itemId.toString() === id && item.itemType === type
  );
  if (exists) {
    return sendError(res, 'Item already in watchlist', 400);
  }

  // Add to watchlist
  user.watchlist.push({ itemId: id, itemType: type });
  await user.save();

  sendSuccess(res, user.watchlist, 'Item added to watchlist', 200);
});

// @desc    Watchlist'ten item çıkar
// @route   DELETE /api/users/me/watchlist/:itemId
// @access  Private
export const removeFromWatchlist = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const userId = req.user.id;

  // Validation
  if (!itemId) {
    return sendError(res, 'Item ID is required', 400);
  }

  if (!itemId.match(/^[0-9a-fA-F]{24}$/)) {
    return sendError(res, 'Invalid item ID', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  // Check if item exists in watchlist
  const itemExists = user.watchlist.find(
    (item) => item.itemId.toString() === itemId
  );
  if (!itemExists) {
    return sendError(res, 'Item not found in watchlist', 404);
  }

  // Remove from watchlist
  user.watchlist = user.watchlist.filter(
    (item) => item.itemId.toString() !== itemId
  );
  await user.save();

  sendSuccess(res, user.watchlist, 'Item removed from watchlist', 200);
});