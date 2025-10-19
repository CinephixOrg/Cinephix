import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import API from '../api/axios'; // Merkezi API yapılandırmamız
import toast from 'react-hot-toast';

// Yükleniyor... animasyonu için basit bir component
const LoadingSpinner = () => (
    <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-primary"></span>
    </div>
);

export default function ContentDetailPage() {
    // URL'den :type ve :contentId parametrelerini alıyoruz
    const { type, contentId } = useParams();

    // 🔹 useState düzeltildi
    const [added, setAdded] = useState(false);
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [userWatchlist, setUserWatchlist] = useState([]);

    const handleAddToList = async () => {
        const contentType = content.type || (type === 'movie' ? 'movie' : 'series');
        try {
            const response = await API.post("/users/me/watchlist", {
                id: content._id,
                type: contentType
            });

            setAdded(true);
            setUserWatchlist(response.data); // güncel watchlist'i sakla
            toast.success("Added to your list", {
                style: { background: "#1a1a1a", color: "#fff", border: "1px solid #333" },
                iconTheme: { primary: "#22c55e", secondary: "#1a1a1a" },
            });
        } catch (error) {
            console.error(error.response?.data?.message || error.message);
            toast.error(error.response?.data?.message || "An error occurred", {
                style: { background: "#1a1a1a", color: "#fff", border: "1px solid #333" },
                iconTheme: { primary: "#b61616ff", secondary: "#1a1a1a" },
            });
        }
    };

    const handleRemoveFromList = async () => {
        try {
            await API.delete(`/users/me/watchlist/${content._id}`);
            setAdded(false);
            toast.success("Removed from your list", {
                style: { background: "#1a1a1a", color: "#fff", border: "1px solid #333" },
                iconTheme: { primary: "#22c55e", secondary: "#1a1a1a" },
            });
        } catch (err) {
            console.error(err.response?.data?.message || err.message);
            toast.error(error.response?.data?.message || "An error occurred", {
                style: { background: "#1a1a1a", color: "#fff", border: "1px solid #333" },
                iconTheme: { primary: "#b61616ff", secondary: "#1a1a1a" },
            });
        }
    };


    // 1️⃣ Sayfa açılınca içerik ve kullanıcı watchlistini çek
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                // Content çek
                const endpoint = type === 'movie' ? `/movies/${contentId}` : `/series/${contentId}`;
                const contentRes = await API.get(endpoint);
                setContent(contentRes.data);

                // Kullanıcı verisi ve watchlist
                const userRes = await API.get("/users/me"); // token ile auth gerekli
                setUserWatchlist(userRes.data.watchlist);

                // 2️⃣ Eğer içerik watchlist'te varsa added = true
                const exists = userRes.data.watchlist.find(
                    item => item.itemId === contentRes.data._id
                );
                setAdded(!!exists);

            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [contentId, type]);

    if (loading) return <LoadingSpinner />;
    if (error) return <div className="alert alert-error m-4">{error}</div>;
    if (!content) return null;

    const title = content.title || content.name;
    const releaseDate = content.release_date || content.first_air_date;
    const posterUrl = `https://image.tmdb.org/t/p/w500${content.poster_path}`;
    const backdropUrl = content.backdrop_path ? `https://image.tmdb.org/t/p/w1280${content.backdrop_path}` : '';

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

                    {added ? (
                        <div className="flex gap-2">
                            <button className="btn btn-success" disabled>
                                Added
                            </button>
                            <button className="btn btn-error" onClick={handleRemoveFromList}>
                                Remove from List
                            </button>
                        </div>
                    ) : (
                        <button className="btn btn-primary" onClick={handleAddToList}>
                            Add to List
                        </button>
                    )}

                </div>
            </div>
        </div>
    );
}
