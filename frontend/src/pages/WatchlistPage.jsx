import React, { useEffect, useState } from "react";
import { userService } from "../api/userService";
import { contentService } from "../api/contentService";
import { getCacheItem, CACHE_KEYS } from "../api/cacheService";
import MovieCard from "../components/MovieCard";
import SeriesCard from "../components/SeriesCard";
import { toast } from "react-hot-toast";

export default function WatchlistPage() {
    const [movies, setMovies] = useState([]);
    const [series, setSeries] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchToWatchList = async () => {
            try {
                const data = await userService.getToWatchList();
                const list = data.toWatchList || [];

                const movieIds = list
                    .filter((item) => item.itemType === "movie")
                    .map((item) => item.itemId);

                const seriesIds = list
                    .filter((item) => item.itemType === "series")
                    .map((item) => item.itemId);

                const cachedMovies = movieIds
                    .map((id) => getCacheItem(CACHE_KEYS.MOVIE(id)))
                    .filter(Boolean);

                const cachedSeries = seriesIds
                    .map((id) => getCacheItem(CACHE_KEYS.SERIES(id)))
                    .filter(Boolean);

                if (cachedMovies.length > 0 || cachedSeries.length > 0) {
                    setMovies(cachedMovies);
                    setSeries(cachedSeries);
                    setLoading(false);
                } else {
                    setLoading(true);
                }

                const movieResults = await Promise.allSettled(
                    movieIds.map((id) => contentService.getMovieById(id).then((r) => r.data || r))
                );
                const seriesResults = await Promise.allSettled(
                    seriesIds.map((id) => contentService.getSeriesById(id).then((r) => r.data || r))
                );

                setMovies(movieResults.filter((r) => r.status === "fulfilled").map((r) => r.value));
                setSeries(seriesResults.filter((r) => r.status === "fulfilled").map((r) => r.value));
                setLoading(false);
            } catch (err) {
                console.error(err);
                toast.error("Failed to load watchlist");
                setLoading(false);
            }
        };

        fetchToWatchList();
    }, []);

    const handleRemoveMovie = async (movie) => {
        try {
            await userService.removeFromToWatchList(movie._id, "movie");
            setMovies((prev) => prev.filter((m) => m._id !== movie._id));
            toast.success("Removed from watchlist");
        } catch (err) {
            toast.error("Failed to remove from watchlist");
        }
    };

    const handleRemoveSeries = async (s) => {
        try {
            await userService.removeFromToWatchList(s._id, "series");
            setSeries((prev) => prev.filter((x) => x._id !== s._id));
            toast.success("Removed from watchlist");
        } catch (err) {
            toast.error("Failed to remove from watchlist");
        }
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="max-w-6xl mx-auto px-6 py-8">
            <h1 className="text-3xl font-bold mb-6">My Watchlist</h1>
            <p className="text-base-content/60 mb-8">Movies and series you plan to watch.</p>

            <section className="mb-10">
                <h2 className="text-xl font-semibold mb-4">Movies</h2>
                {movies.length ? (
                    <div className="grid grid-cols-6 md:grid-cols-5 lg:grid-cols-8 gap-2 justify-items-center">
                        {movies.map((m) => (
                            <MovieCard
                                key={m._id || m.id}
                                movie={m}
                                showRemove
                                onRemove={() => handleRemoveMovie(m)}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-base-content/50">No movies added yet.</p>
                )}
            </section>

            <section>
                <h2 className="text-xl font-semibold mb-4">Series</h2>
                {series.length ? (
                    <div className="grid grid-cols-6 md:grid-cols-5 lg:grid-cols-8 gap-2 justify-items-center">
                        {series.map((s) => (
                            <SeriesCard
                                key={s._id}
                                series={s}
                                showRemove
                                onRemove={() => handleRemoveSeries(s)}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-base-content/50">No series added yet.</p>
                )}
            </section>
        </div>
    );
}
