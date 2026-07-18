import React, { useEffect, useState, useRef, useMemo, useContext } from "react";
import { useSearchParams } from "react-router-dom";
import { userService } from "../api/userService";
import { contentService } from "../api/contentService";
import { getCacheItem, CACHE_KEYS } from "../api/cacheService";
import MovieCard from "../components/MovieCard";
import SeriesCard from "../components/SeriesCard";
import { toast } from "react-hot-toast";
import { RatingsContext } from "../context/RatingsContext.jsx";

const ITEMS_PER_PAGE = 30;

export default function WatchlistPage() {
    const [movies, setMovies] = useState([]);
    const [series, setSeries] = useState([]);
    const [watchlist, setWatchlist] = useState([]);
    const [loading, setLoading] = useState(true);

    const [searchParams, setSearchParams] = useSearchParams();

    // Read values dynamically from URL search parameters with alphabetical defaults
    const moviePage = parseInt(searchParams.get("moviePage") || "1", 10);
    const seriesPage = parseInt(searchParams.get("seriesPage") || "1", 10);
    const movieSortOrder = searchParams.get("movieSort") || "alphabetical";
    const seriesSortOrder = searchParams.get("seriesSort") || "alphabetical";

    const setMoviePage = (p) => {
        const newParams = new URLSearchParams(searchParams);
        newParams.set("moviePage", p.toString());
        setSearchParams(newParams, { replace: true });
    };

    const setSeriesPage = (p) => {
        const newParams = new URLSearchParams(searchParams);
        newParams.set("seriesPage", p.toString());
        setSearchParams(newParams, { replace: true });
    };

    const setMovieSortOrder = (sort) => {
        const newParams = new URLSearchParams(searchParams);
        newParams.set("movieSort", sort);
        newParams.set("moviePage", "1");
        setSearchParams(newParams, { replace: true });
    };

    const setSeriesSortOrder = (sort) => {
        const newParams = new URLSearchParams(searchParams);
        newParams.set("seriesSort", sort);
        newParams.set("seriesPage", "1");
        setSearchParams(newParams, { replace: true });
    };

    const moviesSectionRef = useRef(null);
    const seriesSectionRef = useRef(null);

    const { ratingsMap, loadingRatings } = useContext(RatingsContext) || { ratingsMap: new Map(), loadingRatings: false };

    useEffect(() => {
        const fetchToWatchList = async () => {
            try {
                const data = await userService.getToWatchList();
                const list = data.toWatchList || [];
                setWatchlist(list);
                console.log("WatchlistPage - User toWatchList fetched:", list);

                const movieIds = list
                    .filter((item) => item.itemType === "movie")
                    .map((item) => item.itemId);

                const seriesIds = list
                    .filter((item) => item.itemType === "series")
                    .map((item) => item.itemId);

                console.log("WatchlistPage - Movie IDs to fetch:", movieIds);
                console.log("WatchlistPage - Series IDs to fetch:", seriesIds);

                const cachedMovies = movieIds
                    .map((id) => getCacheItem(CACHE_KEYS.MOVIE(id)))
                    .filter(Boolean);

                const cachedSeries = seriesIds
                    .map((id) => getCacheItem(CACHE_KEYS.SERIES(id)))
                    .filter(Boolean);

                console.log("WatchlistPage - Cached movies:", cachedMovies);
                console.log("WatchlistPage - Cached series:", cachedSeries);

                if (cachedMovies.length > 0 || cachedSeries.length > 0) {
                    setMovies(cachedMovies);
                    setSeries(cachedSeries);
                    setLoading(false);
                } else {
                    setLoading(true);
                }

                const freshMovies = await contentService.getMoviesBulk(movieIds);
                const freshSeries = await contentService.getSeriesBulk(seriesIds);

                console.log("WatchlistPage - Fresh movies resolved:", freshMovies);
                console.log("WatchlistPage - Fresh series resolved:", freshSeries);

                setMovies(freshMovies);
                setSeries(freshSeries);
                setLoading(false);
            } catch (err) {
                console.error("WatchlistPage - Fetch error:", err);
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

    // Create stable addedAt lookup map
    const addedAtMap = useMemo(() => {
        const map = new Map();
        watchlist.forEach(item => {
            if (item && item.itemId) {
                map.set(item.itemId.toString(), new Date(item.addedAt).getTime());
            }
        });
        return map;
    }, [watchlist]);

    // Stabilized movies sorting pipeline — includes ratingsMap dependency
    const sortedMovies = useMemo(() => {
        const sorted = [...movies];
        sorted.sort((a, b) => {
            const idA = a._id?.toString();
            const idB = b._id?.toString();

            if (movieSortOrder === "newest") {
                const timeA = addedAtMap.get(idA) || 0;
                const timeB = addedAtMap.get(idB) || 0;
                return timeB - timeA;
            }
            if (movieSortOrder === "oldest") {
                const timeA = addedAtMap.get(idA) || 0;
                const timeB = addedAtMap.get(idB) || 0;
                return timeA - timeB;
            }
            if (movieSortOrder === "highest_rating") {
                const tvdbA = a.tvdb?.toString() || a.id?.tvdb?.toString();
                const tvdbB = b.tvdb?.toString() || b.id?.tvdb?.toString();
                const rA = ratingsMap.get(idA) || (tvdbA ? ratingsMap.get(tvdbA) : 0) || 0;
                const rB = ratingsMap.get(idB) || (tvdbB ? ratingsMap.get(tvdbB) : 0) || 0;
                if (rA === rB) {
                    const titleA = a.title || a.name || "";
                    const titleB = b.title || b.name || "";
                    return titleA.localeCompare(titleB);
                }
                return rB - rA;
            }
            if (movieSortOrder === "lowest_rating") {
                const tvdbA = a.tvdb?.toString() || a.id?.tvdb?.toString();
                const tvdbB = b.tvdb?.toString() || b.id?.tvdb?.toString();
                const rA = ratingsMap.get(idA) || (tvdbA ? ratingsMap.get(tvdbA) : 0) || 0;
                const rB = ratingsMap.get(idB) || (tvdbB ? ratingsMap.get(tvdbB) : 0) || 0;
                if (rA === rB) {
                    const titleA = a.title || a.name || "";
                    const titleB = b.title || b.name || "";
                    return titleA.localeCompare(titleB);
                }
                return rA - rB;
            }
            if (movieSortOrder === "alphabetical") {
                const titleA = a.title || a.name || "";
                const titleB = b.title || b.name || "";
                return titleA.localeCompare(titleB);
            }
            return 0;
        });
        return sorted;
    }, [movies, movieSortOrder, addedAtMap, ratingsMap]);

    // Stabilized series sorting pipeline — includes ratingsMap dependency
    const sortedSeries = useMemo(() => {
        const sorted = [...series];
        sorted.sort((a, b) => {
            const idA = a._id?.toString();
            const idB = b._id?.toString();

            if (seriesSortOrder === "newest") {
                const timeA = addedAtMap.get(idA) || 0;
                const timeB = addedAtMap.get(idB) || 0;
                return timeB - timeA;
            }
            if (seriesSortOrder === "oldest") {
                const timeA = addedAtMap.get(idA) || 0;
                const timeB = addedAtMap.get(idB) || 0;
                return timeA - timeB;
            }
            if (seriesSortOrder === "highest_rating") {
                const tvdbA = a.tvdb?.toString() || a.id?.tvdb?.toString();
                const tvdbB = b.tvdb?.toString() || b.id?.tvdb?.toString();
                const rA = ratingsMap.get(idA) || (tvdbA ? ratingsMap.get(tvdbA) : 0) || 0;
                const rB = ratingsMap.get(idB) || (tvdbB ? ratingsMap.get(tvdbB) : 0) || 0;
                if (rA === rB) {
                    const titleA = a.title || a.name || "";
                    const titleB = b.title || b.name || "";
                    return titleA.localeCompare(titleB);
                }
                return rB - rA;
            }
            if (seriesSortOrder === "lowest_rating") {
                const tvdbA = a.tvdb?.toString() || a.id?.tvdb?.toString();
                const tvdbB = b.tvdb?.toString() || b.id?.tvdb?.toString();
                const rA = ratingsMap.get(idA) || (tvdbA ? ratingsMap.get(tvdbA) : 0) || 0;
                const rB = ratingsMap.get(idB) || (tvdbB ? ratingsMap.get(tvdbB) : 0) || 0;
                if (rA === rB) {
                    const titleA = a.title || a.name || "";
                    const titleB = b.title || b.name || "";
                    return titleA.localeCompare(titleB);
                }
                return rA - rB;
            }
            if (seriesSortOrder === "alphabetical") {
                const titleA = a.title || a.name || "";
                const titleB = b.title || b.name || "";
                return titleA.localeCompare(titleB);
            }
            return 0;
        });
        return sorted;
    }, [series, seriesSortOrder, addedAtMap, ratingsMap]);

    // Calculate slicing bounds defensively on sorted lists
    const totalMoviePages = Math.max(1, Math.ceil(sortedMovies.length / ITEMS_PER_PAGE));
    const activeMoviePage = Math.min(moviePage, totalMoviePages);
    const paginatedMovies = sortedMovies.slice((activeMoviePage - 1) * ITEMS_PER_PAGE, activeMoviePage * ITEMS_PER_PAGE);

    const totalSeriesPages = Math.max(1, Math.ceil(sortedSeries.length / ITEMS_PER_PAGE));
    const activeSeriesPage = Math.min(seriesPage, totalSeriesPages);
    const paginatedSeries = sortedSeries.slice((activeSeriesPage - 1) * ITEMS_PER_PAGE, activeSeriesPage * ITEMS_PER_PAGE);

    const renderPagination = (currentPage, totalPages, setPage, sectionRef) => {
        if (totalPages <= 1) return null;

        const handlePageChange = (p) => {
            setPage(p);
            if (sectionRef && sectionRef.current) {
                sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };

        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                pages.push(i);
            } else if (pages[pages.length - 1] !== "...") {
                pages.push("...");
            }
        }

        return (
            <div className="flex justify-center mt-6 mb-8">
                <div className="join">
                    <button
                        className="join-item btn btn-sm md:btn-md"
                        disabled={currentPage === 1}
                        onClick={() => handlePageChange(currentPage - 1)}
                    >
                        «
                    </button>
                    {pages.map((p, idx) => (
                        <button
                            key={idx}
                            className={`join-item btn btn-sm md:btn-md ${p === currentPage ? 'btn-active btn-primary' : ''} ${p === '...' ? 'btn-disabled' : ''}`}
                            onClick={() => p !== '...' && handlePageChange(p)}
                        >
                            {p}
                        </button>
                    ))}
                    <button
                        className="join-item btn btn-sm md:btn-md"
                        disabled={currentPage === totalPages}
                        onClick={() => handlePageChange(currentPage + 1)}
                    >
                        »
                    </button>
                </div>
            </div>
        );
    };

    // Defensive loading guard — waits until ratings have finished loading to resolve async racing flashes
    if (loading || loadingRatings) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <span className="loading loading-spinner text-primary loading-lg"></span>
                <p className="mt-4 text-base-content/60">Loading watchlist data...</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-6 py-8">
            <h1 className="text-3xl font-bold mb-6">My Watchlist</h1>
            <p className="text-base-content/60 mb-8">Movies and series you plan to watch.</p>

            <section ref={moviesSectionRef} className="mb-10 scroll-mt-20">
                {/* Movies Header with Sort Selector */}
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Movies ({movies.length})</h2>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-base-content/60">Sort:</span>
                        <select 
                            value={movieSortOrder} 
                            onChange={(e) => {
                                setMovieSortOrder(e.target.value);
                            }}
                            className="select select-bordered select-sm"
                        >
                            <option value="alphabetical">Alphabetical</option>
                            <option value="newest">Newest to oldest</option>
                            <option value="oldest">Oldest to newest</option>
                            <option value="highest_rating">Highest ratings</option>
                            <option value="lowest_rating">Lowest ratings</option>
                        </select>
                    </div>
                </div>

                {paginatedMovies.length ? (
                    <>
                        <div className="grid grid-cols-6 md:grid-cols-5 lg:grid-cols-8 gap-2 justify-items-center">
                            {paginatedMovies.map((m) => (
                                <MovieCard
                                    key={m._id || m.id}
                                    movie={m}
                                    showRemove
                                    onRemove={() => handleRemoveMovie(m)}
                                />
                            ))}
                        </div>
                        {renderPagination(activeMoviePage, totalMoviePages, setMoviePage, moviesSectionRef)}
                    </>
                ) : (
                    <p className="text-base-content/50">No movies added yet.</p>
                )}
            </section>

            <section ref={seriesSectionRef} className="scroll-mt-20">
                {/* Series Header with Sort Selector */}
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Series ({series.length})</h2>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-base-content/60">Sort:</span>
                        <select 
                            value={seriesSortOrder} 
                            onChange={(e) => {
                                setSeriesSortOrder(e.target.value);
                            }}
                            className="select select-bordered select-sm"
                        >
                            <option value="alphabetical">Alphabetical</option>
                            <option value="newest">Newest to oldest</option>
                            <option value="oldest">Oldest to newest</option>
                            <option value="highest_rating">Highest ratings</option>
                            <option value="lowest_rating">Lowest ratings</option>
                        </select>
                    </div>
                </div>

                {paginatedSeries.length ? (
                    <>
                        <div className="grid grid-cols-6 md:grid-cols-5 lg:grid-cols-8 gap-2 justify-items-center">
                            {paginatedSeries.map((s) => (
                                <SeriesCard
                                    key={s._id}
                                    series={s}
                                    showRemove
                                    onRemove={() => handleRemoveSeries(s)}
                                />
                            ))}
                        </div>
                        {renderPagination(activeSeriesPage, totalSeriesPages, setSeriesPage, seriesSectionRef)}
                    </>
                ) : (
                    <p className="text-base-content/50">No series added yet.</p>
                )}
            </section>
        </div>
    );
}
