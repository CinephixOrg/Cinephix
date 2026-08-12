// controllers/userController.js
import User from "../models/User.js";
import AdmZip from "adm-zip";
import csv from "csv-parser";
import { Readable } from "stream";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";

// --- NEW ADDED IMPORT ---
// Import Notification model here
import Notification from "../models/Notification.js";
import ActivityLog from "../models/ActivityLog.js";
import Rating from "../models/Rating.js";
import Review from "../models/Review.js";
import FollowRequest from "../models/FollowRequest.js";
// --- END ---
import mongoose from 'mongoose'; // <-- NEW IMPORT (REQUIRED)

// New imports for consistent responses and error handling
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError, sendPaginated } from "../utils/response.js";
import { validateEmail } from "../middleware/validation.js";
import { MOVIE_GENRE_MAP, SERIES_GENRE_MAP } from "../utils/genreConstants.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../utils/emailService.js";

// @desc    Register a new user
// @route   POST /api/users/register
export const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;
  const normalizedUsername = (username || '').trim();
  const normalizedEmail = (email || '').trim().toLowerCase();

  // Input validation
  if (!normalizedUsername || !normalizedEmail || !password) {
    return sendError(res, 'Username, email, and password are required', 400);
  }

  if (!validateEmail(normalizedEmail)) {
    return sendError(res, 'Invalid email format', 400);
  }

  if (normalizedUsername.length < 3 || normalizedUsername.length > 20) {
    return sendError(res, 'Username must be between 3 and 20 characters', 400);
  }

  if (password.length < 6) {
    return sendError(res, 'Password must be at least 6 characters', 400);
  }

  // Check if user already exists
  const userExists = await User.findOne({ email: normalizedEmail });
  if (userExists) {
    return sendError(res, 'Email already registered', 400);
  }

  const usernameExists = await User.findOne({ username: normalizedUsername });
  if (usernameExists) {
    return sendError(res, 'Username already in use', 400);
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create user
  let user;
  try {
    user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
    });
  } catch (err) {
    if (err?.code === 11000) {
      if (err.keyPattern?.email) return sendError(res, 'Email already registered', 400);
      if (err.keyPattern?.username) return sendError(res, 'Username already in use', 400);
      return sendError(res, 'Duplicate account data', 400);
    }
    throw err;
  }

  // Send email verification code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  user.emailVerificationCode = code;
  user.emailVerificationExpires = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();

  try {
    await sendVerificationEmail(normalizedEmail, code);
  } catch (emailErr) {
    console.error('Email send failed:', emailErr.message);
  }

  sendSuccess(res, { email: user.email }, 'Registration successful. Please verify your email.', 201);
});

// @desc    User login and return token
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

  if (!user) {
    return sendError(res, 'Invalid email or password', 401);
  }

  // Google-only account
  if (user.googleId && !user.password) {
    return sendError(res, 'This account was created with Google. Please login with Google.', 400);
  }

  if (!(await bcrypt.compare(password, user.password))) {
    return sendError(res, 'Invalid email or password', 401);
  }

  // Block unverified accounts (only if isEmailVerified is explicitly false, not undefined)
  if (user.isEmailVerified === false) {
    return sendError(res, 'EMAIL_NOT_VERIFIED', 403);
  }

  // Generate token
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });

  sendSuccess(res, {
    _id: user._id,
    username: user.username,
    email: user.email,
    profile_pic_url: user.profile_pic_url || '',
    googleId: user.googleId || null,
    isOAuthUser: Boolean(user.googleId && !user.password),
    token,
  }, 'Login successful', 200);
});

// @desc    Get all users (for testing only)
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

// ... (registerUser, loginUser, getUsers functions remain the same)

// @desc    Follow a user
// @route   POST /api/users/follow
// @access  Private (Login required)
export const followUser = asyncHandler(async (req, res) => {
  const loggedInUserId = req.user.id;
  
  // As requested by user: extract targetId from req.body
  const { targetId } = req.body;
  const userToFollowId = targetId || req.params.id;

  if (!userToFollowId) {
    console.error("Backend Error: targetId is missing in request body! req.body =", req.body, "req.params =", req.params);
    return res.status(400).json({ message: "Validation Error: targetId is required" });
  }

  if (loggedInUserId === userToFollowId) {
    return sendError(res, 'You cannot follow yourself', 400);
  }

  const userToFollow = await User.findById(userToFollowId);
  if (!userToFollow) {
    return sendError(res, 'User not found', 404);
  }

  if (req.user.following.includes(userToFollowId)) {
    return res.status(200).json({ success: true, data: { type: 'following' } });
  }

  const visibility = userToFollow.visibility || 'public';

  if (visibility === 'private') {
    const existingReq = await FollowRequest.findOne({ requesterId: loggedInUserId, targetId: userToFollowId });
    if (!existingReq) {
       await FollowRequest.create({ requesterId: loggedInUserId, targetId: userToFollowId, status: 'pending' });
       await Notification.create({ user: userToFollowId, sender: loggedInUserId, type: 'follow_request', read: false });
       console.log("Notification created successfully for:", userToFollowId);
    }
    return sendSuccess(res, { type: 'requested' }, 'Follow request sent', 200);
  } else {
    await User.updateOne(
      { _id: loggedInUserId },
      { $addToSet: { following: userToFollowId } }
    );

    await User.updateOne(
      { _id: userToFollowId },
      { $addToSet: { followers: loggedInUserId } }
    );

    await Notification.create({
      user: userToFollowId,
      sender: loggedInUserId,
      type: 'follow'
    });

    return sendSuccess(res, { type: 'following' }, 'User followed successfully', 200);
  }
});

// @desc    Unfollow a user
// @route   POST /api/users/unfollow
// @access  Private (Login required)
export const unfollowUser = asyncHandler(async (req, res) => {
  const loggedInUserId = req.user.id;
  const userToUnfollowId = req.body.targetId || req.params.id;

  if (!userToUnfollowId) {
    return sendError(res, 'Missing target ID', 400);
  }

  // Remove from following/followers
  await User.updateOne(
    { _id: loggedInUserId },
    { $pull: { following: userToUnfollowId } }
  );

  await User.updateOne(
    { _id: userToUnfollowId },
    { $pull: { followers: loggedInUserId } }
  );

  // Remove follow request if exists
  await FollowRequest.deleteOne({ requesterId: loggedInUserId, targetId: userToUnfollowId });

  await Notification.deleteOne({
    user: userToUnfollowId,
    sender: loggedInUserId,
    type: 'follow'
  });

  sendSuccess(res, null, 'User unfollowed successfully', 200);
});

// @desc    Remove a follower
// @route   POST /api/users/remove-follower
// @access  Private
export const removeFollower = asyncHandler(async (req, res) => {
  const { followerId } = req.body;
  const userId = req.user.id;

  if (!followerId) {
    return res.status(400).json({ message: "Missing followerId" });
  }

  await User.updateOne(
    { _id: userId },
    { $pull: { followers: followerId } }
  );

  await User.updateOne(
    { _id: followerId },
    { $pull: { following: userId } }
  );

  return res.status(200).json({ success: true, message: "Follower removed successfully" });
});

