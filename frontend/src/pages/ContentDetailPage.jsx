import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import EmojiPicker from 'emoji-picker-react';
import { contentService } from '../api/contentService';
import { ratingService } from '../api/ratingService';
import { reviewService } from '../api/reviewService';
import { userService } from '../api/userService';
import { getCacheItem, CACHE_KEYS } from '../api/cacheService';
import toast from 'react-hot-toast';

import { AuthContext } from '../context/AuthContext';
import { RatingsContext } from '../context/RatingsContext';
import StarRating from '../components/StarRating';
import ReviewCard from '../components/ReviewCard';
import FavoritesModal from '../components/FavoritesModal';
import AddToListModal from '../components/AddToListModal';
import LoadingSpinner from '../components/LoadingSpinner';
import RatingDistribution from '../components/RatingDistribution';

const REVIEW_TABS = ["Friends", "Popular"];

// ── Review section ───────────────────────────────────────────────────
function ReviewSection({ contentId, user, contentType, t }) {
  const AVATAR_PLACEHOLDER = "https://placehold.co/64x64/1d232a/e0e0e0?text=?";
  const [activeTab, setActiveTab] = useState(t("Friends"));
  const [friendsReviews, setFriendsReviews] = useState([]);
  const [popularReviews, setPopularReviews] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingPopular, setLoadingPopular] = useState(true);

  const REVIEW_TABS = [t("Friends"), t("Popular")];

  const renderFriendStars = (review, index) => {
    const count = Math.min(5, Math.max(1, review.likeCount || index + 1));
    return (
      <div className="flex justify-center gap-0.5 mt-1">
        {Array.from({ length: 5 }).map((_, starIndex) => (
          <span key={starIndex} className={starIndex < count ? 'text-yellow-400' : 'text-base-content/30'}>★</span>
        ))}
      </div>
    );
  };

  const fetchFriends = useCallback(async () => {
    if (!user) { setLoadingFriends(false); return; }
    setLoadingFriends(true);
    try {
      const res = await reviewService.getFriendsReviews(contentId);
      setFriendsReviews(res.data || res || []);
    } catch { setFriendsReviews([]); }
    finally { setLoadingFriends(false); }
  }, [contentId, user]);

  const fetchPopular = useCallback(async () => {
    setLoadingPopular(true);
    try {
      const res = await reviewService.getReviewsByContent(contentId, "popular");
      setPopularReviews(res.data || res || []);
    } catch { setPopularReviews([]); }
    finally { setLoadingPopular(false); }
  }, [contentId]);

  useEffect(() => {
    fetchFriends();
    fetchPopular();
  }, [fetchFriends, fetchPopular]);

  const handleDelete = (reviewId) => {
    setFriendsReviews((prev) => prev.filter((r) => r._id !== reviewId));
    setPopularReviews((prev) => prev.filter((r) => r._id !== reviewId));
  };

  const currentList = activeTab === t("Friends") ? friendsReviews : popularReviews;
  const isLoading = activeTab === t("Friends") ? loadingFriends : loadingPopular;

  const emptyMessages = {
    [t("Friends")]: user
      ? t("None of the people you follow have reviewed this yet")
      : t("Log in to see reviews from people you follow"),
    [t("Popular")]: t("No reviews yet. Be the first!"),
  };

  return (
    <section className="max-w-4xl mx-auto px-4 md:px-8 pb-12">
      <div className="mb-6 rounded-3xl border border-base-300/40 bg-base-100 p-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-normal">{t("Activity from friends")}</h3>
          </div>
          <span className="text-sm text-base-content/60">
            {friendsReviews.length === 1 ? t("friend_count", { count: 1 }) : t("friend_count_plural", { count: friendsReviews.length })}
          </span>
        </div>
        {friendsReviews.length === 0 ? (
          <p className="text-sm text-center text-base-content/50 py-6">{t("No friends have rated this yet")}</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-1">
            {friendsReviews.map((review, index) => (
              <Link
                key={review._id}
                to={`/profile/${review.user?._id}`}
                className="min-w-[72px] flex-shrink-0 text-center"
              >
                <div className="avatar mx-auto">
                  <div className="w-12 h-12 rounded-full overflow-hidden">
                    <img
                      src={review.user?.profile_pic_url || AVATAR_PLACEHOLDER}
                      alt={review.user?.username || 'Friend'}
                      onError={(e) => { e.target.src = AVATAR_PLACEHOLDER; }}
                    />
                  </div>
                </div>
                <div className="mt-2 text-[9px] uppercase tracking-[0.18em] text-base-content/60">{review.user?.username || 'Friend'}</div>
                {renderFriendStars(review, index)}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold">{t("Reviews")}</h2>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 border-b border-base-300">
        {REVIEW_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-base-content/50 hover:text-base-content"
            }`}
          >
            {tab}
            {tab === t("Friends") && !loadingFriends && friendsReviews.length > 0 && (
              <span className="ml-1.5 text-xs bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">
                {friendsReviews.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-base-100 rounded-2xl p-4 h-28 animate-pulse" />
          ))}
        </div>
      ) : currentList.length === 0 ? (
        <p className="text-center text-base-content/50 py-10 text-sm">
          {emptyMessages[activeTab]}
        </p>
      ) : (
        <div className="space-y-3">
          {currentList.map((review) => (
            <ReviewCard
              key={review._id}
              review={review}
              currentUserId={user?._id}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────
export default function ContentDetailPage() {
  const { t } = useTranslation();
  const { type: rawType, contentId } = useParams();
  const type = rawType?.toLowerCase();
  const { user } = useContext(AuthContext);
  const { ratingsMap, updateRating } = useContext(RatingsContext) || { ratingsMap: new Map(), updateRating: () => {} };

  // --- MEVCUT STATE'LER (Dokunulmadı) ---
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true); // BU GENEL YÜKLEME DURUMU OLARAK KALACAK
    const [error, setError] = useState(null);
    const [added, setAdded] = useState(false);
    const [inToWatchList, setInToWatchList] = useState(false);
    const [rating, setRating] = useState(0);
    const [isRatingLoading, setIsRatingLoading] = useState(false);
    const [isFavModalOpen, setIsFavModalOpen] = useState(false);
    const [isAddToListOpen, setIsAddToListOpen] = useState(false);
    const [favoriteMovies, setFavoriteMovies] = useState([]);
    const [favoriteSeries, setFavoriteSeries] = useState([]);
    const [allRatings, setAllRatings] = useState([]);
    const [loadingAllRatings, setLoadingAllRatings] = useState(true);
    const [showReviewLink, setShowReviewLink] = useState(false);
    // --- BİTİŞ ---

    // Calculate rating from ratingsMap synchronously (convert from 5-star to 10-star scale)
    const existingRating = useMemo(() => {
        const val = ratingsMap.get(contentId) || 
                    (content?._id ? ratingsMap.get(content._id.toString()) : 0) || 
                    (content?.tvdb ? ratingsMap.get(content.tvdb.toString()) : 0) || 
                    0;
        return val * 2;
    }, [ratingsMap, contentId, content]);

    // Sync rating state when existingRating changes
    useEffect(() => {
        setRating(existingRating);
    }, [existingRating]);

  // Review input state
  const [reviewText, setReviewText] = useState("");
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [userHasReviewed, setUserHasReviewed] = useState(false);
  // Track user's own review _id for deletion
  const [userReviewId, setUserReviewId] = useState(null);
  const [showReviewInput, setShowReviewInput] = useState(false);  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  useEffect(() => {
    const fetchEssentialData = async () => {
      const cachedContent = type === 'movie'
        ? getCacheItem(CACHE_KEYS.MOVIE(contentId))
        : getCacheItem(CACHE_KEYS.SERIES(contentId));

      setError(null);
      let currentContentId = contentId;

      if (cachedContent) {
        setContent(cachedContent);
        setLoading(false);
        currentContentId = cachedContent._id;
        const currentUserCached = getCacheItem(CACHE_KEYS.CURRENT_USER);
        if (currentUserCached) {
          const userData = currentUserCached;
          setAdded(!!userData.watchlist.find(item => item.itemId === currentContentId));
          setInToWatchList(!!userData.toWatchList?.find(item => item.itemId === currentContentId));
          setFavoriteMovies(userData.favoriteMovies || []);
          setFavoriteSeries(userData.favoriteSeries || []);
        }
      } else {
        setLoading(true);
      }

      try {
        setLoadingAllRatings(true);
        const [contentResult, userResult, ratingResult, allRatingsResult] = await Promise.allSettled([
          type === 'movie' ? contentService.getMovieById(contentId) : contentService.getSeriesById(contentId),
          userService.getCurrentUser(),
          ratingService.getMyRating(contentId),
          ratingService.getAllRatingsForContent(contentId)
        ]);

        if (contentResult.status === "rejected") {
            throw contentResult.reason;
        }

        const contentData = contentResult.value.data || contentResult.value;
        setContent(contentData);
        currentContentId = contentData._id;

        if (userResult.status === "fulfilled") {
            const userData = userResult.value.data || userResult.value;
            setAdded(!!(userData.watchlist && userData.watchlist.find(item => item.itemId === currentContentId)));
            setInToWatchList(!!(userData.toWatchList && userData.toWatchList.find(item => item.itemId === currentContentId)));
            setFavoriteMovies(userData.favoriteMovies || []);
            setFavoriteSeries(userData.favoriteSeries || []);
        }

        if (ratingResult.status === "fulfilled") {
            const ratingObj = ratingResult.value?.data || ratingResult.value;
            setRating(ratingObj?.value || 0);
        } else {
            setRating(0);
        }

        if (allRatingsResult.status === "fulfilled") {
            const ratingsData = allRatingsResult.value.data || allRatingsResult.value || [];
            const ratingValues = ratingsData.map(r => {
                const val = r.value || r;
                return val / 2;
            });
            setAllRatings(ratingValues);
        } else {
            setAllRatings([]);
        }
        
        setLoadingAllRatings(false);
        setLoading(false);

            } catch (err) {
                console.error("İçerik/Kullanıcı verisi çekilirken hata:", err);
                setError(t("Content could not be loaded")); // Ana hata durumu
                setLoading(false);
            }
        };

    // Check if user already has a review for this content
    const fetchUserReview = async () => {
      if (!user) return;
      try {
        const res = await reviewService.getReviewsByContent(contentId, "recent");
        const all = res.data || res || [];
        const own = all.find(r => r.user?._id === user._id);
        if (own) {
          setUserHasReviewed(true);
          setReviewText(own.text);
          setUserReviewId(own._id);
        }
      } catch { /* silently ignore */ }
    };

    fetchEssentialData();
    fetchUserReview();
  }, [contentId, type, user?._id]);

  const handleRatingChange = async (newValue) => {
    const currentContentId = content._id;
    const oldValue = rating;
    setRating(newValue);

    if (!added && !isFavorite) {
      toast.success(t("Rating set locally. Add to Watchedlist to save."));
      return;
    }

    setIsRatingLoading(true);
    
    // Optimistic update for context and local allRatings
    if (updateRating) {
      updateRating(currentContentId, newValue);
    }
    
    // Update local allRatings for the chart
    setAllRatings(prev => {
      // If the user already rated, we should theoretically replace their old rating,
      // but finding it in the array of anonymous numbers is hard.
      // So we'll just add the new one and optionally remove one old value if they had rated.
      const newRatings = [...prev];
      if (oldValue > 0) {
        const oldIndex = newRatings.indexOf(oldValue / 2);
        if (oldIndex > -1) newRatings.splice(oldIndex, 1);
      }
      newRatings.push(newValue / 2);
      return newRatings;
    });

    try {
      await ratingService.createRating({ contentId: currentContentId, contentType: type, value: newValue });
      toast.success(t("Rating saved!"));
    } catch (err) {
      toast.error(t("Couldn't save rating."));
      setRating(oldValue);
      if (updateRating) {
        updateRating(currentContentId, oldValue);
      }
      // Revert allRatings
      setAllRatings(prev => {
        const reverted = [...prev];
        const newIndex = reverted.lastIndexOf(newValue / 2);
        if (newIndex > -1) reverted.splice(newIndex, 1);
        if (oldValue > 0) reverted.push(oldValue / 2);
        return reverted;
      });
    } finally { setIsRatingLoading(false); }
  };

  const handleAddToList = async () => {
    setAdded(true);
    try {
      await userService.addToWatchlist(content._id, type);
      toast.success(t("Added to your list"));
      
      // If there's a rating set locally but not saved yet, save it now
      if (rating > 0) {
        if (updateRating) {
          updateRating(content._id, rating);
        }
        setAllRatings(prev => {
          const newRatings = [...prev];
          newRatings.push(rating / 2);
          return newRatings;
        });
        await ratingService.createRating({ contentId: content._id, contentType: type, value: rating }).catch(console.error);
      }
    } catch (error) { 
      setAdded(false);
      toast.error(error.response?.data?.message || "An error occurred"); 
    }
  };

  const handleRemoveFromList = async () => {
    setAdded(false);
    try {
      await userService.removeFromWatchlist(content._id, type);
      toast.success(t("Removed from your list"));
      
      // Also remove from favorites locally since backend does it
      if (type === 'movie') {
        setFavoriteMovies(prev => prev.filter(id => id !== content._id));
      } else {
        setFavoriteSeries(prev => prev.filter(id => id !== content._id));
      }

      // Remove rating locally and update rate chart
      if (rating > 0) {
        setAllRatings(prev => {
          const newRatings = [...prev];
          const index = newRatings.lastIndexOf(rating / 2);
          if (index > -1) newRatings.splice(index, 1);
          return newRatings;
        });
        if (updateRating) {
          updateRating(content._id, 0); // clear from Context
        }
        setRating(0); // clear local state
      }

    } catch (err) { 
      setAdded(true);
      toast.error(err.response?.data?.message || "An error occurred"); 
    }
  };

  const handleAddToToWatchList = async () => {
    setInToWatchList(true);
    try {
      await userService.addToToWatchList(content._id, type);
      toast.success(t("Added to watchlist"));
    } catch (error) { 
      setInToWatchList(false);
      toast.error(error.message || "An error occurred"); 
    }
  };

  const handleRemoveFromToWatchList = async () => {
    setInToWatchList(false);
    try {
      await userService.removeFromToWatchList(content._id, type);
      toast.success(t("Removed from watchlist"));
    } catch (err) { 
      setInToWatchList(true);
      toast.error(err.message || "An error occurred"); 
    }
  };

  const handleOpenFavModal = () => {
    if (!added) { handleAddToList(); }
    setIsFavModalOpen(true);
  };

  const handleSaveFavorites = (updatedList) => {
    if (type === 'movie') setFavoriteMovies(updatedList);
    else setFavoriteSeries(updatedList);
    toast.success(t("Favorites saved!"));
    setIsFavModalOpen(false);
  };

  const handleSaveReview = async () => {
    if (!reviewText.trim()) return toast.error(t("Review cannot be empty."));
    setIsSavingReview(true);
    try {
      const response = await reviewService.createReview({
        contentId: content._id,
        contentType: type,
        text: reviewText.trim(),
      });
      const saved = response.data || response;
      setUserHasReviewed(true);
      setUserReviewId(saved._id);
      toast.success(userHasReviewed ? t("Review updated!") : t("Review added!"));
    } catch (err) {
      toast.error(t("Could not save review."));
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleDeleteOwnReview = async () => {
    if (!userReviewId) return;
    try {
      await reviewService.deleteReview(userReviewId, content._id);
      setUserHasReviewed(false);
      setReviewText("");
      setUserReviewId(null);
      toast.success(t("Review deleted"));
    } catch {
      toast.error(t("Could not delete review."));
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error && !content) return <div className="alert alert-error m-4">{error}</div>;
  if (!content) return null;

  const title = content.title || content.name;
  const releaseDate = content.release_date || content.first_air_date;
  const posterUrl = `https://image.tmdb.org/t/p/w500${content.poster_path}`;
  const backdropUrl = content.backdrop_path ? `https://image.tmdb.org/t/p/w1280${content.backdrop_path}` : '';
  const isRated = rating > 0;
  const currentFavList = type === 'movie' ? favoriteMovies : favoriteSeries;
  const isFavorite = currentFavList.includes(content._id);

    return (
        <div className="min-h-screen bg-base-200">

            {/* ===== MERKEZI İÇERİK CONTAINER ===== */}
            <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">

                {/* Başlık ve Aksiyon Paneli */}
                <div className="mb-8 flex flex-col lg:flex-row gap-8">

                    {/* ===== SOL TARAF - POSTER ===== */}
                    <div className="lg:w-64 flex-shrink-0">
                        <div className="rounded-lg overflow-hidden shadow-xl border border-base-300/30">
                            <img 
                                src={posterUrl}
                                alt={title}
                                className="w-full h-auto"
                            />
                        </div>
                    </div>

                    {/* ===== SAĞ TARAF - İÇ LAYOUT ===== */}
                    <div className="flex-1 min-w-0 flex flex-col lg:flex-row gap-6">
                        
                        {/* SAĞ-İÇ-SOL: BAŞLIK VE AÇIKLAMA */}
                        <div className="flex-1 min-w-0 flex flex-col">
                            {/* Başlık + Yıl */}
                            <div className="mb-4">
                                <div className="flex flex-wrap items-baseline gap-3">
                                    <h1 className="text-4xl md:text-5xl font-bold text-base-content">{title}</h1>
                                    {releaseDate && (
                                        <p className="text-xl opacity-60 font-light">{new Date(releaseDate).getFullYear()}</p>
                                    )}
                                </div>
                                {type === 'series' && content.number_of_seasons && (
                                    <div className="mt-2">
                                        <div className="badge badge-secondary badge-lg">
                                            {content.number_of_seasons === 1 ? t("season_count", { count: 1 }) : t("season_count_plural", { count: content.number_of_seasons })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Açıklama - Overview */}
                            {content.overview && (
                                <p className="text-base-content/80 leading-relaxed text-base flex-grow">
                                    {content.overview}
                                </p>
                            )}
                        </div>

                        {/* SAĞ-İÇ-SAĞ: AKSIYON PANELI - KOMPAKT VE FIXED GENIŞLIK */}
                        <div className="relative bg-base-100 rounded-xl shadow-lg p-6 border border-base-300/50 lg:w-80 h-fit">
                            {/* 1. Add to Watchedlist / Watched List */}
                            <div className="pb-4 border-b border-base-300/30">
                                {added ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-success text-base font-semibold">
                                            <span>✓</span>
                                            <span>{t("Added to List")}</span>
                                        </div>
                                        <button 
                                            className="btn btn-error btn-sm btn-outline w-full"
                                            onClick={handleRemoveFromList}
                                        >
                                            {t("Remove")}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <button 
                                            className="btn btn-primary w-full btn-sm"
                                            onClick={handleAddToList}
                                        >
                                            {t("Add to Watchedlist")}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* 2. Add to Favorites */}
                            <div className="py-4 border-b border-base-300/30">
                                <button 
                                    className={`btn btn-sm w-full ${isFavorite ? 'btn-warning' : 'btn-outline'}`}
                                    onClick={handleOpenFavModal}
                                >
                                    {isFavorite ? `★ ${t("Manage Favorites")}` : `☆ ${t("Add to Favorites")}`}
                                </button>
                            </div>

                            {/* 3. Rating Stars */}
                            <div className="py-4 border-b border-base-300/30">
                                <label className="text-sm font-semibold block mb-2 text-center">{t("Your Rating")}</label>
                                <div className="flex gap-1 justify-center">
                                    <StarRating rating={rating} onRatingChange={handleRatingChange} />
                                </div>
                                {isRatingLoading && (
                                    <span className="text-xs italic opacity-60 block mt-1">{t("Saving...")}</span>
                                )}
                            </div>

                            {/* 4. Add to Custom List */}
                            <div className="py-4 border-b border-base-300/30">
                                <button
                                    className="btn btn-outline btn-sm w-full justify-center"
                                    onClick={() => setIsAddToListOpen(true)}
                                >
                                    {t("Add to List")}
                                </button>
                            </div>

                            {/* 5. Add a Review */}
                            <div className="py-4 border-b border-base-300/30">
                                {!showReviewLink ? (
                                    <button
                                        className="btn btn-sm btn-secondary w-full"
                                        onClick={() => setShowReviewLink(true)}
                                    >
                                        {t("Add a Review")}
                                    </button>
                                ) : (
                                    <div className="mt-3 space-y-2">
                                        <div className="relative">
                                            <textarea
                                                className="textarea textarea-bordered w-full h-24 resize-none"
                                                placeholder={t("Write your review...")}
                                                value={reviewText}
                                                onChange={(e) => setReviewText(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                className="absolute bottom-2 right-2 btn btn-ghost btn-xs"
                                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                            >
                                                😀
                                            </button>
                                        </div>
                                        {showEmojiPicker && (
                                            <div className="absolute z-50 mt-2">
                                                <EmojiPicker
                                                    onEmojiClick={(emojiObject) => {
                                                        setReviewText(reviewText + emojiObject.emoji);
                                                        setShowEmojiPicker(false);
                                                    }}
                                                    theme="dark"
                                                />
                                            </div>
                                        )}
                                        <button
                                            className="btn btn-primary btn-sm w-full"
                                            onClick={handleSaveReview}
                                            disabled={isSavingReview || !reviewText.trim()}
                                        >
                                            {isSavingReview ? t("Saving...") : t("Save Review")}
                                        </button>
                                        <button
                                            className="btn btn-link btn-xs px-0 normal-case"
                                            onClick={() => setShowReviewLink(false)}
                                        >
                                            {t("Cancel")}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* 6. Watchlist / To Watch */}
                            <div className="pt-4">
                                {inToWatchList ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-accent text-base font-semibold">
                                            <span>🕓</span>
                                            <span>{t("In Watchlist")}</span>
                                        </div>
                                        <button 
                                            className="btn btn-error btn-sm btn-outline w-full"
                                            onClick={handleRemoveFromToWatchList}
                                        >
                                            {t("Remove")}
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        className="btn btn-outline btn-sm w-full justify-center"
                                        onClick={handleAddToToWatchList}
                                    >
                                        {t("Add to Watchlist")}
                                    </button>
                                )}
                            </div>

                            {/* Rating Distribution — skeleton while async fetch resolves */}
                            {loadingAllRatings ? (
                                <div className="mt-6 pt-4 border-t border-base-300/30 animate-pulse">
                                    <div className="h-3 w-16 bg-base-300 rounded mb-3" />
                                    <div className="flex items-end gap-4">
                                        <div className="flex-1 flex items-end gap-1 h-16">
                                            {[40, 70, 100, 80, 55, 90, 65, 45, 30, 75].map((h, i) => (
                                                <div key={i} className="flex-1 bg-base-300 rounded-sm" style={{ height: `${h}%` }} />
                                            ))}
                                        </div>
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="h-8 w-10 bg-base-300 rounded" />
                                            <div className="h-3 w-8 bg-base-300 rounded" />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <RatingDistribution ratings={allRatings} />
                            )}
                            {showReviewLink && (
                                <div className="absolute bottom-4 right-4 text-xs uppercase tracking-[0.08em] text-base-content/60">
                                    {t("share")}
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                <ReviewSection
                  contentId={content._id}
                  user={user}
                  contentType={type}
                  t={t}
                />

            
        </div> {/* Ana container bitti */}

        {/* Modals */}
        {isAddToListOpen && content && (
            <AddToListModal
                itemId={content._id}
                itemType={content.type || type}
                onClose={() => setIsAddToListOpen(false)}
            />
        )}

        {isFavModalOpen && (
            <FavoritesModal
                type={type}
                initialList={type === 'movie' ? favoriteMovies : favoriteSeries}
                newItem={content}
                onClose={() => setIsFavModalOpen(false)}
                onSaveSuccess={handleSaveFavorites}
            />
        )}

        </div> // Ana div bitti
    );
}
