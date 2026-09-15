// controllers/userController.js
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";

// --- NEW ADDED IMPORT ---
// Import Notification model here
import Notification from "../models/Notification.js";
import ActivityLog from "../models/ActivityLog.js";
import Rating from "../models/Rating.js";
import Review from "../models/Review.js";
import { notifyFollow, retractFollow } from "../services/notifications.js";
import FavoriteEvent from "../models/FavoriteEvent.js";
import Share from "../models/Share.js";
import CustomList from "../models/CustomList.js";
import { hydratePreviewItems } from "../utils/listPreview.js";
import { refreshUserCineGraph } from "../utils/cineGraph.js";
import { buildCollectionEntries } from "../utils/publicCollection.js";
import { PUBLIC_ACCESS, PUBLIC_PROFILE } from "../utils/publicProfile.js";
// --- END ---
import mongoose from 'mongoose'; // <-- NEW IMPORT (REQUIRED)

// User text going into a hand-built $regex must be escaped first — an
// unescaped string lets a caller inject regex metacharacters (at best
// unintended matches — e.g. "Zach.ry" matching "Zachary" via the literal
// "." acting as a wildcard, confirmed live — at worst a ReDoS-shaped
// pattern). Same helper as customListRoute.js/reviewController.js/
// movieRoute.js/seriesRoute.js already use.
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Blocks registering with the exact reserved name "cinephix" under any
// case/diacritic disguise (e.g. "CİNEPHİX" with a Turkish dotted İ, which
// naively lowercases to "ci̇nephi̇x" — an extra combining dot per İ, not a
// plain "i" — rather than silently slipping past a plain .toLowerCase()
// check). NFKD-normalizes, strips combining marks, lowercases, then strips
// non-alphanumerics so spacing/punctuation obfuscation ("cine-phix",
// "cine_phix") is also caught. Deliberately an exact-match block, not a
// substring one — real accounts like "cinephix_6gnn" or
// "cinephix_online_test" must stay registrable; only the bare reserved name
// itself is off-limits. Leetspeak substitutions (e.g. "c1nephix") are
// explicitly out of scope — not what was asked, and no such precedent
// exists elsewhere in this codebase's validation.
const RESERVED_USERNAME = "cinephix";
function isReservedUsername(username) {
  const normalized = username
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return normalized === RESERVED_USERNAME;
}

// New imports for consistent responses and error handling
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError, sendPaginated } from "../utils/response.js";
import { validateEmail } from "../middleware/validation.js";
import { MOVIE_GENRE_MAP, SERIES_GENRE_MAP } from "../utils/genreConstants.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../utils/emailService.js";
import { getTierLimits } from "../config/tiers.js";
import {
  resolveDisplayName,
  tallyGenres,
  buildGenreBreakdown,
  buildRecentGenres,
  buildFavoriteGenres,
  buildRatingCurve,
  buildMonthBuckets,
  monthKeyOf,
  monthWindows,
  isWithin,
  averageRating
} from "../utils/analysisMath.js";
import ProfileAnalysis from "../models/ProfileAnalysis.js";
import { getOnlineUserIds } from "../services/presenceService.js";

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

  if (isReservedUsername(normalizedUsername)) {
    return sendError(res, 'This username is reserved', 400);
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
    accountTier: user.accountTier || 'free',
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

  await User.updateOne(
    { _id: loggedInUserId },
    { $addToSet: { following: userToFollowId } }
  );

  await User.updateOne(
    { _id: userToFollowId },
    { $addToSet: { followers: loggedInUserId } }
  );

  await notifyFollow({ recipientId: userToFollowId, senderId: loggedInUserId });

  return sendSuccess(res, { type: 'following' }, 'User followed successfully', 200);
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

  await retractFollow({ recipientId: userToUnfollowId, senderId: loggedInUserId });

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

// Shared by the followers and following endpoints, which differ only in
// which array they page through.
//
// The page is resolved by slicing the id array we already have and fetching
// exactly those users. The previous shape re-fetched the whole target user a
// SECOND time — with no projection at all, so the entire document (both
// watch lists, both CineGraphs, every favorite) came back — purely so
// Mongoose could populate one field of it.
//
// `total` for BOTH arrays ships on every response: the screen labels its two
// tabs with both counts, and getting them any other way meant two extra
// round trips returning one number each.
const sendConnectionPage = async (res, { targetDoc, field, page, limit, message }) => {
  const ids = targetDoc[field] || [];
  const skip = (page - 1) * limit;
  const pageIds = ids.slice(skip, skip + limit);

  const users = pageIds.length
    ? await User.find({ _id: { $in: pageIds } })
        .select('_id username profile_pic_url accountTier')
        .lean()
    : [];

  // $in returns documents in whatever order the index yields, so the page is
  // put back into the order the id array had.
  const byId = new Map(users.map((u) => [u._id.toString(), u]));
  const ordered = pageIds.map((id) => byId.get(id.toString())).filter(Boolean);

  return sendPaginated(res, ordered, ids.length, page, limit, message, {
    counts: {
      followers: (targetDoc.followers || []).length,
      following: (targetDoc.following || []).length,
    },
  });
};

// @desc    Get logged-in user's FOLLOWING list
// @route   GET /api/users/me/following
// @access  Private (Login required)
export const getMyFollowing = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, userId } = req.query;
    const targetUserId = userId || req.user.id;

    const targetDoc = await User.findById(targetUserId)
        .select('_id followers following')
        .lean();

    if (!targetDoc) {
        return sendError(res, 'User not found', 404);
    }

    return sendConnectionPage(res, {
        targetDoc,
        field: 'following',
        page: parseInt(page),
        limit: parseInt(limit),
        message: 'Following list fetched',
    });
});

// @desc    Get logged-in user's FOLLOWERS list
// @route   GET /api/users/me/followers
// @access  Private (Login required)
export const getMyFollowers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, userId } = req.query;
    const targetUserId = userId || req.user.id;

    const targetDoc = await User.findById(targetUserId)
        .select('_id followers following')
        .lean();

    if (!targetDoc) {
        return sendError(res, 'User not found', 404);
    }

    return sendConnectionPage(res, {
        targetDoc,
        field: 'followers',
        page: parseInt(page),
        limit: parseInt(limit),
        message: 'Followers list fetched',
    });
});