// @desc    Accept follow request
// @route   POST /api/users/:targetId/follow-request/accept
// @access  Private
export const acceptFollowRequest = asyncHandler(async (req, res) => {
  const { targetId } = req.params;
  const { requesterId } = req.body;

  if (!targetId || !requesterId) {
    return res.status(400).json({ message: "Missing targetId or requesterId" });
  }

  // Ensure the person accepting the request is actually the target
  if (targetId !== req.user.id) {
    return res.status(403).json({ message: "You can only accept requests directed to you." });
  }

  const followRequest = await FollowRequest.findOne({
    requesterId,
    targetId,
    status: 'pending'
  });

  if (!followRequest) {
    return res.status(404).json({ message: 'Follow request not found' });
  }

  await User.updateOne(
    { _id: requesterId },
    { $addToSet: { following: targetId } }
  );

  await User.updateOne(
    { _id: targetId },
    { $addToSet: { followers: requesterId } }
  );

  await FollowRequest.findByIdAndDelete(followRequest._id);

  await Notification.findOneAndDelete({
    user: targetId,
    sender: requesterId,
    type: 'follow_request'
  });

  await Notification.create({
    user: requesterId,
    sender: targetId,
    type: 'follow_accepted',
    read: false
  });
  console.log("Notification created successfully for:", requesterId);

  return res.status(200).json({ success: true, message: 'Follow request accepted' });
});

// @desc    Reject follow request
// @route   POST /api/users/:targetId/follow-request/reject
// @access  Private
export const rejectFollowRequest = asyncHandler(async (req, res) => {
  const { targetId } = req.params;
  const { requesterId } = req.body;

  if (!targetId || !requesterId) {
    return res.status(400).json({ message: "Missing targetId or requesterId" });
  }

  if (targetId !== req.user.id) {
    return res.status(403).json({ message: "You can only reject requests directed to you." });
  }

  const followRequest = await FollowRequest.findOneAndDelete({
    requesterId,
    targetId,
    status: 'pending'
  });

  if (!followRequest) {
    return res.status(404).json({ message: 'Follow request not found' });
  }

  await Notification.findOneAndDelete({
    user: targetId,
    sender: requesterId,
    type: 'follow_request'
  });

  return res.status(200).json({ success: true, message: 'Follow request rejected' });
});

// @desc    Get pending follow requests
// @route   GET /api/users/me/follow-requests
// @access  Private
export const getPendingRequests = asyncHandler(async (req, res) => {
  const loggedInUserId = req.user.id;

  const requests = await FollowRequest.find({ targetId: loggedInUserId, status: 'pending' })
    .populate('requesterId', '_id username profile_pic_url name bio')
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json(requests.map(r => r.requesterId).filter(Boolean));
});

// @desc    Get sent follow requests
// @route   GET /api/users/me/sent-requests
// @access  Private
export const getSentRequests = asyncHandler(async (req, res) => {
  const loggedInUserId = req.user.id;

  const requests = await FollowRequest.find({ requesterId: loggedInUserId, status: 'pending' })
    .select('targetId')
    .lean();

  return res.status(200).json(requests.map(r => r.targetId).filter(Boolean));
});


// @desc    Get logged-in user's notifications
// @route   GET /api/notifications
// @access  Private (Login required)
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

// @desc    Get logged-in user's FOLLOWING list
// @route   GET /api/users/me/following
// @access  Private (Login required)
export const getMyFollowing = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, userId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const targetUserId = userId || req.user.id;
    const viewerId = req.user.id.toString();

    const targetDoc = await User.findById(targetUserId)
        .select('_id visibility followers following')
        .lean();

    if (!targetDoc) {
        return sendError(res, 'User not found', 404);
    }

    if (userId && userId !== viewerId && !isAuthorizedToView(viewerId, targetDoc)) {
        return sendError(res, 'This account is private', 403);
    }

    const user = await User.findById(targetUserId)
        .populate({
            path: 'following',
            select: '_id username profile_pic_url',
            options: {
                skip: skip,
                limit: parseInt(limit)
            }
        })
        .lean();

    const total = targetDoc.following ? targetDoc.following.length : 0;

    sendPaginated(res, user?.following || [], total, parseInt(page), parseInt(limit), 'Following list fetched');
});

// @desc    Get logged-in user's FOLLOWERS list
// @route   GET /api/users/me/followers
// @access  Private (Login required)
export const getMyFollowers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, userId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const targetUserId = userId || req.user.id;
    const viewerId = req.user.id.toString();

    const targetDoc = await User.findById(targetUserId)
        .select('_id visibility followers following')
        .lean();

    if (!targetDoc) {
        return sendError(res, 'User not found', 404);
    }

    if (userId && userId !== viewerId && !isAuthorizedToView(viewerId, targetDoc)) {
        return sendError(res, 'This account is private', 403);
    }

    const user = await User.findById(targetUserId)
        .populate({
            path: 'followers',
            select: '_id username profile_pic_url',
            options: {
                skip: skip,
                limit: parseInt(limit)
            }
        })
        .lean();

    const total = targetDoc.followers ? targetDoc.followers.length : 0;

    sendPaginated(res, user?.followers || [], total, parseInt(page), parseInt(limit), 'Followers list fetched');
});

// @desc    Search users by username
// @route   GET /api/users/search?q=[query]
// @access  Private (Login required)
export const searchUsers = asyncHandler(async (req, res) => {
  const query = req.query.query;
  const { page = 1, limit = 20 } = req.query;

  if (!query) {
    return sendError(res, 'Search query is required', 400);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  // 🔹 Optimize: Use aggregation with $facet to get count + data in ONE query
  const pipeline = [
    {
      $match: {
        username: { $regex: query, $options: 'i' },
        _id: { $ne: new mongoose.Types.ObjectId(req.user.id) }
      }
    },
    {
      $project: {
        _id: 1,
        username: 1,
        profile_pic_url: 1
      }
    },
    {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $skip: skip },
          { $limit: limitNum }
        ]
      }
    }
  ];

  const result = await User.aggregate(pipeline);
  const total = result[0]?.metadata[0]?.total || 0;
  const users = result[0]?.data || [];

  sendPaginated(res, users, total, pageNum, limitNum, 'Users found');
});

// backend/controllers/userController.js

// ... (searchUsers function ends here)

// @desc    Update user's favorite list (movies or series)
// @route   PUT /api/users/me/favorites
// @access  Private
export const updateFavorites = async (req, res) => {
  const { type, list } = req.body; // type: 'movie' or 'series', list: string[] of _ids
  const userId = req.user.id;

  if (!type || !list) {
    return res.status(400).json({ message: "Type and list are required." });
  }
  if (list.length > 5) {
    return res.status(400).json({ message: "Favorite list can contain a maximum of 5 items." });
  }

  try {
    const fieldToUpdate = type === 'movie' ? 'favoriteMovies' : 'favoriteSeries';
    
    // 1. Update user's list
    await User.findByIdAndUpdate(
      userId,
      { [fieldToUpdate]: list }, // Replace list directly with the new list from request
      { new: true, runValidators: true }
    );
    
    // 2. UPDATE: No populate. Just return the current list of IDs.
    res.status(200).json(list);

  } catch (error) {
    res.status(500).json({ message: "Favorites could not be updated.", error: error.message });
  }
};

// controllers/userController.js dosyasının sonuna ekle:

// ... (existing updateFavorites function ends here)

export const isAuthorizedToView = (viewerId, targetUser) => {
  if (!targetUser) return false;
  const visibility = targetUser.visibility || 'public';
  if (!viewerId) return visibility === 'public';
  if (viewerId === targetUser._id.toString()) return true;
  if (visibility === 'public') return true;
  if (targetUser.followers && targetUser.followers.some(id => id.toString() === viewerId)) return true;
  return false;
};

