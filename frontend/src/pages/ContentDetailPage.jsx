import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import API from '../api/axios'; // Merkezi API yapılandırmamız

// Yükleniyor... animasyonu için basit bir component
const LoadingSpinner = () => (
    <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-primary"></span>
    </div>
);

export default function ContentDetailPage() {
    // 1. URL'den :type ve :id parametrelerini alıyoruz
    const { type, contentId } = useParams();

    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchContent = async () => {
            try {
                setLoading(true);
                // 2. Gelen 'type' bilgisine göre doğru API endpoint'ini oluşturuyoruz
                // örn: /movies/:id veya /series/:id
                // 'type' movie ise 'movies', değilse (series ise) 'series' endpoint'ini kullan
                const endpoint = type === 'movie' ? `/movies/${contentId}` : `/series/${contentId}`;
                const res = await API.get(endpoint);
                setContent(res.data);
            } catch (err) {
                setError("Content not found.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchContent();
    }, [contentId, type]); // id veya type değiştiğinde yeniden veri çek

    if (loading) return <LoadingSpinner />;
    if (error) return <div className="alert alert-error m-4">{error}</div>;
    if (!content) return null;

    // 3. Veriyi Göster: Koşullu render'lama ile film/dizi farklarını yönetiyoruz
    const title = content.title || content.name;
    const releaseDate = content.release_date || content.first_air_date;
    const posterUrl = `https://image.tmdb.org/t/p/w500${content.poster_path}`;
    const backdropUrl = content.backdrop_path ? `https://image.tmdb.org/t/p/w1280${content.backdrop_path}` : '';

    return (
        // Arkaplan resmi olarak filmin/dizinin kendi görselini kullanıyoruz
        <div className="hero min-h-screen bg-base-200" style={{ backgroundImage: `url(${backdropUrl})` }}>
            <div className="hero-overlay bg-opacity-80 bg-base-300"></div>
            <div className="hero-content flex-col lg:flex-row text-neutral-content animate-fade-in">
                <img src={posterUrl} className="max-w-xs md:max-w-sm rounded-lg shadow-2xl" alt={title} />
                <div className="lg:ml-8 mt-4 lg:mt-0">
                    <h1 className="text-4xl md:text-5xl font-bold">{title}</h1>
                    <p className="py-2 text-lg">{releaseDate}</p>

                    {/* Sadece diziler için gösterilecek ekstra bilgi */}
                    {type === 'series' && content.number_of_seasons && (
                        <div className="badge badge-secondary mr-2">
                            {content.number_of_seasons} Sezon
                        </div>
                    )}

                    <p className="py-6">{content.overview}</p>

                    {/* TODO: Puanlama ve listeye ekleme butonları */}
                    <button className="btn btn-primary">Add to list</button>
                </div>
            </div>
        </div>
    );
}