// @desc    Search users by username
// @route   GET /api/users/search?q=[query]
// @access  Private (Login required)
export const searchUsers = asyncHandler(async (req, res) => {
  const query = req.query.query;
  const { page = 1, limit = 20 } = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;
  const selfId = new mongoose.Types.ObjectId(req.user.id);

  // No query — browse mode: a random default set instead of erroring, so a
  // "search users" UI has something to show before anyone's typed anything.
  // Not paginated (a fresh random sample each call is the point).
  if (!query) {
    const users = await User.aggregate([
      { $match: { _id: { $ne: selfId } } },
      { $sample: { size: limitNum } },
      { $project: { _id: 1, username: 1, profile_pic_url: 1, accountTier: 1 } },
    ]);
    return sendPaginated(res, users, users.length, 1, limitNum, 'Users found');
  }

  // 🔹 Optimize: Use aggregation with $facet to get count + data in ONE query
  const pipeline = [
    {
      $match: {
        username: { $regex: escapeRegex(query), $options: 'i' },
        _id: { $ne: selfId }
      }
    },
    {
      $project: {
        _id: 1,
        username: 1,
        profile_pic_url: 1,
        accountTier: 1
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

    // This is a whole-list replace, not an add/remove toggle — diff against
    // the *previous* list (already on req.user, no extra fetch needed) to
    // find ids that are genuinely new, and log only those as FavoriteEvents
    // for the network Activity feed. Never logs removals or a re-submit of
    // an id that was already present.
    const previousIds = new Set((req.user[fieldToUpdate] || []).map((id) => id.toString()));
    const newlyAddedIds = list.filter((id) => !previousIds.has(id.toString()));

    // 1. Update user's list
    await User.findByIdAndUpdate(
      userId,
      { [fieldToUpdate]: list }, // Replace list directly with the new list from request
      { new: true, runValidators: true }
    );

    if (newlyAddedIds.length) {
      await FavoriteEvent.insertMany(
        newlyAddedIds.map((contentId) => ({ user: userId, contentId, contentType: type }))
      );
    }

    // 2. UPDATE: No populate. Just return the current list of IDs.
    res.status(200).json(list);

  } catch (error) {
    res.status(500).json({ message: "Favorites could not be updated.", error: error.message });
  }
};

// controllers/userController.js dosyasının sonuna ekle:

// ... (existing updateFavorites function ends here)

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

    // Every profile is public; see utils/publicProfile.js for why the flags
    // are still sent.
    res.status(200).json({ ...user, ...PUBLIC_PROFILE });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Marks a title as "Currently Watching" — a real explicit action
//          (Content Detail's own play-icon button), one active item at a
//          time; setting a new one silently replaces whatever was active
//          before. See User.js's own currentlyWatching field comment for
//          the full TTL/auto-clear design.
// @route   POST /api/users/me/currently-watching
// @access  Private
export const setCurrentlyWatching = asyncHandler(async (req, res) => {
  const { itemId, itemType } = req.body;
  if (!itemId || !['movie', 'series'].includes(itemType)) {
    return sendError(res, 'itemId and a valid itemType are required', 400);
  }
  const currentlyWatching = { itemId, itemType, startedAt: new Date() };
  await User.findByIdAndUpdate(req.user.id, { currentlyWatching });
  sendSuccess(res, { currentlyWatching }, 'Currently watching updated', 200);
});

// @desc    Manual stop — the counterpart to the auto-clear
//          userWatchlistRoute.js's watchlist-add already does when the
//          SAME item is marked watched. Needed as its own action because a
//          series is rarely finished in one sitting: the user pauses for
//          the day without necessarily marking it watched yet.
// @route   DELETE /api/users/me/currently-watching
// @access  Private
export const stopCurrentlyWatching = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, { $unset: { currentlyWatching: 1 } });
  sendSuccess(res, { currentlyWatching: null }, 'Currently watching stopped', 200);
});

// @desc    DEV-ONLY: change your own account tier to simulate a purchase.
//          No real billing exists yet — remove/replace this once real IAP lands.
// @route   PATCH /api/users/me/tier
// @access  Private (disabled outside development)
export const setOwnAccountTier = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return sendError(res, 'Not available', 404);
  }

  const { tier } = req.body;
  if (!['free', 'plus', 'premium', 'dev'].includes(tier)) {
    return sendError(res, 'Invalid tier', 400);
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { accountTier: tier, tierUpdatedAt: new Date() },
    { new: true }
  ).select('-password');

  sendSuccess(res, { accountTier: user.accountTier }, 'Account tier updated');
});

// controllers/userController.js

// Right after the existing getUserProfile function

// controllers/userController.js

// ... (getUserProfile fonksiyonunun bittiği yerin hemen altına)

// controllers/userController.js

// How many entries of each collection the public profile's Lists tab gets.
// The rails preview far fewer than this; the surplus is what the "See all"
// sheet pages through. Capped because a long-time user's watched list runs
// to hundreds of titles, and none of this is worth shipping in full to
// render three rails — the client says "showing N of M" when it's short.
const COLLECTION_ITEM_LIMIT = 60;

// Turns [{itemId, itemType}] subdocuments into displayable rows. These are
// plain ObjectIds on the user document rather than populate-able refs (the
// itemType decides which collection they point at), so the lookup is two
// $in queries rather than a populate.
const hydrateWatchItems = async (items, limit) => {
  const Movie = mongoose.model('Movie');
  const Series = mongoose.model('Series');
  // Newest-first: `addedAt` is what makes "recently added" the part of a
  // long list that actually gets shown.
  const ordered = [...(items || [])].sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));
  const capped = ordered.slice(0, limit);

  const movieIds = capped.filter(i => i.itemType === 'movie').map(i => i.itemId);
  const seriesIds = capped.filter(i => i.itemType === 'series').map(i => i.itemId);
  const [movies, series] = await Promise.all([
    movieIds.length ? Movie.find({ _id: { $in: movieIds } }).select('title name poster_path').lean() : [],
    seriesIds.length ? Series.find({ _id: { $in: seriesIds } }).select('title name poster_path').lean() : []
  ]);

  const byId = new Map();
  for (const m of movies) byId.set(String(m._id), m);
  for (const s of series) byId.set(String(s._id), s);

  return {
    total: ordered.length,
    items: capped
      .map(entry => {
        const doc = byId.get(String(entry.itemId));
        if (!doc) return null;
        return {
          itemId: String(entry.itemId),
          itemType: entry.itemType,
          // The series collection is inconsistent about which field holds a
          // show's name (see utils/analysisMath.js's resolveDisplayName) —
          // same defensiveness here.
          title: entry.itemType === 'series' ? doc.name || doc.title : doc.title || doc.name,
          poster_path: doc.poster_path || null
        };
      })
      .filter(Boolean)
  };
};