/**
 * @desc   Get user's public profile information (For ProfilePage)
 * @route  GET /api/users/profile/:id
 * @access Private
 */
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').lean();
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentUserId = req.user ? req.user.id.toString() : null;
    let isRequested = false;

    if (currentUserId) {
      const existingRequest = await FollowRequest.findOne({
        requesterId: currentUserId,
        targetId: user._id,
        status: 'pending'
      });
      if (existingRequest) isRequested = true;
    }

    if (!isAuthorizedToView(currentUserId, user)) {
      return res.status(200).json({
        _id: user._id,
        username: user.username,
        profile_pic_url: user.profile_pic_url,
        isPrivate: true,
        isPrivateMasked: true,
        isPrivateAndHidden: true,
        isAuthorized: false,
        isRequested,
        message: "Profile is private"
      });
    }
    
    res.status(200).json({ ...user, isAuthorized: true, isRequested });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateVisibility = asyncHandler(async (req, res) => {
  const { visibility } = req.body;
  if (!['public', 'private'].includes(visibility)) {
    return sendError(res, 'Invalid visibility value', 400);
  }

  const user = await User.findByIdAndUpdate(req.user.id, { visibility }, { new: true }).select('-password');
  sendSuccess(res, { visibility: user.visibility }, 'Visibility updated successfully');
});

// controllers/userController.js

// Right after the existing getUserProfile function

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
    .select('favoriteMovies favoriteSeries visibility followers')
    .populate('favoriteMovies', '_id title poster_path')
    .populate('favoriteSeries', '_id name poster_path')
    .lean();

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  const currentUserId = req.user ? req.user.id.toString() : null;
  
  if (!isAuthorizedToView(currentUserId, user)) {
    return sendSuccess(res, {
      movies: [],
      series: [],
      isPrivateMasked: true,
      isPrivateAndHidden: true,
      isAuthorized: false
    }, 'User favorites fetched (masked)');
  }

  if (!isAuthorizedToView(currentUserId, user)) {
    return sendSuccess(res, {
      movies: [],
      series: [],
      isPrivateMasked: true,
      isPrivateAndHidden: true,
      isAuthorized: false
    }, 'User favorites fetched (masked)');
  }
  
  sendSuccess(res, {
    movies: user.favoriteMovies || [],
    series: user.favoriteSeries || [],
    isAuthorized: true
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

  const { bio, username } = req.body;
  const updateData = {};
  if (bio !== undefined) updateData.bio = bio;

  if (username) {
    const existingUser = await User.findOne({ username });
    if (existingUser && existingUser._id.toString() !== req.user.id) {
      return sendError(res, 'This username is already taken', 400);
    }
    updateData.username = username;
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    updateData,
    { new: true, runValidators: true }
  ).select('-password');

  if (!updatedUser) {
    return sendError(res, 'User not found', 404);
  }

  sendSuccess(res, updatedUser, 'Profile updated successfully', 200);
});

// controllers/userController.js (içinde)

/**
 * @desc   Bir kullanıcının verdiği tüm oyları getirir
 * @route  GET /api/users/ratings/:id
 * @access Private
 */
export const getUserRatings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 100000 } = req.query;
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

  if (req.user?.id?.toString() !== id) {
    return sendError(res, 'You can only update your own profile picture', 403);
  }

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

  const user = await User.findById(targetUserId).select('watchlist visibility followers').lean();
  
  if (!user) {
      return sendSuccess(res, { movieStats: {}, seriesStats: {} }, 'CineGraph fetched', 200);
  }

  const currentUserId = req.user ? req.user.id.toString() : null;
  
  if (!isAuthorizedToView(currentUserId, user)) {
    const movieCount = user.watchlist?.filter(item => item.itemType === 'movie').length || 0;
    const seriesCount = user.watchlist?.filter(item => item.itemType === 'series').length || 0;
    
    return sendSuccess(res, { 
      movieStats: {}, 
      seriesStats: {}, 
      isPrivateMasked: true,
      isPrivateAndHidden: true,
      isAuthorized: false,
      totalMovies: movieCount,
      totalSeries: seriesCount
    }, 'CineGraph fetched (masked)', 200);
  }
  
  if (!user.watchlist || user.watchlist.length === 0) {
    return sendSuccess(res, { movieStats: {}, seriesStats: {}, isAuthorized: true }, 'CineGraph fetched', 200);
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

  sendSuccess(res, { movieStats: movieGenreCounts, seriesStats: seriesGenreCounts, isAuthorized: true }, 'CineGraph fetched', 200);
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
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id).select('+password');

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  if (user.googleId && !user.password) {
    return sendError(res, 'Logged in via Google. Password management is handled by Google.', 400);
  }

  const isMatch = await bcrypt.compare(oldPassword, user.password);
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
  // Re-fetch without password hash and add a stable OAuth flag for frontend settings logic
  const user = await User.findById(req.user.id).select('-password').lean();

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  user.isOAuthUser = Boolean(user.googleId && !user.password);

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

  await ActivityLog.create({
    userId,
    actionType: 'ADD_WATCHLIST',
    details: `Added ${type} to watchlist`,
    payload: {
      addedWatchlistIds: [id]
    }
  });

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

// @desc    Get suggested users to follow (friends-of-friends)
// @route   GET /api/users/me/suggestions
// @access  Private
export const getSuggestedUsers = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const limit = Math.min(parseInt(req.query.limit) || 5, 10);

  const currentUser = await User.findById(userId).select('following').lean();
  const followingIds = currentUser?.following || [];
  const followingSet = new Set(followingIds.map((id) => id.toString()));

  if (followingIds.length === 0) {
    return sendSuccess(res, [], 'No suggestions yet — follow some people first!');
  }

  // Get who each of your followings follows
  // OPTIMIZATION: Only sample the last 50 followings to prevent massive lag if user follows thousands of people
  const sampleFollowingIds = followingIds.slice(-50);

  const followingsData = await User.find({ _id: { $in: sampleFollowingIds } })
    .select('following')
    .lean();

  // Count how many of your friends follow each candidate
  const mutualCount = {};
  for (const u of followingsData) {
    for (const fof of (u.following || [])) {
      const id = fof.toString();
      if (id !== userId.toString() && !followingSet.has(id)) {
        mutualCount[id] = (mutualCount[id] || 0) + 1;
      }
    }
  }

  const candidateIds = Object.keys(mutualCount)
    .sort((a, b) => mutualCount[b] - mutualCount[a])
    .slice(0, limit);

  if (candidateIds.length === 0) {
    return sendSuccess(res, [], 'No suggestions found');
  }

  const candidates = await User.find({ _id: { $in: candidateIds } })
    .select('username profile_pic_url bio')
    .lean();

  const result = candidates
    .map((u) => ({ ...u, mutualCount: mutualCount[u._id.toString()] }))
    .sort((a, b) => b.mutualCount - a.mutualCount);

  sendSuccess(res, result, 'Suggestions fetched');
});
// @desc    Resend / send email verification code
// @route   POST /api/users/send-verification
export const sendEmailVerificationCode = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return sendError(res, 'Email is required', 400);

  const user = await User.findOne({ email });
  if (!user) return sendError(res, 'User not found', 404);
  if (user.isEmailVerified) return sendError(res, 'Email already verified', 400);

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  user.emailVerificationCode = code;
  user.emailVerificationExpires = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();

  await sendVerificationEmail(email, code);
  sendSuccess(res, null, 'Verification code sent');
});

