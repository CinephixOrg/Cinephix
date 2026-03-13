import React, { useEffect, useState } from "react";
import { userService } from "../api/userService";
import { contentService } from "../api/contentService";
import { getCacheItem, CACHE_KEYS } from "../api/cacheService";
import MovieCard from "../components/MovieCard";
import SeriesCard from "../components/SeriesCard";
import { toast } from "react-hot-toast";

export default function ListPage() {
    const [movies, setMovies] = useState([]);
    const [series, setSeries] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchWatchlist = async () => {
            try {
                const user = await userService.getCurrentUser();
                const watchlist = user.watchlist || user.data?.watchlist;

                // Get cached items first for immediate display
                const movieItemsIds = watchlist
                    .filter(item => item.itemType === "movie")
                    .map(item => item.itemId);
                
                const seriesItemsIds = watchlist
                    .filter(item => item.itemType === "series")
                    .map(item => item.itemId);

                // Check cache and get cached items immediately
                const cachedMovies = movieItemsIds
                    .map(id => getCacheItem(CACHE_KEYS.MOVIE(id)))
                    .filter(Boolean);
                
                const cachedSeries = seriesItemsIds
                    .map(id => getCacheItem(CACHE_KEYS.SERIES(id)))
                    .filter(Boolean);

                // If we have any cached items, show them immediately
                if (cachedMovies.length > 0 || cachedSeries.length > 0) {
                    setMovies(cachedMovies);
                    setSeries(cachedSeries);
                    setLoading(false);
                } else {
                    // No cached data, show loading
                    setLoading(true);
                }

                // Always fetch fresh content data in background
                const movieData = await Promise.all(
                    movieItemsIds
                        .map(itemId => contentService.getMovieById(itemId).then(r => r.data || r))
                );

                const seriesData = await Promise.all(
                    seriesItemsIds
                        .map(itemId => contentService.getSeriesById(itemId).then(r => r.data || r))
                );

                setMovies(movieData);
                setSeries(seriesData);
                setLoading(false);
            } catch (err) {
                console.error(err);
                toast.error("Failed to load watchlist");
                setLoading(false);
            }
        };

        fetchWatchlist();
    }, []);

    if (loading) return <div>Loading...</div>;

    return (
        <div className="p-4">
            <h2 className="text-2xl font-bold mb-2">Movies</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {movies.length
                    ? movies.map(m => (
                        <MovieCard
                            key={m._id || m.id}
                            movie={m}
                            showRemove
                            onRemove={async () => {
                                try {
                                    await userService.removeFromWatchlist(m._id);
                                    setMovies(prev => prev.filter(x => x._id !== m._id));
                                    toast.success("Removed from watchlist");
                                } catch (err) {
                                    toast.error("Failed to remove from watchlist");
                                }
                            }}
                        />
                    ))
                    : <p>No movies added yet.</p>}
            </div>

            <h2 className="text-2xl font-bold mb-2">Series</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {series.length
                    ? series.map(s => <SeriesCard
                        key={s._id}
                        series={s}
                        showRemove
                        onRemove={async () => {
                            try {
                                await userService.removeFromWatchlist(s._id);
                                setSeries(prev => prev.filter(x => x._id !== s._id));
                                toast.success("Removed from watchlist");
                            } catch (err) {
                                console.error(err.response?.data?.message || err.message);
                                toast.error(err.response?.data?.message || "An error occurred!");
                            }
                        }}
                    />)
                    : <p>No series added yet.</p>}
            </div>
        </div>
    );
}