/**
 * @desc   A user's lists, watched list and watchlist, for the public
 *         profile's Lists tab. One endpoint rather than three so that tab
 *         costs a single round trip.
 * @route  GET /api/users/collections/:id
 * @access Private
 */
export const getUserCollections = asyncHandler(async (req, res) => {
  const targetUserId = req.params.id === 'me' ? req.user.id : req.params.id;
  const user = await User.findById(targetUserId)
    .select('watchlist toWatchList')
    .lean();

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  const isOwner = req.user.id.toString() === String(targetUserId);
  // Someone else's lists marked not public stay hidden — isPublic is a
  // per-list setting. Viewing your own profile shows both.
  const listQuery = isOwner ? { owner: targetUserId } : { owner: targetUserId, isPublic: true };

  const [lists, watched, watchlist] = await Promise.all([
    // Owner populated and items kept so these come back in exactly the
    // shape /discover and /popular return — the profile's Lists rail can
    // then reuse ListRailCard rather than needing a third list-card design.
    CustomList.find(listQuery)
      .sort({ order: -1, createdAt: -1 })
      .limit(COLLECTION_ITEM_LIMIT)
      .populate('owner', 'username profile_pic_url')
      .lean(),
    hydrateWatchItems(user.watchlist, COLLECTION_ITEM_LIMIT),
    hydrateWatchItems(user.toWatchList, COLLECTION_ITEM_LIMIT)
  ]);

  sendSuccess(
    res,
    {
      // The same 20 preview posters Discover's /popular and /discover send,
      // so a list card's film strip swipes through the same titles on a
      // profile as it does on Discover.
      lists: await hydratePreviewItems(lists, 20),
      watched,
      watchlist,
      ...PUBLIC_ACCESS
    },
    'User collections fetched'
  );
});

/**
 * @desc   Every entry of a user's watched list or watchlist, for the public
 *         profile's full-list sheet (search, filters, sorting). Unlike
 *         getUserCollections this isn't capped: it ships ids only, and the
 *         app fills in titles and posters from its own content cache.
 * @route  GET /api/users/collections/:id/:kind   (kind: watched | watchlist)
 * @access Private
 */
export const getUserCollectionEntries = asyncHandler(async (req, res) => {
  const { kind } = req.params;
  if (kind !== 'watched' && kind !== 'watchlist') {
    return sendError(res, 'kind must be "watched" or "watchlist"', 400);
  }

  const targetUserId = req.params.id === 'me' ? req.user.id : req.params.id;
  if (!mongoose.isValidObjectId(targetUserId)) {
    return sendError(res, 'Invalid user ID', 400);
  }

  const field = kind === 'watched' ? 'watchlist' : 'toWatchList';
  const user = await User.findById(targetUserId).select(field).lean();
  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  // The owner's ratings, read through the driver so ratings whose contentId
  // is stored as an ObjectId match too (see utils/cineGraph.js). A watchlist
  // hasn't been watched yet, so it has no ratings to show.
  const ratings = kind === 'watched'
    ? await Rating.collection
        .find(
          { user: new mongoose.Types.ObjectId(String(targetUserId)) },
          { projection: { contentId: 1, value: 1, updatedAt: 1, createdAt: 1 } }
        )
        .toArray()
    : null;

  sendSuccess(
    res,
    { items: buildCollectionEntries(user[field], ratings), ...PUBLIC_ACCESS },
    'User collection fetched'
  );
});

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

  // The rating shown under each favorite is always the profile owner's own
  // rating (req.params.id), not the viewer's — matches getUserGenreDetail's
  // Rating lookup pattern (same model, same contentId/contentType shape).
  const movies = user.favoriteMovies || [];
  const series = user.favoriteSeries || [];
  const favoriteIds = [...movies, ...series].map((f) => f._id.toString());
  const ratings = favoriteIds.length
    ? await Rating.find({ user: req.params.id, contentId: { $in: favoriteIds } }).select('contentId value').lean()
    : [];
  const ratingByContentId = new Map(ratings.map((r) => [r.contentId, r.value]));

  sendSuccess(res, {
    movies: movies.map((m) => ({ ...m, rating: ratingByContentId.get(m._id.toString()) ?? null })),
    series: series.map((s) => ({ ...s, rating: ratingByContentId.get(s._id.toString()) ?? null })),
    ...PUBLIC_ACCESS,
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
    // Same reserved-name guard as registration — a rename must not be able
    // to reach "cinephix" (in any case/diacritic disguise) either, or this
    // endpoint would just be an open bypass of that check.
    if (isReservedUsername(username)) {
      return sendError(res, 'This username is reserved', 400);
    }
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

  const user = await User.findById(targetUserId).select('watchlist').lean();

  if (!user || !user.watchlist || user.watchlist.length === 0) {
    return sendSuccess(res, { movieStats: {}, seriesStats: {}, movieGenreRatings: {}, seriesGenreRatings: {}, ...PUBLIC_ACCESS }, 'CineGraph fetched', 200);
  }

  const watchlist = user.watchlist;

  const movieIds = watchlist.filter(item => item.itemType === 'movie').map(item => item.itemId);
  const seriesIds = watchlist.filter(item => item.itemType === 'series').map(item => item.itemId);

  // Independent queries, run concurrently rather than three sequential
  // round trips — this endpoint sits directly in front of a visible UI ring
  // (Sync page's own CineMatchGenreRing among other callers), so its own
  // latency is directly felt as "loads a bit late" on first paint.
  const [movies, series, ratings] = await Promise.all([
    Movie.find({ '_id': { $in: movieIds } }).select('genre_ids').lean(),
    Series.find({ '_id': { $in: seriesIds } }).select('genre_ids').lean(),
    // Rating.contentId is a plain String, not an ObjectId ref — coerce before matching.
    Rating.find({
      user: targetUserId,
      contentId: { $in: [...movieIds, ...seriesIds].map((id) => id.toString()) },
    }).select('contentId contentType value').lean(),
  ]);
  const ratingByContentId = new Map(ratings.map((r) => [r.contentId, r.value]));

  const movieGenreCounts = {};
  const seriesGenreCounts = {};
  const movieGenreRatingSums = {};
  const seriesGenreRatingSums = {};

  for (const movie of movies) {
    if (movie.genre_ids && Array.isArray(movie.genre_ids)) {
      const ratingValue = ratingByContentId.get(movie._id.toString());
      for (const genreId of movie.genre_ids) {
        const genreName = MOVIE_GENRE_MAP[genreId];
        if (genreName) {
           movieGenreCounts[genreName] = (movieGenreCounts[genreName] || 0) + 1;
           if (ratingValue != null) {
             const node = movieGenreRatingSums[genreName] || { sum: 0, n: 0 };
             node.sum += ratingValue;
             node.n += 1;
             movieGenreRatingSums[genreName] = node;
           }
        }
      }
    }
  }

  for (const show of series) {
    if (show.genre_ids && Array.isArray(show.genre_ids)) {
      const ratingValue = ratingByContentId.get(show._id.toString());
      for (const genreId of show.genre_ids) {
        const genreName = SERIES_GENRE_MAP[genreId];
        if (genreName) {
          seriesGenreCounts[genreName] = (seriesGenreCounts[genreName] || 0) + 1;
          if (ratingValue != null) {
            const node = seriesGenreRatingSums[genreName] || { sum: 0, n: 0 };
            node.sum += ratingValue;
            node.n += 1;
            seriesGenreRatingSums[genreName] = node;
          }
        }
      }
    }
  }

  // avgRating stays on Rating.value's raw 1-10 scale — mobile's
  // StarRatingDisplay/RatingDistributionChart already divide by 2 themselves
  // at the display layer, not the data layer.
  const movieGenreRatings = {};
  for (const genreName of Object.keys(movieGenreCounts)) {
    const node = movieGenreRatingSums[genreName];
    movieGenreRatings[genreName] = node ? Number((node.sum / node.n).toFixed(1)) : null;
  }
  const seriesGenreRatings = {};
  for (const genreName of Object.keys(seriesGenreCounts)) {
    const node = seriesGenreRatingSums[genreName];
    seriesGenreRatings[genreName] = node ? Number((node.sum / node.n).toFixed(1)) : null;
  }

  sendSuccess(res, {
    movieStats: movieGenreCounts,
    seriesStats: seriesGenreCounts,
    movieGenreRatings,
    seriesGenreRatings,
    ...PUBLIC_ACCESS,
  }, 'CineGraph fetched', 200);
});