// @desc    Verify email with code
// @route   POST /api/users/verify-email
export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return sendError(res, 'Email and code are required', 400);

  const user = await User.findOne({ email });
  if (!user) return sendError(res, 'User not found', 404);
  if (user.isEmailVerified) return sendError(res, 'Email already verified', 400);

  if (!user.emailVerificationCode || !user.emailVerificationExpires) {
    return sendError(res, 'No verification code found. Please request a new one.', 400);
  }
  if (user.emailVerificationExpires < Date.now()) {
    return sendError(res, 'Verification code expired. Please request a new one.', 400);
  }
  if (user.emailVerificationCode !== code.trim()) {
    return sendError(res, 'Invalid verification code', 400);
  }

  user.isEmailVerified = true;
  user.emailVerificationCode = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  sendSuccess(res, {
    _id: user._id,
    username: user.username,
    email: user.email,
    profile_pic_url: user.profile_pic_url,
    googleId: user.googleId || null,
    isOAuthUser: Boolean(user.googleId && !user.password),
    token,
  }, 'Email verified successfully');
});

// @desc    Send password reset code
// @route   POST /api/users/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return sendError(res, 'Email is required', 400);

  const user = await User.findOne({ email });
  if (!user) return sendError(res, 'No account found with this email', 404);
  if (user.googleId && !user.password) {
    return sendError(res, 'This account was created with Google. Password reset is not required.', 400);
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  user.passwordResetCode = code;
  user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();

  try {
    await sendPasswordResetEmail(email, code);
  } catch (emailErr) {
    console.error('Password reset email failed:', emailErr.message);
    return sendError(res, 'Failed to send reset email. Please try again later.', 503);
  }
  sendSuccess(res, null, 'Password reset code sent to your email');
});

// @desc    Reset password with code
// @route   POST /api/users/reset-password
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return sendError(res, 'Email, code, and newPassword are required', 400);
  }
  if (newPassword.length < 6) {
    return sendError(res, 'Password must be at least 6 characters', 400);
  }

  const user = await User.findOne({ email });
  if (!user) return sendError(res, 'User not found', 404);

  if (!user.passwordResetCode || !user.passwordResetExpires) {
    return sendError(res, 'No reset code found. Please request a new one.', 400);
  }
  if (user.passwordResetExpires < Date.now()) {
    return sendError(res, 'Reset code expired. Please request a new one.', 400);
  }
  if (user.passwordResetCode !== code.trim()) {
    return sendError(res, 'Invalid reset code', 400);
  }

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  user.passwordResetCode = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  sendSuccess(res, null, 'Password successfully reset');
});

// @desc    Google OAuth callback - generate JWT and redirect to frontend
export const googleAuthCallback = asyncHandler(async (req, res) => {
  const user = req.user;
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

  const userData = encodeURIComponent(JSON.stringify({
    _id: user._id,
    username: user.username,
    email: user.email,
    profile_pic_url: user.profile_pic_url || '',
    googleId: user.googleId || null,
    isOAuthUser: Boolean(user.googleId && !user.password),
    token,
    isNewOAuthUser: req.authInfo?.isNewOAuthUser || false
  }));

  if (req.query.state) {
    try {
      const decoded = JSON.parse(Buffer.from(req.query.state, 'base64url').toString('utf8'));
      if (decoded?.mobile && decoded.redirectUri) {
        return res.redirect(`${decoded.redirectUri}?data=${userData}`);
      }
    } catch (e) {
      // Not a mobile state payload (or malformed) — fall through to the web redirect.
    }
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(`${frontendUrl}/oauth-success?data=${userData}`);
});

// @desc    Get profile statistics and analysis for current user
// @route   GET /api/users/profile-analysis
// @access  Private
export const getProfileAnalysis = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const Movie = mongoose.model('Movie');
  const Series = mongoose.model('Series');

  // Fetch user info for watchlist and social counts
  const user = await User.findById(userId)
    .select("watchlist followers following")
    .lean();

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  // 1. Movies Watched & Ratings
  const movieRatings = await Rating.find({ user: userId, contentType: "movie" }).lean();
  const moviesWatchedCount = movieRatings.length;
  
  let moviesAvgRating = 0;
  let topMovieGenres = [];

  if (moviesWatchedCount > 0) {
    const totalMovieVal = movieRatings.reduce((sum, r) => sum + r.value, 0);
    moviesAvgRating = Math.round((totalMovieVal / moviesWatchedCount) * 10) / 10;

    // Fetch movies to get genres
    const movieIds = movieRatings.map(r => r.contentId);
    const moviesData = await Movie.find({ _id: { $in: movieIds } }).select("genre_ids").lean();
    
    const genreCounts = {};
    for (const m of moviesData) {
      if (m.genre_ids && Array.isArray(m.genre_ids)) {
        for (const gId of m.genre_ids) {
          const gName = MOVIE_GENRE_MAP[gId];
          if (gName) {
            genreCounts[gName] = (genreCounts[gName] || 0) + 1;
          }
        }
      }
    }

    topMovieGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);
  }

  // 2. Series Watched & Ratings
  const seriesRatings = await Rating.find({ user: userId, contentType: "series" }).lean();
  const seriesWatchedCount = seriesRatings.length;

  let seriesAvgRating = 0;
  let topSeriesGenres = [];

  if (seriesWatchedCount > 0) {
    const totalSeriesVal = seriesRatings.reduce((sum, r) => sum + r.value, 0);
    seriesAvgRating = Math.round((totalSeriesVal / seriesWatchedCount) * 10) / 10;

    // Fetch series to get genres
    const seriesIds = seriesRatings.map(r => r.contentId);
    const seriesData = await Series.find({ _id: { $in: seriesIds } }).select("genre_ids").lean();

    const genreCounts = {};
    for (const s of seriesData) {
      if (s.genre_ids && Array.isArray(s.genre_ids)) {
        for (const gId of s.genre_ids) {
          const gName = SERIES_GENRE_MAP[gId];
          if (gName) {
            genreCounts[gName] = (genreCounts[gName] || 0) + 1;
          }
        }
      }
    }

    topSeriesGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);
  }

  // 3. Watchlist
  const watchlistCount = user.watchlist ? user.watchlist.length : 0;

  // 4. Social
  const reviewsCount = await Review.countDocuments({ user: userId });
  const followingCount = user.following ? user.following.length : 0;
  const followersCount = user.followers ? user.followers.length : 0;

  const payload = {
    movies: {
      watchedCount: moviesWatchedCount,
      topGenres: topMovieGenres,
      avgRating: moviesAvgRating
    },
    series: {
      watchedCount: seriesWatchedCount,
      topGenres: topSeriesGenres,
      avgRating: seriesAvgRating
    },
    watchlist: watchlistCount,
    social: {
      reviewsCount,
      followingCount,
      followersCount
    }
  };

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Analyze the user profile metrics:\n${JSON.stringify(payload, null, 2)}`
                  }
                ]
              }
            ],
            systemInstruction: {
              parts: [
                {
                  text: `Act as a witty, expert cinema analyst. Analyze the user's movie/series metrics and output STRICTLY a JSON object matching this exact schema (No markdown wrapper like \`\`\`json, just pure stringified JSON):\n{\n  "nickname": "e.g., Sci-Fi Voyager, Elitist Couch Potato, Fast & Furious Enthusiast",\n  "personalitySummary": "A 2-3 sentence cinematic breakdown of their watch habits, rating styles, and social footprints.",\n  "funFact": "A humorous, data-driven joke based on their specific stats.",\n  "recommendedConcept": "A short sentence advising what vibe or category they should dive into next."\n}`
                }
              ]
            },
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        }
      );

      if (response.ok) {
        const resJson = await response.json();
        const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsedAnalysis = JSON.parse(text);
          return sendSuccess(res, parsedAnalysis, "Profile analysis generated successfully by Gemini");
        }
      } else {
        console.error(`Gemini API returned status ${response.status}`);
      }
    } catch (apiError) {
      console.error("Gemini API call failed, falling back to mock:", apiError.message);
    }
  }

  // Graceful Mock Fallback
  const mockAnalysis = generateMockAnalysis(payload);
  return sendSuccess(res, mockAnalysis, "Profile analysis generated successfully (Mock)");
});

