// frontend/pages/ContentDetailPage.jsx (YORUM ENTEGRE EDİLMİŞ - DİKKATLİ VERSİYON)

import React, { useState, useEffect, useContext } from 'react'; // useContext eklendi
import { useParams } from 'react-router-dom';
import API from '../api/axios';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns'; // Yorum zamanı için

import { AuthContext } from '../context/AuthContext'; // Giriş yapan kullanıcıyı almak için

import StarRating from '../components/StarRating';
import FavoritesModal from '../components/FavoritesModal';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ContentDetailPage() {
    const { type, contentId } = useParams();
    const { user } = useContext(AuthContext); // Giriş yapan kullanıcıyı al

    // --- MEVCUT STATE'LER (Dokunulmadı) ---
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true); // BU GENEL YÜKLEME DURUMU OLARAK KALACAK
    const [error, setError] = useState(null);
    const [added, setAdded] = useState(false);
    const [rating, setRating] = useState(0);
    const [isRatingLoading, setIsRatingLoading] = useState(false);
    const [isFavModalOpen, setIsFavModalOpen] = useState(false);
    const [favoriteMovies, setFavoriteMovies] = useState([]);
    const [favoriteSeries, setFavoriteSeries] = useState([]);
    // --- BİTİŞ ---

    // --- YENİ STATE'LER (Sadece Yorumlar için) ---
    const [reviews, setReviews] = useState([]);
    const [loadingReviews, setLoadingReviews] = useState(true); // Yorumların ayrı yüklenme durumu
    const [showReviewInput, setShowReviewInput] = useState(false);
    const [reviewText, setReviewText] = useState("");
    const [isSavingReview, setIsSavingReview] = useState(false);
    const [userHasReviewed, setUserHasReviewed] = useState(false);
    // --- BİTİŞ ---

    // 1. Veri Çekme (useEffect) GÜNCELLENDİ (Yorumları ayrı çekmek için)
    useEffect(() => {
        const fetchEssentialData = async () => {
            // SADECE İÇERİK ve KULLANICI BİLGİSİNİ ÇEK (Watchlist/Fav/Rating için)
            setLoading(true); // Ana yüklenmeyi başlat
            setError(null);
            let currentContentId = contentId;
            try {
                const [contentRes, userRes] = await Promise.all([
                    API.get(type === 'movie' ? `/movies/${contentId}` : `/series/${contentId}`),
                    API.get("/users/me")
                ]);

                setContent(contentRes.data);
                currentContentId = contentRes.data._id;

                const userData = userRes.data;
                const existsInWatchlist = userData.watchlist.find(item => item.itemId === currentContentId);
                setAdded(!!existsInWatchlist);
                setFavoriteMovies(userData.favoriteMovies || []);
                setFavoriteSeries(userData.favoriteSeries || []);

                try {
                    const ratingRes = await API.get(`/ratings/me/${currentContentId}`);
                    setRating(ratingRes.data.value);
                } catch (ratingErr) {
                    if (ratingErr.response && ratingErr.response.status === 404) {
                        setRating(0);
                    } else { console.error("Puan çekilirken hata:", ratingErr); }
                }

            } catch (err) {
                console.error("İçerik/Kullanıcı verisi çekilirken hata:", err);
                setError("Content could not be loaded."); // Ana hata durumu
            } finally {
                 setLoading(false); // Ana yüklenmeyi bitir
            }
        };

        const fetchReviews = async () => {
            // YORUMLARI AYRI ÇEK
            setLoadingReviews(true);
             // currentContentId henüz setContent ile gelmemiş olabilir, doğrudan useParams kullan
            try {
                const reviewsRes = await API.get(`/reviews/content/${contentId}`);
                setReviews(reviewsRes.data);

                // Kullanıcının mevcut yorumunu bul (user context'ten kontrol et)
                const existingReview = reviewsRes.data.find(r => r.user?._id === user?._id);
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


    // --- MEVCUT FONKSİYONLARIN (Dokunulmadı) ---
    const handleRatingChange = async (newValue) => {
        const currentContentId = content._id;
        const contentType = content.type || type;
        const oldValue = rating;
        setRating(newValue);
        setIsRatingLoading(true);
        try {
            await API.post("/ratings", { contentId: currentContentId, contentType: contentType, value: newValue });
            toast.success("Rating saved!");
        } catch (err) { console.error("Puan kaydetme hatası:", err); toast.error("Couldn't save rating."); setRating(oldValue); }
        finally { setIsRatingLoading(false); }
    };
    const handleAddToList = async () => {
        const contentType = content.type || (type === 'movie' ? 'movie' : 'series');
        try {
            await API.post("/users/me/watchlist", { id: content._id, type: contentType });
            setAdded(true); toast.success("Added to your list");
        } catch (error) { console.error(error.response?.data?.message || error.message); toast.error(error.response?.data?.message || "An error occurred"); }
    };
    const handleRemoveFromList = async () => {
        try {
            await API.delete(`/users/me/watchlist/${content._id}`);
            setAdded(false); toast.success("Removed from your list");
        } catch (err) { console.error(err.response?.data?.message || err.message); toast.error(error.response?.data?.message || "An error occurred"); }
    };
    const handleOpenFavModal = async () => { if (!added) { await handleAddToList(); } setIsFavModalOpen(true); };
    const handleSaveFavorites = (updatedList) => { if (type === 'movie') { setFavoriteMovies(updatedList); } else { setFavoriteSeries(updatedList); } toast.success("Favorites saved!"); setIsFavModalOpen(false); };
    // --- BİTİŞ: MEVCUT FONKSİYONLAR ---


    // --- YENİ: YORUM KAYDETME FONKSİYONU (Öncekiyle aynı) ---
    const handleSaveReview = async () => {
        if (!reviewText.trim()) { return toast.error("Review cannot be empty."); }
        setIsSavingReview(true);
        try {
            const response = await API.post('/reviews', { contentId: content._id, contentType: type, text: reviewText.trim() });
            const savedReview = response.data;
            setReviews(prevReviews => { const otherReviews = prevReviews.filter(r => r.user?._id !== user?._id); return [savedReview, ...otherReviews]; });
            setShowReviewInput(false); setUserHasReviewed(true); toast.success(userHasReviewed ? "Review updated!" : "Review added!");
        } catch (err) { console.error("Yorum kaydedilirken hata:", err); toast.error("Error: Could not save review."); }
        finally { setIsSavingReview(false); }
    };
    // --- BİTİŞ ---


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
        <div className="min-h-screen bg-base-200"> {/* Ana div */}

            {/* Hero Bölümü (Değişiklik yok) */}
            <div className="hero min-h-[70vh]" style={{ backgroundImage: `url(${backdropUrl})` }}>
                {/* ... (Senin mevcut Hero içeriğin) ... */}
                <div className="hero-overlay bg-opacity-80 bg-base-300"></div>
                <div className="hero-content flex-col lg:flex-row text-neutral-content animate-fade-in">
                    <img src={posterUrl} className="max-w-xs md:max-w-sm rounded-lg shadow-2xl" alt={title} />
                    <div className="lg:ml-8 mt-4 lg:mt-0">
                        <h1 className="text-4xl md:text-5xl font-bold">{title}</h1>
                        <p className="py-2 text-lg">{releaseDate}</p>
                         {type === 'series' && content.number_of_seasons && (
                             <div className="badge badge-secondary mr-2">
                                 {content.number_of_seasons} Sezon
                             </div>
                         )}
                        <p className="py-6">{content.overview}</p>

                        {/* Yıldız Puanlama */}
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold mb-2">Your Rating</h3>
                            <StarRating rating={rating} onRatingChange={handleRatingChange} />
                            {isRatingLoading && <span className="text-xs italic ml-1 opacity-70"> Saving rating...</span>}
                        </div>

                        {/* Buton Grubu */}
                        <div className="flex flex-wrap gap-4 items-start">
                             {/* Watchlist Butonu */}
                             {added ? (
                                 <div className="flex flex-col gap-2">
                                     <button className="btn btn-success" disabled>✓ Added to List</button>
                                     <button className="btn btn-error btn-sm" onClick={handleRemoveFromList}>Remove</button>
                                 </div>
                             ) : (
                                 <div className="flex flex-col">
                                     <button className="btn btn-primary" onClick={handleAddToList} disabled={!isRated} > Add to List </button>
                                     {!isRated && <p className="text-sm italic opacity-70 mt-2">(Rate first to add)</p>}
                                 </div>
                             )}
                             {/* Favorites Butonu */}
                             <div className="flex flex-col">
                                 <button className={`btn ${isFavorite ? 'btn-warning' : 'btn-outline'}`} onClick={handleOpenFavModal} disabled={!isRated} > {isFavorite ? '★ Manage Favorites' : 'Add to Favorites'} </button>
                                 {!isRated && <p className="text-sm italic opacity-70 mt-2">(Rate first to favorite)</p>}
                             </div>
                        </div>
                    </div>
                </div>
            </div> {/* Hero bitti */}


            {/* --- YENİ: Yorumlar Bölümü (Hero'nun altına eklendi) --- */}
            <div className="max-w-4xl mx-auto p-4 md:p-8"> {/* Sayfaya padding */}
                <section>
                    <h2 className="text-2xl font-bold mb-4">Reviews</h2>

                    {/* Yorum Ekleme Kutusu */}
                    {user ? (
                        <div className="mb-6 p-4 bg-base-100 rounded-lg shadow">
                            {!showReviewInput ? (
                                <button className="btn btn-primary btn-sm" onClick={() => setShowReviewInput(true)} >
                                    {userHasReviewed ? "Edit Your Review" : "Add Your Review"}
                                </button>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <textarea className="textarea textarea-bordered w-full" rows="4" value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Write your review here..." ></textarea>
                                    <div className="flex justify-end gap-2">
                                        <button className="btn btn-sm btn-ghost" onClick={() => { setShowReviewInput(false); const existingReview = reviews.find(r => r.user?._id === user?._id); setReviewText(existingReview ? existingReview.text : ""); }} disabled={isSavingReview} > Cancel </button>
                                        <button className={`btn btn-sm btn-primary ${isSavingReview ? 'loading' : ''}`} onClick={handleSaveReview} disabled={isSavingReview} > {userHasReviewed ? "Update Review" : "Save Review"} </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="mb-6 text-center text-base-content/70">You need to be logged in to add a review.</p>
                    )}

                    {/* Mevcut Yorumları Listeleme */}
                    {loadingReviews ? ( // Yorumlar yüklenirken göster
                         <div className="flex justify-center"><span className="loading loading-dots loading-md"></span></div>
                    ) : reviews.length > 0 ? (
                        <div className="space-y-4">
                            {reviews.map((review) => (
                                <div key={review._id} className="p-4 bg-base-100 rounded-lg shadow">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold">{review.user?.username || "Unknown User"}</span>
                                        <span className="text-xs text-base-content/60">
                                            {review.createdAt ? formatDistanceToNow(new Date(review.createdAt), { addSuffix: true }) : ""}
                                        </span>
                                    </div>
                                    <p className="whitespace-pre-wrap break-words text-base-content/90">{review.text}</p>
                                    {/* Silme butonu eklenebilir */}
                                </div>
                            ))}
                        </div>
                    ) : (
                       <p className="text-center text-base-content/70">No reviews yet. Be the first!</p>
                    )}
                     {/* Genel bir hata varsa ve içerik yüklendiyse ama yorumlar yüklenemediyse? */}
                     {error && !loading && !loadingReviews && reviews.length === 0 && <p className="text-center text-error">{error}</p>}
                </section>
            </div>
            {/* --- BİTİŞ: Yorumlar Bölümü --- */}


            {/* Favori Modal (Değişiklik yok) */}
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