/**
 * @desc   Every watched item in one genre for a user, with the user's own
 *         rating per item and the genre's average. Recomputed fresh from
 *         Rating + Movie/Series.genre_ids at read time — deliberately NOT
 *         read from User.movieCineGraph/seriesCineGraph, which has known
 *         drift bugs from the TV Time/Letterboxd import and log-revert
 *         paths (out of scope to fix here).
 * @route  GET /api/users/:id/genre-detail?type=movie|series&genre=<name>
 * @access Private
 */
export const getUserGenreDetail = asyncHandler(async (req, res) => {
  const Movie = mongoose.model('Movie');
  const Series = mongoose.model('Series');

  let targetUserId = req.params.id;
  if (targetUserId === 'me' || !targetUserId) {
    targetUserId = req.user.id;
  }

  const { type, genre } = req.query;
  if (type !== 'movie' && type !== 'series') {
    return sendError(res, 'type must be "movie" or "series"', 400);
  }
  if (!genre) {
    return sendError(res, 'genre query param is required', 400);
  }

  const user = await User.findById(targetUserId).select('watchlist').lean();
  if (!user) return sendError(res, 'User not found', 404);

  const genreMap = type === 'movie' ? MOVIE_GENRE_MAP : SERIES_GENRE_MAP;
  const targetGenreIds = Object.keys(genreMap)
    .filter((id) => genreMap[id] === genre)
    .map(Number);
  if (targetGenreIds.length === 0) {
    return sendError(res, 'Unknown genre', 400);
  }

  const itemIds = (user.watchlist || [])
    .filter((item) => item.itemType === type)
    .map((item) => item.itemId);

  const Model = type === 'movie' ? Movie : Series;
  const titleField = type === 'movie' ? 'title' : 'name';
  const dateField = type === 'movie' ? 'release_date' : 'first_air_date';

  const docs = await Model.find({ _id: { $in: itemIds } })
    .select(`genre_ids ${titleField} poster_path ${dateField}`)
    .lean();

  const matched = docs.filter(
    (d) => Array.isArray(d.genre_ids) && d.genre_ids.some((gid) => targetGenreIds.includes(gid))
  );

  const matchedIds = matched.map((d) => d._id.toString());
  const ratings = await Rating.find({
    user: targetUserId,
    contentType: type,
    contentId: { $in: matchedIds },
  }).select('contentId value').lean();
  const ratingByContentId = new Map(ratings.map((r) => [r.contentId, r.value]));

  const items = matched.map((d) => ({
    contentId: d._id.toString(),
    title: d[titleField],
    posterPath: d.poster_path || null,
    year: d[dateField] ? d[dateField].substring(0, 4) : null,
    rating: ratingByContentId.get(d._id.toString()) ?? null,
  }));

  items.sort((a, b) => {
    if (a.rating == null && b.rating == null) return 0;
    if (a.rating == null) return 1;
    if (b.rating == null) return -1;
    return b.rating - a.rating;
  });

  const ratedValues = items.map((i) => i.rating).filter((v) => v != null);
  const avgRating = ratedValues.length
    ? Number((ratedValues.reduce((a, b) => a + b, 0) / ratedValues.length).toFixed(1))
    : null;

  sendSuccess(res, { items, avgRating, count: items.length, ...PUBLIC_ACCESS }, 'Genre detail fetched', 200);
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

  sendSuccess(res, { ...user, ...PUBLIC_PROFILE }, 'Profile fetched', 200);
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
  await refreshUserCineGraph(userId);

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
  await refreshUserCineGraph(userId);

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
    .select('username profile_pic_url bio accountTier')
    .lean();

  const result = candidates
    .map((u) => ({ ...u, mutualCount: mutualCount[u._id.toString()] }))
    .sort((a, b) => b.mutualCount - a.mutualCount);

  sendSuccess(res, result, 'Suggestions fetched');
});