// Helper for witty local mock analysis
const generateMockAnalysis = (payload) => {
  const movieCount = payload.movies.watchedCount || 0;
  const seriesCount = payload.series.watchedCount || 0;
  const totalCount = movieCount + seriesCount;

  let nickname = "Cinematic Ghost";
  let personalitySummary = "You are a mysterious presence in the Cinephix database. With few ratings or reviews, your taste remains an enigma to both friends and algorithms.";
  let funFact = "You've rated 0 items—you have the self-control of a monk in a popcorn factory.";
  let recommendedConcept = "Dive into a highly-rated cinema classic to start building your profile!";

  if (totalCount > 0) {
    const movieGenre = payload.movies.topGenres?.[0];
    const seriesGenre = payload.series.topGenres?.[0];
    const favGenre = movieGenre || seriesGenre || "Drama";
    
    if (movieCount > seriesCount) {
      nickname = `${favGenre} Cinephile`;
      personalitySummary = `You are a dedicated movie fan with a clear preference for the silver screen. With ${movieCount} movies rated and a preference for ${favGenre}, your taste profile shows deep appreciation for cinematic storytelling.`;
    } else {
      nickname = `${favGenre} Binge Watcher`;
      personalitySummary = `You prefer long-form storytelling, having rated ${seriesCount} series. You spend hours immersed in character arcs and season-long dramas, especially in the ${favGenre} realm.`;
    }
    
    funFact = `Your average movie rating is ${payload.movies.avgRating || 'N/A'}/10, suggesting you are ${payload.movies.avgRating > 7 ? 'an easy pleaser' : 'a tough critic who demands absolute perfection'}.`;
    recommendedConcept = `Try stepping out of your comfort zone of ${favGenre} and explore a highly rated documentary or classic noir.`;
  } else if (payload.watchlist > 0) {
    nickname = "Couch Potato Planner";
    personalitySummary = "You possess a massive list of films and series you plan to watch, but your rating count remains zero.";
    funFact = `You have ${payload.watchlist} items in your watchlist but 0 ratings, meaning you spend 99% of your time browsing lists.`;
    recommendedConcept = "Stop reading reviews and hit play on the first item in your watchlist!";
  }

  return { nickname, personalitySummary, funFact, recommendedConcept };
};

