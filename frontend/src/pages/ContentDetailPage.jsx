// frontend/pages/ContentDetailPage.jsx (GÜNCELLENMİŞ TAM DOSYA)

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import API from '../api/axios'; 
import toast from 'react-hot-toast';

import StarRating from '../components/StarRating';
import FavoritesModal from '../components/FavoritesModal';

// --- HATA BURADAYDI, DÜZELTİLDİ ---
// Yükleniyor... animasyonu için basit bir component
const LoadingSpinner = () => (
    <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-primary"></span>
    </div>
);
// --- BİTİŞ ---

export default function ContentDetailPage() {
    const { type, contentId } = useParams();
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [added, setAdded] = useState(false); // Watchlist'te mi?
    const [rating, setRating] = useState(0); 
    const [isRatingLoading, setIsRatingLoading] = useState(false);

    // --- YENİ STATE'LER ---
    const [isFavModalOpen, setIsFavModalOpen] = useState(false);
    const [favoriteMovies, setFavoriteMovies] = useState([]);
    const [favoriteSeries, setFavoriteSeries] = useState([]);
    
    // 1. Veri Çekme (useEffect)
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const endpoint = type === 'movie' ? `/movies/${contentId}` : `/series/${contentId}`;
                const contentRes = await API.get(endpoint);
                const currentContentId = contentRes.data._id;
                setContent(contentRes.data);

                // GÜNCELLEME: /users/me rotası artık favorileri de getiriyor
                const userRes = await API.get("/users/me");
                const userData = userRes.data;
                
                // Watchlist'i ayarla
                const existsInWatchlist = userData.watchlist.find(
                    item => item.itemId === currentContentId
                );
                setAdded(!!existsInWatchlist);

                // --- YENİ: Favori listelerini ayarla ---
                setFavoriteMovies(userData.favoriteMovies || []);
                setFavoriteSeries(userData.favoriteSeries || []);

                // Mevcut Puanı Çek (Bu kod aynı kalır)
                try {
                    const ratingRes = await API.get(`/ratings/me/${currentContentId}`);
                    setRating(ratingRes.data.value); 
                } catch (ratingErr) {
                    if (ratingErr.response && ratingErr.response.status === 404) {
                        setRating(0); 
                    } else { console.error("Puan çekilirken hata:", ratingErr); }
                }

            } catch (err) {
                console.error(err);
                setError("İçerik yüklenemedi.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [contentId, type]);

    // Puanlama Fonksiyonu (Değişiklik yok)
    const handleRatingChange = async (newValue) => {
        const currentContentId = content._id;
        const contentType = content.type || type;
        const oldValue = rating; 

        setRating(newValue);
        setIsRatingLoading(true);

        try {
            await API.post("/ratings", {
                contentId: currentContentId,
                contentType: contentType,
                value: newValue
            });
            toast.success("Rating saved!");
        } catch (err) {
            console.error("Puan kaydetme hatası:", err);
            toast.error("Couldn't save rating.");
            setRating(oldValue);
        } finally {
            setIsRatingLoading(false);
        }
    };
    
    // Watchlist'e Ekleme (Değişiklik yok)
    const handleAddToList = async () => {
        const contentType = content.type || (type === 'movie' ? 'movie' : 'series');
        try {
            const response = await API.post("/users/me/watchlist", {
                id: content._id,
                type: contentType
            });
            setAdded(true);
            toast.success("Added to your list");
        } catch (error) {
            console.error(error.response?.data?.message || error.message);
            toast.error(error.response?.data?.message || "An error occurred");
        }
    };

    // Watchlist'ten Çıkarma (Değişiklik yok)
    const handleRemoveFromList = async () => {
        try {
            await API.delete(`/users/me/watchlist/${content._id}`);
            setAdded(false);
            toast.success("Removed from your list");
        } catch (err) {
            console.error(err.response?.data?.message || err.message);
            toast.error(error.response?.data?.message || "An error occurred");
        }
    };


    // --- YENİ FONKSİYONLAR ---

    // "Add to Favorites" butonuna basıldığında
    const handleOpenFavModal = async () => {
        // Kural 3: Favoriye eklerken, watchlist'te değilse, otomatik ekle
        if (!added) {
            // "Add to List" butonuna basılmış gibi davran
            // Not: handleAddToList zaten setAdded(true) yapıyor
            await handleAddToList(); 
        }
        setIsFavModalOpen(true); // Modalı aç
    };

    // Modal'daki "Save" butonuna basıldığında
    const handleSaveFavorites = (updatedList) => {
        // Modal'dan gelen güncel listeyi state'e kaydet
        if (type === 'movie') {
            setFavoriteMovies(updatedList);
        } else {
            setFavoriteSeries(updatedList);
        }
        toast.success("Favorites saved!");
        setIsFavModalOpen(false); // Modalı kapat
    };

    // --- BİTİŞ ---


    if (loading) return <LoadingSpinner />;
    if (error) return <div className="alert alert-error m-4">{error}</div>;
    if (!content) return null;

    const title = content.title || content.name;
    const releaseDate = content.release_date || content.first_air_date;
    const posterUrl = `https://image.tmdb.org/t/p/w500${content.poster_path}`;
    const backdropUrl = content.backdrop_path ? `https://image.tmdb.org/t/p/w1280${content.backdrop_path}` : '';
    
    const isRated = rating > 0;
    
// --- YENİ KONTROL: Mevcut favori listesinde mi? ---
    const currentFavList = type === 'movie' ? favoriteMovies : favoriteSeries;
    
    // DEĞİŞİKLİK: .find(item => item._id === ...) yerine .includes(...)
    const isFavorite = currentFavList.includes(content._id);


    return (
        <div className="hero min-h-screen bg-base-200" style={{ backgroundImage: `url(${backdropUrl})` }}>
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

                    {/* Yıldız Puanlama (Değişiklik yok) */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold mb-2">Your Rating</h3>
                        <StarRating 
                            rating={rating} 
                            onRatingChange={handleRatingChange} 
                        />
                        {isRatingLoading && (
                            <span className="text-xs italic ml-1 opacity-70">
                                Saving rating...
                            </span>
                        )}
                    </div>
                    
                    {/* --- GÜNCELLENMİŞ BUTON GRUBU --- */}
                    <div className="flex flex-wrap gap-4 items-start">
                        {/* 1. Watchlist Butonu */}
                        {added ? (
                            <div className="flex flex-col gap-2">
                                <button className="btn btn-success" disabled>
                                    ✓ Added to List
                                </button>
                                <button className="btn btn-error btn-sm" onClick={handleRemoveFromList}>
                                    Remove
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                <button 
                                    className="btn btn-primary" 
                                    onClick={handleAddToList}
                                    disabled={!isRated} // Kural: Puanlanmadıysa kilitli
                                >
                                    Add to List
                                </button>
                                {!isRated && (
                                    <p className="text-sm italic opacity-70 mt-2">
                                        (Rate first to add)
                                    </p>
                                )}
                            </div>
                        )}

                        {/* 2. Favorites Butonu */}
                        <div className="flex flex-col">
                            <button 
                                className={`btn ${isFavorite ? 'btn-warning' : 'btn-outline'}`}
                                onClick={handleOpenFavModal}
                                disabled={!isRated} // Kural: Puanlanmadıysa kilitli
                            >
                                {isFavorite ? '★ Manage Favorites' : 'Add to Favorites'}
                            </button>
                            {!isRated && (
                                <p className="text-sm italic opacity-70 mt-2">
                                    (Rate first to favorite)
                                </p>
                            )}
                        </div>
                    </div>
                    {/* --- BİTİŞ --- */}

                </div>
            </div>
            
            {/* --- YENİ MODAL RENDER --- */}
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