// @desc    Which of the people I follow are currently connected (Medya's
//          online-friends bar) — backed by presenceService's in-memory
//          socket refcount, not a persisted field.
// @route   GET /api/users/online
export const getOnlineFriends = asyncHandler(async (req, res) => {
  const currentUser = await User.findById(req.user.id).select('following').lean();
  const followingIds = new Set((currentUser?.following || []).map((id) => id.toString()));

  const onlineIds = getOnlineUserIds().filter((id) => followingIds.has(id));
  if (onlineIds.length === 0) {
    return sendSuccess(res, [], 'Online friends fetched');
  }

  const users = await User.find({ _id: { $in: onlineIds } })
    .select('username profile_pic_url')
    .lean();
  sendSuccess(res, users, 'Online friends fetched');
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
    accountTier: user.accountTier || 'free',
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
    accountTier: user.accountTier || 'free',
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

// How many real titles (posters) each of the Recent Taste / Favorite Genres
// cards gets to preview under its percentages. A horizontally scrollable
// row, not the full list — and every entry here is persisted on the
// ProfileAnalysis history row forever, so it stays deliberately small.
const ITEM_PREVIEW_LIMIT = 20;
// Per-genre poster list revealed by tapping a genre in Genre Breakdown,
// highest-rated first. Smaller than the row limits above because it's paid
// once per genre in the breakdown, not once per card.
const GENRE_ITEM_LIMIT = 8;
// Same idea for the two tappable Premium charts, paid once per bucket (10
// rating scores, 6 months). Matches ITEM_PREVIEW_LIMIT rather than being
// smaller: those rows have a "See all" that opens them into a grid, and 6
// was visibly short of what a bucket labelled "23 titles" implies. The
// bucket's TRUE total still ships separately (ratingCurve[i].count), so the
// UI can say "showing 20 of 23" instead of quietly truncating.
const BUCKET_ITEM_LIMIT = 20;

// @desc    Get profile statistics and analysis for current user
// @route   GET /api/users/profile-analysis
// @access  Private
export const getProfileAnalysis = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const tier = req.user.accountTier || 'free';
  const { analysisCooldownHours, analysisSchema, analysisAdvancedCards } = getTierLimits(tier);
  const Movie = mongoose.model('Movie');
  const Series = mongoose.model('Series');

  // Fetch user info for watchlist and social counts
  const user = await User.findById(userId)
    .select("watchlist followers following favoriteMovies favoriteSeries createdAt")
    .lean();

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const lastAnalysis = await ProfileAnalysis.findOne({ user: userId }).sort({ createdAt: -1 }).lean();
  if (lastAnalysis) {
    const cooldownMs = analysisCooldownHours * 60 * 60 * 1000;
    const elapsedMs = Date.now() - lastAnalysis.createdAt.getTime();
    if (elapsedMs < cooldownMs) {
      return sendError(res, "Analysis on cooldown", 429, {
        retryAfterMs: cooldownMs - elapsedMs,
        lastRunAt: lastAnalysis.createdAt
      });
    }
  }

  // 1-2. Ratings, both types in ONE query, partitioned in memory. Two
  // separate contentType queries hit the same {user, ...} index twice for
  // data that always arrives together, and the 30/60-day windows further
  // down were re-querying a third time for rows already in this result.
  const allRatings = await Rating.find({ user: userId }).lean();
  const movieRatings = allRatings.filter(r => r.contentType === "movie");
  const seriesRatings = allRatings.filter(r => r.contentType === "series");
  const moviesWatchedCount = movieRatings.length;
  const seriesWatchedCount = seriesRatings.length;

  // Both content lookups (and the two social counts, which depend on
  // nothing) in one round of parallel work rather than four sequential
  // awaits. `title name` is selected for BOTH types on purpose: the series
  // collection is inconsistent about which field holds a show's name
  // (see resolveDisplayName), and selecting only one left most series
  // rendering as a poster with no title under it.
  const [ratedMovieDocs, ratedSeriesDocs, reviewsCount, shareCount] = await Promise.all([
    moviesWatchedCount
      ? Movie.find({ _id: { $in: movieRatings.map(r => r.contentId) } })
          .select("genre_ids title name poster_path")
          .lean()
      : [],
    seriesWatchedCount
      ? Series.find({ _id: { $in: seriesRatings.map(r => r.contentId) } })
          .select("genre_ids title name poster_path")
          .lean()
      : [],
    Review.countDocuments({ user: userId }),
    Share.countDocuments({ user: userId })
  ]);

  const moviesAvgRating = averageRating(movieRatings);
  const seriesAvgRating = averageRating(seriesRatings);
  const movieGenreCounts = tallyGenres(ratedMovieDocs, MOVIE_GENRE_MAP);
  const seriesGenreCounts = tallyGenres(ratedSeriesDocs, SERIES_GENRE_MAP);
  const topOf = (counts) =>
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre]) => genre);
  const topMovieGenres = topOf(movieGenreCounts);
  const topSeriesGenres = topOf(seriesGenreCounts);

  // 3. All-time genre breakdown — computed straight from real rating data
  // (movie + series genre tags combined, weighted by how many rated titles
  // carry each tag), never invented by the LLM. This is what the Genre
  // Breakdown card renders and grounds ("N of your M rated titles..."):
  // real counts that always reflect the actual DB, instead of a model
  // freehanding percentages that happened to land on a suspicious even
  // split (5 genres at 20% each) when it had nothing concrete to go on.
  const totalRatings = moviesWatchedCount + seriesWatchedCount;
  const {
    tagTotal: genreTagTotal,
    percentByName: allTimeGenrePercentByName,
    genreBreakdown
  } = buildGenreBreakdown(movieGenreCounts, seriesGenreCounts);

  // The user's own score per title, so every poster list below can lead with
  // their highest-rated picks rather than whatever order the DB returned.
  const ratingByContentId = new Map();
  for (const r of allRatings) ratingByContentId.set(String(r.contentId), r.value);

  const genreNamesOf = (doc, type) => {
    const map = type === "movie" ? MOVIE_GENRE_MAP : SERIES_GENRE_MAP;
    return (doc.genre_ids || []).map(id => map[id]).filter(Boolean);
  };
  // The client renders `item.title ?? item.name`, so exactly one of the two
  // has to carry the resolved name — resolveDisplayName picks whichever
  // field this particular document actually has.
  const toItem = (doc, type) => {
    const displayName = resolveDisplayName(doc, type);
    return {
      _id: String(doc._id),
      type,
      title: type === "movie" ? displayName : undefined,
      name: type === "series" ? displayName : undefined,
      poster_path: doc.poster_path || null,
      rating: ratingByContentId.get(String(doc._id)),
      genres: genreNamesOf(doc, type)
    };
  };

  // Tapping a genre in the breakdown reveals the titles behind it — this is
  // that list, per top genre, led by whichever the user scored highest.
  // Built per genre (rather than as one pooled sample the client filters)
  // specifically so a smaller genre is never squeezed out of the sample and
  // left with an empty row.
  const ratedItemsAll = [
    ...ratedMovieDocs.map(d => toItem(d, "movie")),
    ...ratedSeriesDocs.map(d => toItem(d, "series"))
  ];
  const genreItems = {};
  for (const { genre } of genreBreakdown) {
    genreItems[genre] = ratedItemsAll
      .filter(item => item.genres.includes(genre))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, GENRE_ITEM_LIMIT);
  }

  // 4. Watchlist
  const watchlistCount = user.watchlist ? user.watchlist.length : 0;

  // 5. Social (counts already fetched in parallel above)
  const followingCount = user.following ? user.following.length : 0;
  const followersCount = user.followers ? user.followers.length : 0;

  // 6. Recent taste (last 30 days) — combined movie+series genre counts from
  // ratings given in the last month, distinct from the all-time breakdown
  // above. deltaVsPreviousPeriod compares each genre's share of the last 30
  // days against its share of the 30 days BEFORE that, so the card's arrows
  // can honestly be labelled "vs last month" — an earlier version compared
  // against the all-time share, which is a different claim than the label.
  //
  // Both windows are sliced out of `allRatings` and read against the already
  // fetched rated docs: no extra queries, since every rating in a 30- or
  // 60-day window is by definition already in the all-time set.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const recentCutoff = new Date(Date.now() - 30 * DAY_MS);
  const previousCutoff = new Date(Date.now() - 60 * DAY_MS);
  const recentRatings = allRatings.filter(r => new Date(r.createdAt) >= recentCutoff);
  const previousRatings = allRatings.filter(
    r => new Date(r.createdAt) >= previousCutoff && new Date(r.createdAt) < recentCutoff
  );

  const ratedDocById = new Map();
  for (const m of ratedMovieDocs) ratedDocById.set(String(m._id), { doc: m, type: "movie" });
  for (const s of ratedSeriesDocs) ratedDocById.set(String(s._id), { doc: s, type: "series" });
  const genreCountsForWindow = (ratings) => {
    const movieDocs = [];
    const seriesDocs = [];
    for (const r of ratings) {
      const entry = ratedDocById.get(String(r.contentId));
      if (!entry) continue;
      (entry.type === "movie" ? movieDocs : seriesDocs).push(entry.doc);
    }
    const counts = tallyGenres(movieDocs, MOVIE_GENRE_MAP);
    return tallyGenres(seriesDocs, SERIES_GENRE_MAP, counts);
  };

  const recentGenres = buildRecentGenres(
    genreCountsForWindow(recentRatings),
    genreCountsForWindow(previousRatings),
    allTimeGenrePercentByName
  );

  // The actual titles behind those percentages — newest rating first, with
  // the score the user gave each one. Percentages alone are abstract; the
  // posters are what make the card read as "yes, this is really *my* month."
  // Capped at ITEM_PREVIEW_LIMIT: this is a scrollable preview row, not the
  // full watch history, and every extra entry is dead weight in the
  // persisted payload.
  // Sorted once here and reused by the two Premium charts' buckets below —
  // every one of those lists wants "most recent first" when truncated.
  const ratingsNewestFirst = [...allRatings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const recentItems = ratingsNewestFirst
    .filter(r => new Date(r.createdAt) >= recentCutoff)
    .map(r => {
      const entry = ratedDocById.get(String(r.contentId));
      return entry ? toItem(entry.doc, entry.type) : null;
    })
    .filter(Boolean)
    .slice(0, ITEM_PREVIEW_LIMIT);

  // 7. Favorite genre weighting — from favorited titles themselves, not
  // ratings, so it reflects "what they've chosen to keep," not "what
  // they've watched." alignsWithTopWatched flags whether their #1 favorite
  // genre matches their #1 all-time rated genre — a small, concrete "here's
  // why we're confident in this" signal to surface next to the persona.
  const favoriteMovieIds = user.favoriteMovies || [];
  const favoriteSeriesIds = user.favoriteSeries || [];
  const [favMoviesData, favSeriesData] = await Promise.all([
    favoriteMovieIds.length
      ? Movie.find({ _id: { $in: favoriteMovieIds } }).select("genre_ids title name poster_path").lean()
      : [],
    favoriteSeriesIds.length
      ? Series.find({ _id: { $in: favoriteSeriesIds } }).select("genre_ids title name poster_path").lean()
      : []
  ]);
  const favGenreCounts = tallyGenres(favMoviesData, MOVIE_GENRE_MAP);
  tallyGenres(favSeriesData, SERIES_GENRE_MAP, favGenreCounts);
  // `count` and the tag total both ship so the client can show an explicit
  // "Other" remainder — a top-5 list whose percentages stop at 78% and never
  // say where the other 22% went reads as broken arithmetic.
  const { items: favoriteGenreItems, tagTotal: favGenreTotal } = buildFavoriteGenres(favGenreCounts);

  // Same reasoning as recentItems: the posters that actually produced the
  // percentages above. Movies before series (rather than interleaved) —
  // they're two separately-ordered favorite lists on the user doc, so
  // there's no shared ordering to preserve between them anyway.
  const favoriteItems = [
    ...favMoviesData.map(m => toItem(m, "movie")),
    ...favSeriesData.map(s => toItem(s, "series"))
  ].slice(0, ITEM_PREVIEW_LIMIT);

  // 8. Premium-tier-only sections. Everything above ships to every tier that
  // can run an analysis at all; these two extra cards are what an upgrade
  // actually buys, so they're computed (and returned) only when the tier
  // config says so — the client can't unlock them by asking nicely.
  // Shared by the timeline buckets below and the monthly-stats window after
  // them, so both are anchored to the exact same instant.
  const now = new Date();

  let ratingCurve;
  let ratingCurveItems;
  let activityTimeline;
  let timelineItems;
  if (analysisAdvancedCards) {
    // How generously they score, as a 1-10 histogram — "are you a soft
    // touch or a tough critic" answered from the actual distribution
    // rather than the single average the stats card already shows.
    ratingCurve = buildRatingCurve(allRatings);

    // Both charts are tappable, so each bucket also carries the titles that
    // put it there — keyed by bucket so the client can look them up without
    // re-deriving which rating or month a title belongs to. Newest-first
    // (ratingsNewestFirst) so a truncated bucket shows the most recent
    // titles rather than an arbitrary slice of the collection's own order.
    const curveItems = {};
    for (const r of ratingsNewestFirst) {
      const score = Math.min(10, Math.max(1, Math.round(r.value)));
      const list = (curveItems[score] ||= []);
      if (list.length >= BUCKET_ITEM_LIMIT) continue;
      const entry = ratedDocById.get(String(r.contentId));
      if (entry) list.push(toItem(entry.doc, entry.type));
    }
    ratingCurveItems = curveItems;

    // Ratings per calendar month for the last 6 months, oldest first —
    // month start is sent as an ISO date so the client can format the label
    // in the viewer's own locale instead of receiving an English one.
    const monthBuckets = buildMonthBuckets(now);
    const bucketByKey = new Map(monthBuckets.map(b => [b.key, b]));
    const monthItems = {};
    for (const r of ratingsNewestFirst) {
      if (!r.createdAt) continue;
      const bucket = bucketByKey.get(monthKeyOf(r.createdAt));
      if (!bucket) continue;
      bucket.count += 1;
      const monthIso = bucket.start.toISOString();
      const list = (monthItems[monthIso] ||= []);
      if (list.length >= BUCKET_ITEM_LIMIT) continue;
      const entry = ratedDocById.get(String(r.contentId));
      if (entry) list.push(toItem(entry.doc, entry.type));
    }
    activityTimeline = monthBuckets.map(({ start, count }) => ({ month: start.toISOString(), count }));
    timelineItems = monthItems;
  }

  // 9. This calendar month vs. the last complete one. Every figure here is
  // an EVENT count in a window (things that happened this month), never a
  // running total — which is why followers/following come from the follow
  // notifications rather than the untimestamped User.followers arrays: those
  // arrays can only answer "how many now," not "how many this month."
  // monthEnd is an EXCLUSIVE bound (midnight on the 1st of next month) so
  // events on the final day still count; periodEnd is the last day itself,
  // used only for the "1-31 August" label.
  const { monthStart, monthEnd, periodEnd, prevMonthStart } = monthWindows(now);
  const ratingsIn = (ratings, start, end) => ratings.filter(r => isWithin(r.createdAt, start, end));

  const thisMonthMovies = ratingsIn(movieRatings, monthStart, monthEnd);
  const prevMonthMovies = ratingsIn(movieRatings, prevMonthStart, monthStart);
  const thisMonthSeries = ratingsIn(seriesRatings, monthStart, monthEnd);
  const prevMonthSeries = ratingsIn(seriesRatings, prevMonthStart, monthStart);

  const watchlistItems = user.watchlist || [];
  const [
    reviewsThisMonth,
    reviewsPrevMonth,
    sharesThisMonth,
    sharesPrevMonth,
    followersThisMonth,
    followersPrevMonth,
    followingThisMonth,
    followingPrevMonth
  ] = await Promise.all([
    Review.countDocuments({ user: userId, createdAt: { $gte: monthStart, $lt: monthEnd } }),
    Review.countDocuments({ user: userId, createdAt: { $gte: prevMonthStart, $lt: monthStart } }),
    Share.countDocuments({ user: userId, createdAt: { $gte: monthStart, $lt: monthEnd } }),
    Share.countDocuments({ user: userId, createdAt: { $gte: prevMonthStart, $lt: monthStart } }),
    // Someone followed you.
    Notification.countDocuments({ user: userId, type: "follow", createdAt: { $gte: monthStart, $lt: monthEnd } }),
    Notification.countDocuments({ user: userId, type: "follow", createdAt: { $gte: prevMonthStart, $lt: monthStart } }),
    // You followed someone.
    Notification.countDocuments({ sender: userId, type: "follow", createdAt: { $gte: monthStart, $lt: monthEnd } }),
    Notification.countDocuments({ sender: userId, type: "follow", createdAt: { $gte: prevMonthStart, $lt: monthStart } })
  ]);

  const monthlyStats = {
    periodStart: monthStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    moviesWatched: { value: thisMonthMovies.length, previous: prevMonthMovies.length },
    seriesWatched: { value: thisMonthSeries.length, previous: prevMonthSeries.length },
    avgMovieRating: { value: averageRating(thisMonthMovies), previous: averageRating(prevMonthMovies) },
    avgSeriesRating: { value: averageRating(thisMonthSeries), previous: averageRating(prevMonthSeries) },
    followers: { value: followersThisMonth, previous: followersPrevMonth },
    following: { value: followingThisMonth, previous: followingPrevMonth },
    watchlist: {
      value: watchlistItems.filter(w => isWithin(w.addedAt, monthStart, monthEnd)).length,
      previous: watchlistItems.filter(w => isWithin(w.addedAt, prevMonthStart, monthStart)).length
    },
    reviews: { value: reviewsThisMonth, previous: reviewsPrevMonth },
    shares: { value: sharesThisMonth, previous: sharesPrevMonth }
  };

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
      followersCount,
      shareCount
    },
    totalRatings,
    memberSince: user.createdAt,
    // Titles usually carry 2-3 genres each, so a genre's share is of this
    // tag total, NOT of totalRatings — the client states both denominators
    // explicitly rather than leaving "37 of 45 titles" sitting next to an
    // unexplained 31%.
    genreTagTotal,
    genreBreakdown,
    genreItems,
    recentGenres,
    recentItems,
    favoriteGenres: {
      items: favoriteGenreItems,
      tagTotal: favGenreTotal,
      totalFavorites: favoriteMovieIds.length + favoriteSeriesIds.length,
      alignsWithTopWatched: Boolean(
        genreBreakdown[0] && favoriteGenreItems[0] && genreBreakdown[0].genre === favoriteGenreItems[0].genre
      )
    },
    favoriteItems,
    monthlyStats,
    ...(ratingCurve ? { ratingCurve, ratingCurveItems } : {}),
    ...(activityTimeline ? { activityTimeline, timelineItems } : {})
  };

  // The poster lists are display-only — ids and image paths are noise in a
  // prompt asking for a personality read, and they'd be the single biggest
  // chunk of it. Everything else (counts, percentages, genre names) stays,
  // so the narrative is still grounded in the same numbers the cards show.
  const {
    recentItems: _recentItemsForDisplay,
    favoriteItems: _favoriteItemsForDisplay,
    genreItems: _genreItemsForDisplay,
    ratingCurveItems: _ratingCurveItemsForDisplay,
    timelineItems: _timelineItemsForDisplay,
    ...llmPayload
  } = payload;

  const apiKey = process.env.GEMINI_API_KEY;
  const systemInstructionText = buildAnalysisSystemInstruction(analysisSchema, lastAnalysis?.result);

  let analysisResult = null;
  let provider = null;

  if (apiKey) {
    try {
      const analysisPrompt = lastAnalysis?.result
        ? `Analyze the user profile metrics:\n${JSON.stringify(llmPayload, null, 2)}\n\nTheir previous analysis result was:\n${JSON.stringify(lastAnalysis.result, null, 2)}`
        : `Analyze the user profile metrics:\n${JSON.stringify(llmPayload, null, 2)}`;

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
                    text: analysisPrompt
                  }
                ]
              }
            ],
            systemInstruction: {
              parts: [
                {
                  text: systemInstructionText
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
          analysisResult = JSON.parse(text);
          provider = "gemini";
        }
      } else {
        console.error(`Gemini API returned status ${response.status}`);
      }
    } catch (apiError) {
      console.error("Gemini API call failed, falling back to mock:", apiError.message);
    }
  }

  if (!analysisResult) {
    analysisResult = generateMockAnalysis(payload, analysisSchema, lastAnalysis?.result);
    provider = "mock";
  }

  // genreBreakdown is never part of the LLM's own schema anymore (see
  // buildAnalysisSystemInstruction) — stripped defensively here too in case
  // a model echoes the field name back from an older analysis's result
  // included in its own prompt context. The real, computed one (`payload.
  // genreBreakdown` above) is the only one that ever reaches the client.
  if (analysisResult && typeof analysisResult === "object" && "genreBreakdown" in analysisResult) {
    delete analysisResult.genreBreakdown;
  }

  await ProfileAnalysis.create({
    user: userId,
    tier,
    payload,
    result: analysisResult,
    provider
  });

  return sendSuccess(
    res,
    { ...analysisResult, tier, stats: payload },
    provider === "gemini" ? "Profile analysis generated successfully by Gemini" : "Profile analysis generated successfully (Mock)"
  );
});