// @desc    Import TV Time ZIP archive (movies.json & shows.json)
// @route   POST /api/users/import-tvtime
export const importTVTimeData = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const importStartTime = new Date();
  console.log("importTVTimeData called for user:", userId);

  // Establish text/event-stream connection
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    if (!req.file) {
      sendEvent({ status: "error", message: "Please upload a ZIP file" });
      return res.end();
    }

    let zip;
    try {
      zip = new AdmZip(req.file.buffer);
    } catch (err) {
      sendEvent({ status: "error", message: "Invalid ZIP archive" });
      return res.end();
    }

    const zipEntries = zip.getEntries();
    const moviesEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith("movies.json"));
    const showsEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith("shows.json"));

    if (!moviesEntry && !showsEntry) {
      sendEvent({ status: "error", message: "Archive must contain movies.json or shows.json" });
      return res.end();
    }

    const Movie = mongoose.model("Movie");
    const Series = mongoose.model("Series");
    const user = await User.findById(userId);
    if (!user) {
      sendEvent({ status: "error", message: "User not found" });
      return res.end();
    }

    user.watchlist = user.watchlist || [];
    user.toWatchList = user.toWatchList || [];
    const existingWatchlistMovieIds = new Set(user.watchlist.filter(w => w.itemType === 'movie').map(w => w.itemId.toString()));
    const existingToWatchMovieIds = new Set(user.toWatchList.filter(w => w.itemType === 'movie').map(w => w.itemId.toString()));
    const existingWatchlistSeriesIds = new Set(user.watchlist.filter(w => w.itemType === 'series').map(w => w.itemId.toString()));

    const existingRatingsDocs = await Rating.find({ user: userId }).select('contentId contentType value').lean();
    const existingRatingsMap = new Map();
    existingRatingsDocs.forEach(r => existingRatingsMap.set(`${r.contentType}_${r.contentId.toString()}`, r.value));

    let importedMovies = 0;
    let importedEpisodes = 0;
    let hasChanges = false;
    let hasRatingsChanges = false;
    const newRatingsToInsert = [];

    // Process Movies
    if (moviesEntry) {
      let moviesData = [];
      try { moviesData = JSON.parse(moviesEntry.getData().toString("utf8")); } catch (err) {}
      
      if (Array.isArray(moviesData) && moviesData.length > 0) {
        sendEvent({ step: "movies", current: 0, total: moviesData.length, text: "Pre-fetching movie data..." });
        
        // Bulk fetch movies
        const tvdbIds = [], imdbIds = [], titles = [];
        for (const m of moviesData) {
          const tvdbId = m.id?.tvdb || m["id.tvdb"];
          const imdbId = m.id?.imdb || m["id.imdb"];
          if (tvdbId) tvdbIds.push(tvdbId);
          if (imdbId && imdbId !== "-1" && imdbId !== -1) imdbIds.push(imdbId);
          if (m.title) titles.push(new RegExp(`^${m.title.trim()}$`, "i"));
        }
        
        const dbMovies = await Movie.find({
          $or: [
            { "id.tvdb": { $in: tvdbIds } }, { tvdb: { $in: tvdbIds } }, { tvdb_id: { $in: tvdbIds } },
            { "id.imdb": { $in: imdbIds } }, { imdb: { $in: imdbIds } }, { imdb_id: { $in: imdbIds } },
            { title: { $in: titles } }
          ]
        }).lean();

        for (let i = 0; i < moviesData.length; i++) {
          if (i % 50 === 0) {
            sendEvent({ step: "movies", current: i, total: moviesData.length, text: `Matching movies... (${i}/${moviesData.length})` });
          }
          const movieItem = moviesData[i];
          const tvdbId = movieItem.id?.tvdb || movieItem["id.tvdb"];
          const imdbId = movieItem.id?.imdb || movieItem["id.imdb"];
          const title = movieItem.title || "Untitled Movie";
          const isWatched = movieItem.is_watched;
          const watchedAt = movieItem.watched_at ? new Date(movieItem.watched_at) : new Date();
          const ratingValue = movieItem.rating;

          // Find in pre-fetched dbMovies
          let dbMovie = dbMovies.find(m => 
            (tvdbId && (m.id?.tvdb == tvdbId || m.tvdb == tvdbId || m.tvdb_id == tvdbId)) ||
            (imdbId && imdbId !== "-1" && imdbId !== -1 && (m.id?.imdb == imdbId || m.imdb == imdbId || m.imdb_id == imdbId)) ||
            (title && m.title.toLowerCase() === title.trim().toLowerCase())
          );

          if (dbMovie) {
            const contentIdStr = dbMovie._id.toString();
            if (isWatched) {
              if (!existingWatchlistMovieIds.has(contentIdStr)) {
                user.watchlist.push({ itemId: dbMovie._id, itemType: "movie", addedAt: watchedAt });
                existingWatchlistMovieIds.add(contentIdStr);
                hasChanges = true;
                importedMovies++;
              }
              if (ratingValue && ratingValue > 0 && !existingRatingsMap.has(`movie_${contentIdStr}`)) {
                const val = Math.max(1, Math.min(10, ratingValue));
                newRatingsToInsert.push({ user: userId, contentId: contentIdStr, contentType: "movie", value: val });
                existingRatingsMap.set(`movie_${contentIdStr}`, val);
                hasRatingsChanges = true;
              }
            } else {
              if (!existingToWatchMovieIds.has(contentIdStr)) {
                user.toWatchList.push({ itemId: dbMovie._id, itemType: "movie", addedAt: watchedAt });
                existingToWatchMovieIds.add(contentIdStr);
                hasChanges = true;
              }
            }
          }
        }
      }
    }

    // Process Shows
    if (showsEntry) {
      let showsData = [];
      try { showsData = JSON.parse(showsEntry.getData().toString("utf8")); } catch (err) {}

      let totalEpisodes = 0;
      if (Array.isArray(showsData)) {
        for (const s of showsData) {
          if (s.seasons) {
            for (const season of s.seasons) {
              if (season.episodes) {
                totalEpisodes += season.episodes.filter(ep => ep.is_watched).length;
              }
            }
          }
        }
      }

      if (totalEpisodes > 0 && Array.isArray(showsData)) {
        sendEvent({ step: "shows", current: 0, total: totalEpisodes, text: "Pre-fetching series data..." });

        const tvdbIds = [], imdbIds = [], titles = [];
        for (const s of showsData) {
          const tvdbId = s.id?.tvdb || s["id.tvdb"];
          const imdbId = s.id?.imdb || s["id.imdb"];
          if (tvdbId) tvdbIds.push(tvdbId);
          if (imdbId && imdbId !== "-1" && imdbId !== -1) imdbIds.push(imdbId);
          if (s.title || s.name) titles.push(new RegExp(`^${(s.title || s.name).trim()}$`, "i"));
        }

        const dbSeriesList = await Series.find({
          $or: [
            { "id.tvdb": { $in: tvdbIds } }, { tvdb: { $in: tvdbIds } }, { tvdb_id: { $in: tvdbIds } },
            { "id.imdb": { $in: imdbIds } }, { imdb: { $in: imdbIds } }, { imdb_id: { $in: imdbIds } },
            { name: { $in: titles } }
          ]
        }).lean();

        let currentEpIndex = 0;
        for (const showItem of showsData) {
          const tvdbId = showItem.id?.tvdb || showItem["id.tvdb"];
          const imdbId = showItem.id?.imdb || showItem["id.imdb"];
          const showTitle = showItem.title || showItem.name || "Untitled Show";

          let dbSeries = dbSeriesList.find(s => 
            (tvdbId && (s.id?.tvdb == tvdbId || s.tvdb == tvdbId || s.tvdb_id == tvdbId)) ||
            (imdbId && imdbId !== "-1" && imdbId !== -1 && (s.id?.imdb == imdbId || s.imdb == imdbId || s.imdb_id == imdbId)) ||
            (showTitle && s.name.toLowerCase() === showTitle.trim().toLowerCase())
          );

          if (dbSeries) {
            const contentIdStr = dbSeries._id.toString();
            let watchedEpisodesCount = 0;
            let ratingSum = 0, ratingCount = 0;
            let maxWatchedAt = null;

            if (showItem.seasons) {
              for (const season of showItem.seasons) {
                if (season.episodes) {
                  for (const ep of season.episodes) {
                    if (ep.is_watched) {
                      watchedEpisodesCount++;
                      currentEpIndex++;
                      if (currentEpIndex % 100 === 0) {
                        sendEvent({ step: "shows", current: currentEpIndex, total: totalEpisodes, text: `Syncing episodes... (${currentEpIndex}/${totalEpisodes})` });
                      }
                      const epWatchedAt = ep.watched_at ? new Date(ep.watched_at) : new Date();
                      if (!maxWatchedAt || epWatchedAt > maxWatchedAt) maxWatchedAt = epWatchedAt;
                    }
                    if (ep.rating && ep.rating > 0) { ratingSum += ep.rating; ratingCount++; }
                  }
                }
              }
            }

            if (!existingWatchlistSeriesIds.has(contentIdStr) && !existingRatingsMap.has(`series_${contentIdStr}`)) {
              if (watchedEpisodesCount > 0) {
                user.watchlist.push({ itemId: dbSeries._id, itemType: "series", addedAt: maxWatchedAt || new Date() });
                existingWatchlistSeriesIds.add(contentIdStr);
                hasChanges = true;
                importedEpisodes += watchedEpisodesCount;
              }
              if (ratingCount > 0) {
                const avgRating = Math.round(ratingSum / ratingCount);
                const val = Math.max(1, Math.min(10, avgRating));
                newRatingsToInsert.push({ user: userId, contentId: contentIdStr, contentType: "series", value: val });
                existingRatingsMap.set(`series_${contentIdStr}`, val);
                hasRatingsChanges = true;
              }
            }
          } else {
             // Just increment progress for unmatched shows
             if (showItem.seasons) {
                for (const season of showItem.seasons) {
                   if (season.episodes) {
                      for (const ep of season.episodes) {
                         if (ep.is_watched) {
                            currentEpIndex++;
                            if (currentEpIndex % 100 === 0) sendEvent({ step: "shows", current: currentEpIndex, total: totalEpisodes, text: `Syncing episodes... (${currentEpIndex}/${totalEpisodes})` });
                         }
                      }
                   }
                }
             }
          }
        }
        if (currentEpIndex > 0) {
           sendEvent({ step: "shows", current: totalEpisodes, total: totalEpisodes, text: `Syncing episodes completed.` });
        }
      }
    }

    if (newRatingsToInsert.length > 0) {
      await Rating.insertMany(newRatingsToInsert);
    }
    if (hasChanges) {
      await user.save();
    }
    if (hasRatingsChanges) {
      try { await rebuildUserCineGraph(userId); } catch (err) {}
    }

    const addedRatings = await Rating.find({ user: userId, createdAt: { $gte: importStartTime } }).select('_id').lean();
    const addedRatingIds = addedRatings.map(r => r._id);
    const updatedUser = await User.findById(userId).lean();
    const addedWatchlistItems = updatedUser.watchlist.filter(item => new Date(item.addedAt) >= importStartTime);
    const addedWatchlistIds = addedWatchlistItems.map(item => item.itemId.toString());

    await ActivityLog.create({
      userId, actionType: 'IMPORT_TVTIME', details: 'Imported TV Time ZIP archive',
      payload: { addedWatchlistIds, addedRatingIds, updatedCineGraph: hasRatingsChanges }
    });

    sendEvent({ status: "completed", importedMovies, importedEpisodes });
    return res.end();
  } catch (error) {
    console.error("Unhandled error in importTVTimeData:", error);
    sendEvent({ status: "error", message: error.message });
    return res.end();
  }
});

