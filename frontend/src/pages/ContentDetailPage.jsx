// frontend/pages/ContentDetailPage.jsx
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { contentService } from '../api/contentService';
import { ratingService } from '../api/ratingService';
import { reviewService } from '../api/reviewService';
import { userService } from '../api/userService';
import { getCacheItem, CACHE_KEYS } from '../api/cacheService';
import toast from 'react-hot-toast';

import { AuthContext } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import ReviewCard from '../components/ReviewCard';
import FavoritesModal from '../components/FavoritesModal';
import AddToListModal from '../components/AddToListModal';
import LoadingSpinner from '../components/LoadingSpinner';

const REVIEW_TABS = ["Friends", "Popular"];

// ── Review section ───────────────────────────────────────────────────
function ReviewSection({ contentId, user, contentType }) {
  const [activeTab, setActiveTab] = useState("Friends");
  const [friendsReviews, setFriendsReviews] = useState([]);
  const [popularReviews, setPopularReviews] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingPopular, setLoadingPopular] = useState(true);

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

  const currentList = activeTab === "Friends" ? friendsReviews : popularReviews;
  const isLoading = activeTab === "Friends" ? loadingFriends : loadingPopular;

  const emptyMessages = {
    Friends: user
      ? "None of the people you follow have reviewed this yet."
      : "Log in to see reviews from people you follow.",
    Popular: "No reviews yet. Be the first!",
  };

  return (
    <section className="max-w-4xl mx-auto px-4 md:px-8 pb-12">
      <h2 className="text-2xl font-bold mb-4">Reviews</h2>

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
            {tab === "Friends" && !loadingFriends && friendsReviews.length > 0 && (
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
  const { type, contentId } = useParams();
  const { user } = useContext(AuthContext);

  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [added, setAdded] = useState(false);
  const [inToWatchList, setInToWatchList] = useState(false);
  const [rating, setRating] = useState(0);
  const [isRatingLoading, setIsRatingLoading] = useState(false);
  const [isFavModalOpen, setIsFavModalOpen] = useState(false);
  const [isAddToListOpen, setIsAddToListOpen] = useState(false);
  const [favoriteMovies, setFavoriteMovies] = useState([]);
  const [favoriteSeries, setFavoriteSeries] = useState([]);

  // Review input state
  const [reviewText, setReviewText] = useState("");
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [userHasReviewed, setUserHasReviewed] = useState(false);
  // Track user's own review _id for deletion
  const [userReviewId, setUserReviewId] = useState(null);

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
        const contentRes = type === 'movie'
          ? await contentService.getMovieById(contentId)
          : await contentService.getSeriesById(contentId);
        const userRes = await userService.getCurrentUser();

        setContent(contentRes.data || contentRes);
        currentContentId = (contentRes.data || contentRes)._id;

        const userData = userRes.data || userRes;
        setAdded(!!userData.watchlist.find(item => item.itemId === currentContentId));
        setInToWatchList(!!userData.toWatchList?.find(item => item.itemId === currentContentId));
        setFavoriteMovies(userData.favoriteMovies || []);
        setFavoriteSeries(userData.favoriteSeries || []);

        try {
          const ratingRes = await ratingService.getMyRating(currentContentId);
          setRating((ratingRes.data || ratingRes).value || 0);
        } catch (ratingErr) {
          if (ratingErr.response?.status === 404 || ratingErr.message === 'Rating not found') {
            setRating(0);
          }
        }
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Content could not be loaded.");
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
    setIsRatingLoading(true);
    try {
      await ratingService.createRating({ contentId: currentContentId, contentType: content.type || type, value: newValue });
      toast.success("Rating saved!");
    } catch (err) {
      toast.error("Couldn't save rating.");
      setRating(oldValue);
    } finally { setIsRatingLoading(false); }
  };

  const handleAddToList = async () => {
    const contentType = content.type || (type === 'movie' ? 'movie' : 'series');
    try {
      await userService.addToWatchlist(content._id, contentType);
      setAdded(true);
      toast.success("Added to your list");
    } catch (error) { toast.error(error.response?.data?.message || "An error occurred"); }
  };

  const handleRemoveFromList = async () => {
    try {
      await userService.removeFromWatchlist(content._id);
      setAdded(false);
      toast.success("Removed from your list");
    } catch (err) { toast.error(err.response?.data?.message || "An error occurred"); }
  };

  const handleAddToToWatchList = async () => {
    const contentType = content.type || (type === 'movie' ? 'movie' : 'series');
    try {
      await userService.addToToWatchList(content._id, contentType);
      setInToWatchList(true);
      toast.success("Added to watchlist");
    } catch (error) { toast.error(error.message || "An error occurred"); }
  };

  const handleRemoveFromToWatchList = async () => {
    try {
      await userService.removeFromToWatchList(content._id, content.type || type);
      setInToWatchList(false);
      toast.success("Removed from watchlist");
    } catch (err) { toast.error(err.message || "An error occurred"); }
  };

  const handleOpenFavModal = async () => {
    if (!added) { await handleAddToList(); }
    setIsFavModalOpen(true);
  };

  const handleSaveFavorites = (updatedList) => {
    if (type === 'movie') setFavoriteMovies(updatedList);
    else setFavoriteSeries(updatedList);
    toast.success("Favorites saved!");
    setIsFavModalOpen(false);
  };

  const handleSaveReview = async () => {
    if (!reviewText.trim()) return toast.error("Review cannot be empty.");
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
      toast.success(userHasReviewed ? "Review updated!" : "Review added!");
    } catch (err) {
      toast.error("Could not save review.");
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
      toast.success("Review deleted");
    } catch {
      toast.error("Could not delete review.");
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
      {/* Hero */}
      <div className="hero min-h-[70vh]" style={{ backgroundImage: `url(${backdropUrl})` }}>
        <div className="hero-overlay bg-opacity-80 bg-base-300"></div>
        <div className="hero-content flex-col lg:flex-row text-neutral-content animate-fade-in">
          <img src={posterUrl} className="max-w-xs md:max-w-sm rounded-lg shadow-2xl" alt={title} />
          <div className="lg:ml-8 mt-4 lg:mt-0">
            <h1 className="text-4xl md:text-5xl font-bold">{title}</h1>
            <p className="py-2 text-lg">{releaseDate}</p>
            {type === 'series' && content.number_of_seasons && (
              <div className="badge badge-secondary mr-2">{content.number_of_seasons} Sezon</div>
            )}
            <p className="py-6">{content.overview}</p>

            {/* Rating */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Your Rating</h3>
              <StarRating rating={rating} onRatingChange={handleRatingChange} />
              {isRatingLoading && <span className="text-xs italic ml-1 opacity-70"> Saving rating...</span>}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-4 items-start mb-6">
              {added ? (
                <div className="flex flex-col gap-2">
                  <button className="btn btn-success" disabled>✓ Added to List</button>
                  <button className="btn btn-error btn-sm" onClick={handleRemoveFromList}>Remove</button>
                </div>
              ) : (
                <div className="flex flex-col">
                  <button className="btn btn-primary" onClick={handleAddToList} disabled={!isRated}>Add to List</button>
                  {!isRated && <p className="text-sm italic opacity-70 mt-2">(Rate first to add)</p>}
                </div>
              )}
              <div className="flex flex-col">
                <button className={`btn ${isFavorite ? 'btn-warning' : 'btn-outline'}`} onClick={handleOpenFavModal} disabled={!isRated}>
                  {isFavorite ? '★ Manage Favorites' : 'Add to Favorites'}
                </button>
                {!isRated && <p className="text-sm italic opacity-70 mt-2">(Rate first to favorite)</p>}
              </div>
              <button className="btn btn-secondary btn-outline" onClick={() => setIsAddToListOpen(true)}>
                + Add to List
              </button>
              {inToWatchList ? (
                <div className="flex flex-col gap-2">
                  <button className="btn btn-accent" disabled>🕓 In Watchlist</button>
                  <button className="btn btn-error btn-sm" onClick={handleRemoveFromToWatchList}>Remove</button>
                </div>
              ) : (
                <button className="btn btn-accent btn-outline" onClick={handleAddToToWatchList}>+ Watchlist</button>
              )}
            </div>

            {/* Review input */}
            {user ? (
              <div className="max-w-lg">
                <p className="text-sm font-semibold text-white/70 mb-2">
                  {userHasReviewed ? "Your review" : "Write a review"}
                </p>
                <textarea
                  className="textarea w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-white/50 rounded-xl resize-none transition-all"
                  rows="3"
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="What did you think?"
                  maxLength={2000}
                />
                {reviewText.trim().length > 0 && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-white/30">{reviewText.length}/2000</span>
                    <div className="flex gap-2">
                      {userHasReviewed && (
                        <button
                          onClick={handleDeleteOwnReview}
                          className="btn btn-sm btn-ghost text-error/70 hover:text-error"
                        >
                          Delete
                        </button>
                      )}
                      <button
                        className={`btn btn-sm btn-primary ${isSavingReview ? 'loading' : ''}`}
                        onClick={handleSaveReview}
                        disabled={isSavingReview}
                      >
                        {userHasReviewed ? "Update" : "Post review"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-white/50">Log in to write a review.</p>
            )}
          </div>
        </div>
      </div>

      {/* Reviews section — two tabs */}
      <div className="mt-8">
        <ReviewSection contentId={content._id} user={user} contentType={type} />
      </div>

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
    </div>
  );
}
