import React, { useEffect, useState } from "react";
import API from "../api/axios";
import MovieCard from "../components/MovieCard";
import SeriesCard from "../components/SeriesCard";

export default function ListPage() {
    const [movies, setMovies] = useState([]);
    const [series, setSeries] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchWatchlist = async () => {
            try {
                setLoading(true);
                const res = await API.get("/users/me"); // watchlist al
                const watchlist = res.data.watchlist;

                // Movies
                const movieData = await Promise.all(
                    watchlist
                        .filter(item => item.itemType === "movie")
                        .map(item => API.get(`/movies/${item.itemId}`).then(r => r.data))
                );

                // Series
                const seriesData = await Promise.all(
                    watchlist
                        .filter(item => item.itemType === "series")
                        .map(item => API.get(`/series/${item.itemId}`).then(r => r.data))
                );

                setMovies(movieData);
                setSeries(seriesData);
            } catch (err) {
                console.error(err);
            } finally {
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
                                await API.delete(`/users/me/watchlist/${m._id}`);
                                setMovies(prev => prev.filter(x => x._id !== m._id));
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
                                await API.delete(`/users/me/watchlist/${s._id}`);
                                setSeries(prev => prev.filter(x => x._id !== s._id));
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