// @desc    Get past Profile Analysis runs for the current user (Pro/Premium/Dev only)
// @route   GET /api/users/profile-analysis/history
// @access  Private
const ANALYSIS_HISTORY_PAGE_SIZES = [5, 10, 25];

export const getProfileAnalysisHistory = asyncHandler(async (req, res) => {
  const limit = ANALYSIS_HISTORY_PAGE_SIZES.includes(parseInt(req.query.limit))
    ? parseInt(req.query.limit)
    : 10;
  const page = Math.max(1, parseInt(req.query.page) || 1);

  const { analysisHistory } = getTierLimits(req.user.accountTier);
  if (!analysisHistory) {
    return sendPaginated(res, [], 0, page, limit, "Profile analysis history is not available on your plan");
  }

  const query = { user: req.user.id };
  const [history, total] = await Promise.all([
    ProfileAnalysis.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("tier result payload createdAt")
      .lean(),
    ProfileAnalysis.countDocuments(query),
  ]);

  // `payload` renamed to `stats` on the way out — matches the shape
  // getProfileAnalysis's own fresh-run response already uses, so the mobile
  // card deck can treat a history entry and a just-generated result
  // identically instead of branching on field name.
  const withStats = history.map(({ payload, ...rest }) => ({ ...rest, stats: payload }));

  return sendPaginated(res, withStats, total, page, limit, "Profile analysis history fetched");
});