// Helper function to rebuild user CineGraph statistics
async function rebuildUserCineGraph(userId) {
  const User = mongoose.model("User");
  const Rating = mongoose.model("Rating");
  const Movie = mongoose.model("Movie");
  const Series = mongoose.model("Series");

  const user = await User.findById(userId);
  if (!user) return;

  user.movieCineGraph = new Map();
  user.seriesCineGraph = new Map();

  const ratings = await Rating.find({ user: userId });

  for (const r of ratings) {
    if (r.contentType === "movie") {
      const movie = await Movie.findById(r.contentId).lean();
      if (movie && movie.genre_ids) {
        movie.genre_ids
          .map(id => MOVIE_GENRE_MAP[id])
          .filter(Boolean)
          .forEach(g => {
            const node = user.movieCineGraph.get(g) || { count: 0, avgRating: 0 };
            const newCount = node.count + 1;
            const newAvg = (node.avgRating * node.count + r.value) / newCount;
            user.movieCineGraph.set(g, { count: newCount, avgRating: Number(newAvg.toFixed(2)) });
          });
      }
    } else {
      const series = await Series.findById(r.contentId).lean();
      if (series && series.genre_ids) {
        series.genre_ids
          .map(id => SERIES_GENRE_MAP[id])
          .filter(Boolean)
          .forEach(g => {
            const node = user.seriesCineGraph.get(g) || { count: 0, avgRating: 0 };
            const newCount = node.count + 1;
            const newAvg = (node.avgRating * node.count + r.value) / newCount;
            user.seriesCineGraph.set(g, { count: newCount, avgRating: Number(newAvg.toFixed(2)) });
          });
      }
    }
  }

  await user.save();
}

