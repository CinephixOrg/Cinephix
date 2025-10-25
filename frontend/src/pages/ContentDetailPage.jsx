// frontend/pages/ContentDetailPage.jsx (GÜNCELLENMİŞ TAM DOSYA)

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import API from '../api/axios'; 
import toast from 'react-hot-toast';

// --- YENİ İMPORT ---
import StarRating from '../components/StarRating';

const LoadingSpinner = () => (
    <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-primary"></span>
    </div>
);

export default function ContentDetailPage() {
    const { type, contentId } = useParams();

    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [userWatchlist, setUserWatchlist] = useState([]);
    const [added, setAdded] = useState(false); // Listede mi?

    // --- YENİ STATE'LER ---
    const [rating, setRating] = useState(0); // 0 = Puanlanmamış
    const [isRatingLoading, setIsRatingLoading] = useState(false); // Puan kaydı yükleniyor mu?

    // 1️⃣ Sayfa açılınca içerik, watchlist VE PUAN BİLGİSİNİ çek
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                // 1. Content çek
                const endpoint = type === 'movie' ? `/movies/${contentId}` : `/series/${contentId}`;
                const contentRes = await API.get(endpoint);
                const currentContentId = contentRes.data._id;
                setContent(contentRes.data);

                // 2. Kullanıcı verisi ve watchlist
                const userRes = await API.get("/users/me");
                setUserWatchlist(userRes.data.watchlist);

                // 3. İçerik watchlist'te var mı kontrol et
                const exists = userRes.data.watchlist.find(
                    item => item.itemId === currentContentId
                );
                setAdded(!!exists);

                // 4. --- YENİ KISIM: KULLANICININ MEVCUT PUANINI ÇEK ---
                try {
                    const ratingRes = await API.get(`/ratings/me/${currentContentId}`);
                    // Puanı varsa, state'i güncelle
                    setRating(ratingRes.data.value); 
                } catch (ratingErr) {
                    if (ratingErr.response && ratingErr.response.status === 404) {
                        setRating(0); // Puan vermemiş (hata değil)
                    } else {
                        console.error("Puan çekilirken hata:", ratingErr);
                    }
                }
                // --- BİTİŞ ---

            } catch (err) {
                console.error(err);
                setError("İçerik yüklenemedi.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [contentId, type]);

    // --- YENİ FONKSİYON: Puan verildiğinde tetiklenir ---
    const handleRatingChange = async (newValue) => {
        const currentContentId = content._id;
        const contentType = content.type || type;
        const oldValue = rating; // Hata olursa geri almak için

        // 1. UI'ı anında güncelle
        setRating(newValue);
        setIsRatingLoading(true); // "Kaydediliyor..." göstergesi için (isteğe bağlı)

        try {
            // 2. Backend'e puanı kaydet (yeni /ratings API'mizi kullan)
            await API.post("/ratings", {
                contentId: currentContentId,
                contentType: contentType,
                value: newValue
            });
            toast.success("Rating saved!");
        } catch (err) {
            console.error("Puan kaydetme hatası:", err);
            toast.error("Couldn't save rating.");
            // 3. Hata olursa eski puana geri dön
            setRating(oldValue);
        } finally {
            setIsRatingLoading(false);
        }
    };
    
    // (handleAddToList ve handleRemoveFromList fonksiyonları DEĞİŞMEDİ)
    const handleAddToList = async () => {
        const contentType = content.type || (type === 'movie' ? 'movie' : 'series');
        try {
            const response = await API.post("/users/me/watchlist", {
                id: content._id,
                type: contentType
            });
            setAdded(true);
            setUserWatchlist(response.data); 
            toast.success("Added to your list", { /* ... stiller ... */ });
        } catch (error) {
            console.error(error.response?.data?.message || error.message);
            toast.error(error.response?.data?.message || "An error occurred", { /* ... stiller ... */ });
        }
    };

    const handleRemoveFromList = async () => {
        try {
            await API.delete(`/users/me/watchlist/${content._id}`);
            setAdded(false);
            toast.success("Removed from your list", { /* ... stiller ... */ });
        } catch (err) {
            console.error(err.response?.data?.message || err.message);
            toast.error(error.response?.data?.message || "An error occurred", { /* ... stiller ... */ });
        }
    };


    if (loading) return <LoadingSpinner />;
    if (error) return <div className="alert alert-error m-4">{error}</div>;
    if (!content) return null;

    const title = content.title || content.name;
    const releaseDate = content.release_date || content.first_air_date;
    const posterUrl = `https://image.tmdb.org/t/p/w500${content.poster_path}`;
    const backdropUrl = content.backdrop_path ? `https://image.tmdb.org/t/p/w1280${content.backdrop_path}` : '';
    
    // --- YENİ MANTIK: Puanlanmış mı? ---
    const isRated = rating > 0;

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

                    {/* --- YENİ KISIM: YILDIZ PUANLAMA --- */}
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
                    {/* --- BİTİŞ --- */}


                    {/* --- GÜNCELLENMİŞ BUTON MANTIĞI --- */}
                    {added ? (
                        // Eğer listedeyse, Puanlamadan bağımsız olarak kaldırabilir
                        <div className="flex gap-2">
                            <button className="btn btn-success" disabled>
                                ✓ Added to List
                            </button>
                            <button className="btn btn-error" onClick={handleRemoveFromList}>
                                Remove from List
                            </button>
                        </div>
                    ) : (
                        // Eğer listede DEĞİLSE
                        <div>
                            <button 
                                className="btn btn-primary" 
                                onClick={handleAddToList}
                                // Mantık: Puanlanmadıysa (isRated=false) butonu kilitle
                                disabled={!isRated} 
                            >
                                Add to List
                            </button>
                            
                            {/* Puanlanmadıysa kullanıcıyı uyar */}
                            {!isRated && (
                                <p className="text-sm italic opacity-70 mt-2">
                                    You must rate this {type} to add it to your list.
                                </p>
                            )}
                        </div>
                    )}
                    {/* --- BİTİŞ --- */}

                </div>
            </div>
        </div>
    );
}