// Builds the Gemini system instruction, adding richer fields for Pro/Premium schemas
const buildAnalysisSystemInstruction = (analysisSchema, lastResult) => {
  const basicSchemaFields = `  "nickname": "e.g., Sci-Fi Voyager, Elitist Couch Potato, Fast & Furious Enthusiast",
  "personalitySummary": "A 2-3 sentence cinematic breakdown of their watch habits, rating styles, and social footprints.",
  "funFact": "A humorous, data-driven joke based on their specific stats.",
  "recommendedConcept": "A short sentence advising what vibe or category they should dive into next."`;

  if (analysisSchema !== "rich") {
    return `Act as a witty, expert cinema analyst. Analyze the user's movie/series metrics and output STRICTLY a JSON object matching this exact schema (No markdown wrapper like \`\`\`json, just pure stringified JSON):\n{\n${basicSchemaFields}\n}`;
  }

  // genreBreakdown is deliberately NOT part of this schema — it used to be,
  // but asking the model to freehand percentages produced suspiciously even
  // splits (5 genres at 20% each) with no real grounding. It's computed
  // server-side from actual rating data instead (payload.genreBreakdown,
  // already included in the metrics JSON below) and merged into the
  // response after this call, so it's always real and always explainable.
  const richSchemaFields = `${basicSchemaFields},
  "tasteCategory": "A short 2-4 word taste-personality label, e.g. 'Arthouse Purist', 'Blockbuster Loyalist'"${lastResult ? ',\n  "trendVsLastAnalysis": "A short sentence comparing their current stats/taste to their previous analysis."' : ""}`;

  return `Act as a witty, expert cinema analyst. Analyze the user's movie/series metrics (including their real genreBreakdown, recentGenres, and favoriteGenres — ground your narrative in these actual numbers) and output STRICTLY a JSON object matching this exact schema (No markdown wrapper like \`\`\`json, just pure stringified JSON):\n{\n${richSchemaFields}\n}`;
};

// Helper for witty local mock analysis
const generateMockAnalysis = (payload, analysisSchema = "basic", lastResult = null) => {
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

  const basicResult = { nickname, personalitySummary, funFact, recommendedConcept };
  if (analysisSchema !== "rich") {
    return basicResult;
  }

  // Real top genre, not a freehand guess — same source (payload.
  // genreBreakdown, computed from actual ratings) the client renders in the
  // Genre Breakdown card, so the mock's tasteCategory never contradicts it.
  const topGenre = payload.genreBreakdown?.[0]?.genre;

  return {
    ...basicResult,
    tasteCategory: topGenre ? `${topGenre} Devotee` : "Undiscovered Taste",
    ...(lastResult && { trendVsLastAnalysis: "Your taste has stayed fairly consistent since your last analysis." })
  };
};