// @desc    Import Letterboxd ZIP archive
// @route   POST /api/users/import-letterboxd
export const importLetterboxdData = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const importStartTime = new Date();

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    if (!req.file) {
      sendEvent({ status: "error", message: "Please upload a ZIP file" });
      return res.end();
    }

    sendEvent({ step: "extract", text: "Extracting ZIP archive..." });

    let zip;
    try {
      zip = new AdmZip(req.file.buffer);
    } catch (err) {
      sendEvent({ status: "error", message: "Invalid ZIP archive" });
      return res.end();
    }

    const zipEntries = zip.getEntries();
    
    // Helper to parse CSV buffer
    const parseCsvBuffer = (buffer) => {
      return new Promise((resolve, reject) => {
        const results = [];
        const stream = Readable.from(buffer.toString('utf-8'));
        stream.pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', (error) => reject(error));
      });
    };

    // Step A: Extract files
    let watchedData = [], ratingsData = [], watchlistData = [], likesData = [];

    const watchedEntry = zipEntries.find(e => e.entryName === "watched.csv");
    const ratingsEntry = zipEntries.find(e => e.entryName === "ratings.csv");
    const watchlistEntry = zipEntries.find(e => e.entryName === "watchlist.csv");
    const likesEntry = zipEntries.find(e => e.entryName === "likes/films.csv" || e.entryName === "likes\\\\films.csv");

    sendEvent({ step: "parse", text: "Parsing CSV files..." });

    // Parse concurrently
    const [wData, rData, wlData, lData] = await Promise.all([
      watchedEntry ? parseCsvBuffer(watchedEntry.getData()) : Promise.resolve([]),
      ratingsEntry ? parseCsvBuffer(ratingsEntry.getData()) : Promise.resolve([]),
      watchlistEntry ? parseCsvBuffer(watchlistEntry.getData()) : Promise.resolve([]),
      likesEntry ? parseCsvBuffer(likesEntry.getData()) : Promise.resolve([])
    ]);
    watchedData = wData; ratingsData = rData; watchlistData = wlData; likesData = lData;

    // Step B: Unified Map
    const unifiedMap = new Map();

    const addToMap = (row, dataToMerge) => {
      const title = row.Name || row.Title;
      const year = row.Year;
      if (!title) return;
      const key = `${title} (${year})`;
      
      const existing = unifiedMap.get(key) || { title, year, isWatched: false, rating: null, inWatchlist: false, isLiked: false };
      unifiedMap.set(key, { ...existing, ...dataToMerge });
    };

    watchedData.forEach(row => addToMap(row, { isWatched: true }));
    ratingsData.forEach(row => addToMap(row, { rating: Number(row.Rating) }));
    watchlistData.forEach(row => addToMap(row, { inWatchlist: true }));
    likesData.forEach(row => addToMap(row, { isLiked: true }));

    const unifiedList = Array.from(unifiedMap.values());
    const totalMovies = unifiedList.length;

    if (totalMovies === 0) {
      sendEvent({ status: "error", message: "No movie data found in the ZIP" });
      return res.end();
    }

    const Movie = mongoose.model("Movie");
    const user = await User.findById(userId);
    if (!user) {
      sendEvent({ status: "error", message: "User not found" });
      return res.end();
    }

    user.watchlist = user.watchlist || [];
    user.toWatchList = user.toWatchList || [];
    user.favorites = user.favorites || [];

    const existingWatchlistIds = new Set(user.watchlist.filter(w => w.itemType === 'movie').map(w => w.itemId.toString()));
    const existingToWatchIds = new Set(user.toWatchList.filter(w => w.itemType === 'movie').map(w => w.itemId.toString()));
    const existingFavoritesIds = new Set(user.favorites.filter(w => w.itemType === 'movie').map(w => w.itemId.toString()));
    
    const existingRatingsDocs = await Rating.find({ user: userId, contentType: "movie" }).select('contentId value').lean();
    const existingRatingsMap = new Map();
    existingRatingsDocs.forEach(r => existingRatingsMap.set(r.contentId.toString(), r.value));

    let importedMovies = 0;
    let hasChanges = false;
    let hasRatingsChanges = false;
    const newRatingsToInsert = [];

    // Step C: Bulk DB Match & TMDB Fetch
    sendEvent({ step: "movies", current: 0, total: totalMovies, text: "Pre-fetching movie data..." });
    
    const titlesForRegex = unifiedList.map(m => new RegExp(`^${m.title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i"));
    const dbMovies = await Movie.find({ title: { $in: titlesForRegex } }).lean();
    const dbMoviesMap = new Map();
    dbMovies.forEach(m => {
       const key = `${m.title.toLowerCase()}_${m.release_date ? m.release_date.substring(0,4) : 'unknown'}`;
       if (!dbMoviesMap.has(key)) dbMoviesMap.set(key, []);
       dbMoviesMap.get(key).push(m);
    });

    const moviesToFetchTMDB = [];

    // Phase 1: Local DB Matching
    for (const movieItem of unifiedList) {
       const { title, year } = movieItem;
       let dbMovie = null;
       
       const titleLower = title.toLowerCase();
       let possibleMatches = [];
       // Find all movies with matching title ignoring case
       for (const dbm of dbMovies) {
          if (dbm.title.toLowerCase() === titleLower) possibleMatches.push(dbm);
       }

       if (possibleMatches.length > 0) {
          if (year) {
             const targetYear = parseInt(year, 10);
             const validMovies = possibleMatches.filter(m => {
                if (!m.release_date) return false;
                const mYear = parseInt(m.release_date.substring(0, 4), 10);
                return Math.abs(mYear - targetYear) <= 1;
             });
             if (validMovies.length > 0) {
                validMovies.sort((a, b) => {
                  const diffA = Math.abs(parseInt(a.release_date.substring(0, 4), 10) - targetYear);
                  const diffB = Math.abs(parseInt(b.release_date.substring(0, 4), 10) - targetYear);
                  return diffA - diffB;
                });
                dbMovie = validMovies[0];
             }
          } else {
             dbMovie = possibleMatches[0];
          }
       }

       if (dbMovie) {
          movieItem.dbMovie = dbMovie; // Attach local match
       } else if (process.env.TMDB_API_KEY) {
          moviesToFetchTMDB.push(movieItem);
       }
    }

    // Phase 2: Concurrent TMDB Fetching (Chunked to avoid rate limits)
    if (moviesToFetchTMDB.length > 0) {
       sendEvent({ step: "movies", current: 0, total: totalMovies, text: `Fetching missing movies from TMDB (${moviesToFetchTMDB.length})...` });
       const chunkSize = 20; // Parallel fetches
       
       for (let i = 0; i < moviesToFetchTMDB.length; i += chunkSize) {
          const chunk = moviesToFetchTMDB.slice(i, i + chunkSize);
          await Promise.all(chunk.map(async (movieItem) => {
             const { title, year } = movieItem;
             let tmdbResult = null;
             const targetYear = year ? parseInt(year, 10) : null;
             
             try {
                if (year) {
                   const strictUrl = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}&primary_release_year=${year}&api_key=${process.env.TMDB_API_KEY}`;
                   const strictRes = await fetch(strictUrl);
                   const strictData = await strictRes.json();
                   if (strictData.results && strictData.results.length > 0) {
                      for (const r of strictData.results) {
                         const matchTitle = r.title?.toLowerCase() === title.toLowerCase() || r.original_title?.toLowerCase() === title.toLowerCase();
                         let matchYear = false;
                         if (r.release_date) {
                            const rYear = parseInt(r.release_date.substring(0, 4), 10);
                            matchYear = Math.abs(rYear - targetYear) <= 1;
                         }
                         if (matchTitle && matchYear) { tmdbResult = r; break; }
                      }
                   }
                }
                if (!tmdbResult) {
                   const fallbackUrl = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}&api_key=${process.env.TMDB_API_KEY}`;
                   const fallbackRes = await fetch(fallbackUrl);
                   const fallbackData = await fallbackRes.json();
                   if (fallbackData.results && fallbackData.results.length > 0) {
                      for (const r of fallbackData.results) {
                         const matchTitle = r.title?.toLowerCase() === title.toLowerCase() || r.original_title?.toLowerCase() === title.toLowerCase();
                         let matchYear = true;
                         if (targetYear && r.release_date) {
                            const rYear = parseInt(r.release_date.substring(0, 4), 10);
                            matchYear = Math.abs(rYear - targetYear) <= 1;
                         } else if (targetYear && !r.release_date) { matchYear = false; }
                         if (matchTitle && matchYear) { tmdbResult = r; break; }
                      }
                   }
                }

                if (tmdbResult) {
                   const tmdbId = tmdbResult.id;
                   let dbMovie = await Movie.findOne({
                     $or: [ { "id.tmdb": tmdbId }, { "tmdb_id": tmdbId }, { "tmdb": tmdbId } ]
                   });

                   if (!dbMovie) {
                     dbMovie = new Movie({
                       title: tmdbResult.title || title,
                       "id": { tmdb: tmdbId },
                       tmdb_id: tmdbId,
                       release_date: tmdbResult.release_date,
                       poster_path: tmdbResult.poster_path,
                       overview: tmdbResult.overview,
                       type: "movie"
                     });
                     await dbMovie.save();
                   }
                   movieItem.dbMovie = dbMovie; // Attach new local match
                }
             } catch(e) {}
          }));
          
          sendEvent({ step: "movies", current: i + chunk.length, total: totalMovies, text: `Fetching from TMDB (${i + chunk.length}/${moviesToFetchTMDB.length})...` });
       }
    }

    // Phase 3: Apply changes
    sendEvent({ step: "movies", current: totalMovies, total: totalMovies, text: `Applying user lists...` });
    for (const movieItem of unifiedList) {
       const dbMovie = movieItem.dbMovie;
       if (!dbMovie) continue;

       const contentIdStr = dbMovie._id.toString();
       let movieImported = false;

       if (movieItem.isWatched) {
          if (!existingWatchlistIds.has(contentIdStr)) {
             user.watchlist.push({ itemId: dbMovie._id, itemType: "movie", addedAt: new Date() });
             existingWatchlistIds.add(contentIdStr);
             hasChanges = true;
             movieImported = true;
          }
       }

       if (movieItem.inWatchlist && !movieItem.isWatched) {
          if (!existingToWatchIds.has(contentIdStr)) {
             user.toWatchList.push({ itemId: dbMovie._id, itemType: "movie", addedAt: new Date() });
             existingToWatchIds.add(contentIdStr);
             hasChanges = true;
             movieImported = true;
          }
       }

       if (movieItem.isLiked) {
          if (!existingFavoritesIds.has(contentIdStr) && user.favorites.length < 4) {
             user.favorites.push({ itemId: dbMovie._id, itemType: "movie" });
             existingFavoritesIds.add(contentIdStr);
             hasChanges = true;
             movieImported = true;
          }
       }

       if (movieItem.rating && !existingRatingsMap.has(contentIdStr)) {
          let val = movieItem.rating;
          if (val <= 5) val = val * 2;
          val = Math.max(1, Math.min(10, val));
          newRatingsToInsert.push({ user: userId, contentId: contentIdStr, contentType: "movie", value: val });
          existingRatingsMap.set(contentIdStr, val);
          hasRatingsChanges = true;
          movieImported = true;
       }

       if (movieImported) {
          importedMovies++;
       }
    }

    sendEvent({ step: "save", text: "Saving to Database..." });

    if (newRatingsToInsert.length > 0) {
       await Rating.insertMany(newRatingsToInsert);
    }
    if (hasChanges) {
      await user.save();
    }

    if (hasRatingsChanges) {
      try {
        await rebuildUserCineGraph(userId);
      } catch (err) {}
    }

    const addedRatings = await Rating.find({ user: userId, createdAt: { $gte: importStartTime } }).select('_id').lean();
    const addedRatingIds = addedRatings.map(r => r._id);
    const updatedUser = await User.findById(userId).lean();
    const addedWatchlistItems = updatedUser.watchlist.filter(item => new Date(item.addedAt) >= importStartTime);
    const addedWatchlistIds = addedWatchlistItems.map(item => item.itemId.toString());

    await ActivityLog.create({
      userId,
      actionType: 'IMPORT_LETTERBOXD',
      details: `Imported ${importedMovies} movies`,
      payload: {
         addedWatchlistIds,
         addedRatingIds,
         updatedCineGraph: hasRatingsChanges
      }
    });

    sendEvent({
      status: "completed",
      importedMovies
    });
    return res.end();

  } catch (error) {
    console.error("Unhandled error in importLetterboxdData:", error);
    sendEvent({ 
      status: "error", 
      message: error.message || "An unexpected error occurred during the Letterboxd import" 
    });
    return res.end();
  }
});
// @desc    Import Letterboxd ZIP archive
// @route   POST /api/users/import-letterboxd