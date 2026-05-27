// frontend/pages/ContentDetailPage.jsx (Using service layer)

import React, { useState, useEffect, useContext } from 'react'; // useContext eklendi
import { useParams } from 'react-router-dom';
import { contentService } from '../api/contentService';
import { ratingService } from '../api/ratingService';
import { reviewService } from '../api/reviewService';
import { userService } from '../api/userService';
import { getCacheItem, CACHE_KEYS } from '../api/cacheService';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns'; // Yorum zamanı için

import { AuthContext } from '../context/AuthContext'; // Giriş yapan kullanıcıyı almak için

import StarRating from '../components/StarRating';
import FavoritesModal from '../components/FavoritesModal';
import AddToListModal from '../components/AddToListModal';
import LoadingSpinner from '../components/LoadingSpinner';
import RatingDistribution from '../components/RatingDistribution';

export default function ContentDetailPage() {
    const { type, contentId } = useParams();
    const { user } = useContext(AuthContext); // Giriş yapan kullanıcıyı al

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
    // --- BİTİŞ ---

    // --- YENİ STATE'LER (Sadece Yorumlar için) ---
    const [reviews, setReviews] = useState([]);
    const [loadingReviews, setLoadingReviews] = useState(true); // Yorumların ayrı yüklenme durumu
    const [showReviewInput, setShowReviewInput] = useState(false);
    const [reviewText, setReviewText] = useState("");
    const [isSavingReview, setIsSavingReview] = useState(false);
    const [userHasReviewed, setUserHasReviewed] = useState(false);
    // --- BİTİŞ ---

    // 1. Veri Çekme (useEffect) GÜNCELLENDİ (Service layer kullanarak)
    useEffect(() => {
        const fetchEssentialData = async () => {
            // Check cache first
            const cachedContent = type === 'movie' 
              ? getCacheItem(CACHE_KEYS.MOVIE(contentId))
              : getCacheItem(CACHE_KEYS.SERIES(contentId));
            
            setError(null);
            let currentContentId = contentId;
            
            // If content is cached, use it immediately
            if (cachedContent) {
                setContent(cachedContent);
                setLoading(false);
                currentContentId = cachedContent._id;
                
                // Set watchlist/favorites/rating from cached content's user data
                const currentUserCached = getCacheItem(CACHE_KEYS.CURRENT_USER);
                if (currentUserCached) {
                    const userData = currentUserCached;
                    const existsInWatchlist = userData.watchlist.find(item => item.itemId === currentContentId);
                    setAdded(!!existsInWatchlist);
                    const existsInToWatchListCached = userData.toWatchList?.find(item => item.itemId === currentContentId);
                    setInToWatchList(!!existsInToWatchListCached);
                    setFavoriteMovies(userData.favoriteMovies || []);
                    setFavoriteSeries(userData.favoriteSeries || []);
                }
            } else {
                // No cache, show loading
                setLoading(true);
            }

            // Always fetch fresh data in background
            try {
                const contentRes = type === 'movie' 
                  ? await contentService.getMovieById(contentId)
                  : await contentService.getSeriesById(contentId);
                
                const userRes = await userService.getCurrentUser();

                setContent(contentRes.data || contentRes);
                currentContentId = (contentRes.data || contentRes)._id;

                const userData = userRes.data || userRes;
                const existsInWatchlist = userData.watchlist.find(item => item.itemId === currentContentId);
                setAdded(!!existsInWatchlist);
                const existsInToWatchList = userData.toWatchList?.find(item => item.itemId === currentContentId);
                setInToWatchList(!!existsInToWatchList);
                setFavoriteMovies(userData.favoriteMovies || []);
                setFavoriteSeries(userData.favoriteSeries || []);

                try {
                    const ratingRes = await ratingService.getMyRating(currentContentId);
                    setRating((ratingRes.data || ratingRes).value || 0);
                } catch (ratingErr) {
                    if (ratingErr.response?.status === 404 || ratingErr.message === 'Rating not found') {
                        setRating(0);
                    } else {
                        console.error("Puan çekilirken hata:", ratingErr);
                    }
                }

                // Tüm ratingleri çek (rating dağılımı için)
                try {
                    const allRatingsRes = await ratingService.getAllRatingsForContent(currentContentId);
                    const ratingsData = allRatingsRes.data || allRatingsRes || [];
                    // Backend'den 1-10 aralığında geliyor, 0.5-5 aralığına çeviriyoruz
                    const ratingValues = ratingsData.map(r => {
                        const val = r.value || r;
                        return val / 2; // 1-10 -> 0.5-5
                    });
                    setAllRatings(ratingValues);
                } catch (allRatingsErr) {
                    console.error("Tüm ratingler çekilirken hata:", allRatingsErr);
                    setAllRatings([]);
                }

                setLoading(false);

            } catch (err) {
                console.error("İçerik/Kullanıcı verisi çekilirken hata:", err);
                setError("Content could not be loaded."); // Ana hata durumu
                setLoading(false);
            }
        };

        const fetchReviews = async () => {
            // YORUMLARI AYRI ÇEK
            setLoadingReviews(true);
            try {
                const reviewsRes = await reviewService.getReviewsByContent(contentId);
                setReviews(reviewsRes.data || reviewsRes);

                // Kullanıcının mevcut yorumunu bul (user context'ten kontrol et)
                const existingReview = (reviewsRes.data || reviewsRes).find(r => r.user?._id === user?._id);
                if (existingReview) {
                    setUserHasReviewed(true);
                    setReviewText(existingReview.text);
                } else {
                    setUserHasReviewed(false);
                    setReviewText("");
                }
            } catch (reviewErr) {
                 console.error("Yorumlar çekilirken hata:", reviewErr);
                 // Yorum hatası ana sayfayı etkilememeli, belki sadece konsola log yazılır
                 // setError("Reviews could not be loaded.");
            } finally {
                 setLoadingReviews(false);
            }
        };

        fetchEssentialData(); // Önce ana verileri çek
        fetchReviews();     // Sonra yorumları çek

    }, [contentId, type, user?._id]); // user._id'yi ekledik, yorumları kontrol etmek için


    // --- RATING HANDLER ---
    const handleRatingChange = async (newValue) => {
        const currentContentId = content._id;
        const contentType = content.type || type;
        const oldValue = rating;
        setRating(newValue);
        setIsRatingLoading(true);
        try {
            await ratingService.createRating({ 
                contentId: currentContentId, 
                contentType: contentType, 
                value: newValue 
            });
            toast.success("Rating saved!");
        } catch (err) { 
            console.error("Puan kaydetme hatası:", err); 
            toast.error("Couldn't save rating."); 
            setRating(oldValue); 
        }
        finally { 
            setIsRatingLoading(false); 
        }
    };

    // --- WATCHLIST HANDLER ---
    const handleAddToList = async () => {
        const contentType = content.type || (type === 'movie' ? 'movie' : 'series');
        try {
            await userService.addToWatchlist(content._id, contentType);
            setAdded(true); 
            toast.success("Added to your list");
        } catch (error) { 
            console.error(error.response?.data?.message || error.message); 
            toast.error(error.response?.data?.message || "An error occurred"); 
        }
    };

    const handleRemoveFromList = async () => {
        try {
            await userService.removeFromWatchlist(content._id);
            setAdded(false); 
            toast.success("Removed from your list");
        } catch (err) { 
            console.error(err.response?.data?.message || err.message); 
            toast.error(err.response?.data?.message || "An error occurred"); 
        }
    };

    const handleAddToToWatchList = async () => {
        const contentType = content.type || (type === 'movie' ? 'movie' : 'series');
        try {
            await userService.addToToWatchList(content._id, contentType);
            setInToWatchList(true);
            toast.success("Added to watchlist");
        } catch (error) {
            toast.error(error.message || "An error occurred");
        }
    };

    const handleRemoveFromToWatchList = async () => {
        const contentType = content.type || (type === 'movie' ? 'movie' : 'series');
        try {
            await userService.removeFromToWatchList(content._id, contentType);
            setInToWatchList(false);
            toast.success("Removed from watchlist");
        } catch (err) {
            toast.error(err.message || "An error occurred");
        }
    };

    const handleOpenFavModal = async () => {
        if (!added) { await handleAddToList(); } 
        setIsFavModalOpen(true); 
    };

    const handleSaveFavorites = (updatedList) => { 
        if (type === 'movie') { setFavoriteMovies(updatedList); } 
        else { setFavoriteSeries(updatedList); } 
        toast.success("Favorites saved!"); 
        setIsFavModalOpen(false); 
    };


    // --- REVIEW SAVE HANDLER ---
    const handleSaveReview = async () => {
        if (!reviewText.trim()) { 
            return toast.error("Review cannot be empty."); 
        }
        setIsSavingReview(true);
        try {
            const response = await reviewService.createReview({ 
                contentId: content._id, 
                contentType: type, 
                text: reviewText.trim() 
            });
            const savedReview = response.data || response;
            setReviews(prevReviews => { 
                const otherReviews = prevReviews.filter(r => r.user?._id !== user?._id); 
                return [savedReview, ...otherReviews]; 
            });
            setShowReviewInput(false); 
            setUserHasReviewed(true); 
            toast.success(userHasReviewed ? "Review updated!" : "Review added!");
        } catch (err) { 
            console.error("Yorum kaydedilirken hata:", err); 
            toast.error("Error: Could not save review."); 
        }
        finally { 
            setIsSavingReview(false); 
        }
    };


    // Ana Yüklenme Durumu (İçerik yüklenmeden gösterme)
    if (loading) return <LoadingSpinner />; // Ana loading state'ini kullanıyoruz
    if (error && !content) return <div className="alert alert-error m-4">{error}</div>;
    if (!content) return null;

    // Diğer değişkenler (Değişiklik yok)
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
                                            {content.number_of_seasons} Sezon
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
                        <div className="bg-base-100 rounded-xl shadow-lg p-6 border border-base-300/50 lg:w-80 h-fit">
                            {/* 1. Add to Watchedlist / Watched List */}
                            <div className="pb-4 border-b border-base-300/30">
                                {added ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-success text-base font-semibold">
                                            <span>✓</span>
                                            <span>Added to List</span>
                                        </div>
                                        <button 
                                            className="btn btn-error btn-sm btn-outline w-full"
                                            onClick={handleRemoveFromList}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <button 
                                            className="btn btn-primary w-full btn-sm"
                                            onClick={handleAddToList}
                                            disabled={!isRated}
                                        >
                                            Add to Watchedlist
                                        </button>
                                        {!isRated && (
                                            <p className="text-xs italic opacity-60">(Rate first to add)</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* 2. Add to Favorites */}
                            <div className="py-4 border-b border-base-300/30">
                                <button 
                                    className={`btn btn-sm w-full ${isFavorite ? 'btn-warning' : 'btn-outline'}`}
                                    onClick={handleOpenFavModal}
                                    disabled={!isRated}
                                >
                                    {isFavorite ? '★ Manage Favorites' : '☆ Add to Favorites'}
                                </button>
                                {!isRated && (
                                    <p className="text-xs italic opacity-60 mt-1">(Rate first to favorite)</p>
                                )}
                            </div>

                            {/* 3. Rating Stars */}
                            <div className="py-4 border-b border-base-300/30">
                                <label className="text-sm font-semibold block mb-2 text-center">Your Rating</label>
                                <div className="flex gap-1 justify-center">
                                    <StarRating rating={rating} onRatingChange={handleRatingChange} />
                                </div>
                                {isRatingLoading && (
                                    <span className="text-xs italic opacity-60 block mt-1">Saving...</span>
                                )}
                            </div>

                            {/* 4. Add to Custom List */}
                            <div className="py-4 border-b border-base-300/30">
                                <button
                                    className="btn btn-outline btn-sm w-full justify-center"
                                    onClick={() => setIsAddToListOpen(true)}
                                >
                                    Add to List
                                </button>
                            </div>

                            {/* 5. Watchlist / To Watch */}
                            <div className="pt-4">
                                {inToWatchList ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-accent text-base font-semibold">
                                            <span>🕓</span>
                                            <span>In Watchlist</span>
                                        </div>
                                        <button 
                                            className="btn btn-error btn-sm btn-outline w-full"
                                            onClick={handleRemoveFromToWatchList}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        className="btn btn-outline btn-sm w-full justify-center"
                                        onClick={handleAddToToWatchList}
                                    >
                                        Add to Watchlist
                                    </button>
                                )}
                            </div>

                            {/* Rating Distribution */}
                            <RatingDistribution ratings={allRatings} />
                        </div>

                    </div>
                </div>

            {/* ===== YORUMLAR SEKSİYONU ===== */}
            <div className="py-8 md:py-12 border-t border-base-300">
                <section className="max-w-5xl mx-auto px-4 md:px-6">
                    <h2 className="text-2xl md:text-3xl font-bold mb-6">Reviews</h2>

                    {/* Yorum Ekleme Kutusu */}
                    {user ? (
                        <div className="mb-8 p-6 bg-base-100 rounded-lg shadow border border-base-300/30">
                            {!showReviewInput ? (
                                <button 
                                    className="btn btn-primary btn-sm"
                                    onClick={() => setShowReviewInput(true)}
                                >
                                    {userHasReviewed ? "Edit Your Review" : "Add Your Review"}
                                </button>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <textarea 
                                        className="textarea textarea-bordered w-full focus:outline-none focus:border-primary"
                                        rows="4"
                                        value={reviewText}
                                        onChange={(e) => setReviewText(e.target.value)}
                                        placeholder="Write your review here..."
                                    ></textarea>
                                    <div className="flex justify-end gap-2">
                                        <button 
                                            className="btn btn-sm btn-ghost"
                                            onClick={() => {
                                                setShowReviewInput(false);
                                                const existingReview = reviews.find(r => r.user?._id === user?._id);
                                                setReviewText(existingReview ? existingReview.text : "");
                                            }}
                                            disabled={isSavingReview}
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            className={`btn btn-sm btn-primary ${isSavingReview ? 'loading' : ''}`}
                                            onClick={handleSaveReview}
                                            disabled={isSavingReview}
                                        >
                                            {userHasReviewed ? "Update Review" : "Save Review"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="mb-8 text-center text-base-content/70">You need to be logged in to add a review.</p>
                    )}

                    {/* Mevcut Yorumları Listeleme */}
                    {loadingReviews ? (
                        <div className="flex justify-center py-8">
                            <span className="loading loading-dots loading-lg"></span>
                        </div>
                    ) : reviews.length > 0 ? (
                        <div className="space-y-4">
                            {reviews.map((review) => (
                                <div key={review._id} className="p-5 bg-base-100 rounded-lg shadow border border-base-300/30 hover:border-base-300 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-semibold text-base">{review.user?.username || "Unknown User"}</span>
                                        <span className="text-xs text-base-content/60">
                                            {review.createdAt ? formatDistanceToNow(new Date(review.createdAt), { addSuffix: true }) : ""}
                                        </span>
                                    </div>
                                    <p className="whitespace-pre-wrap break-words text-base-content/80">{review.text}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-base-content/70 py-8">No reviews yet. Be the first!</p>
                    )}
                    {error && !loading && !loadingReviews && reviews.length === 0 && (
                        <p className="text-center text-error py-4">{error}</p>
                    )}
                </section>
            </div>
            {/* ===== BİTİŞ: YORUMLAR SEKSİYONU ===== */}
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