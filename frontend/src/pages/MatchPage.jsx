import React, { useState, useContext } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import { AuthContext } from "../context/AuthContext";
import { MOVIE_GENRES, SERIES_GENRES } from "../constants/genreConstants.js";
import MatchLeaderboard from "../components/MatchLeaderboard";
import MatchCard from "../components/MatchCard";
import MatchLoadingAnimation from "../components/MatchLoadingAnimation";

export default function MatchPage() {
  const { user } = useContext(AuthContext);

  // --- STATE ---
  const [matchType, setMatchType] = useState("movie"); // movie | series
  const [filterMode, setFilterMode] = useState("general"); // general | specific
  const [selectedGenres, setSelectedGenres] = useState([]);

  const [useCount, setUseCount] = useState(true);
  const [useAvgRating, setUseAvgRating] = useState(true);

  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const genres = matchType === "movie" ? MOVIE_GENRES : SERIES_GENRES;

  const toggleGenre = (genre) => {
    setSelectedGenres((prev) =>
      prev.includes(genre)
        ? prev.filter((g) => g !== genre)
        : [...prev, genre]
    );
  };

  const handleFindMatches = async () => {
    if (!useCount && !useAvgRating) return;

    setLoading(true);
    setError(null);
    setMatches(null);

    try {
      const payload = {
        type: matchType,
        genres: filterMode === "specific" ? selectedGenres : [],
        useCount,
        useAvgRating,
        hybridMode: true,
        page: 1,
        limit: 15,
      };

      const res = await API.post("/match", payload);
      
      setMatches(res.data);
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || "Eşleşme sırasında bir hata oluştu.";
      setError(`Hata: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 p-6">
      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <header className="text-center mb-10">
          <div className="relative inline-block mb-4">
            <h1
              aria-hidden="true"
              className="absolute inset-0 text-5xl md:text-6xl font-extrabold tracking-tight blur-md opacity-40 pointer-events-none"
            >
              <span className="text-primary">CineMatch</span>
            </h1>
            <h1 className="relative text-5xl md:text-6xl font-extrabold tracking-tight">
              <span className="text-base-content">Cine</span>
              <span className="text-primary">Match</span>
            </h1>
          </div>

          <div className="max-w-3xl mx-auto rounded-xl border border-base-300 bg-base-100/80 p-4 md:p-5">
            <p className="text-base-content/80 leading-relaxed">
              Find your cinematic soulmate! Select your preferences and let CineMatch connect you with users who share your movie and series tastes.
            </p>
          </div>
        </header>

        {/* CONTROL PANEL */}
        <div className="bg-base-100 rounded-xl shadow-xl p-6 mb-10">

          {/* MOVIE / SERIES */}
          <div className="flex justify-center mb-6">
            <div className="tabs tabs-boxed">
              <button
                className={`tab ${matchType === "movie" ? "tab-active" : ""}`}
                onClick={() => {
                  setMatchType("movie");
                  setSelectedGenres([]);
                  setMatches(null);
                }}
              >
                Movies
              </button>
              <button
                className={`tab ${matchType === "series" ? "tab-active" : ""}`}
                onClick={() => {
                  setMatchType("series");
                  setSelectedGenres([]);
                  setMatches(null);
                }}
              >
                Series
              </button>
            </div>
          </div>

          {/* FILTER MODE */}
          <div className="flex flex-col items-center gap-4 mb-6">
            <label className="cursor-pointer flex gap-3 items-center">
              <input
                type="radio"
                className="radio radio-primary"
                checked={filterMode === "general"}
                onChange={() => setFilterMode("general")}
              />
              <span>Match my entire CineGraph</span>
            </label>

            <label className="cursor-pointer flex gap-3 items-center">
              <input
                type="radio"
                className="radio radio-primary"
                checked={filterMode === "specific"}
                onChange={() => setFilterMode("specific")}
              />
              <span>Match specific genres</span>
            </label>
          </div>

          {/* GENRE SELECTION */}
          {filterMode === "specific" && (
            <div className="mb-8">
              <h3 className="text-center font-semibold mb-4">
                Select Genres
              </h3>
              <div className="flex flex-wrap justify-center gap-2">
                {genres.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => toggleGenre(genre)}
                    className={`btn btn-sm ${
                      selectedGenres.includes(genre)
                        ? "btn-primary"
                        : "btn-outline"
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>

              {/* MATCH CRITERIA */}
              <div className="mt-6 flex flex-col items-center gap-4">
                <h4 className="font-semibold text-lg">
                  Match Criteria
                </h4>

                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={useCount}
                      onChange={() => setUseCount(!useCount)}
                    />
                    <span>Watched Count</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={useAvgRating}
                      onChange={() => setUseAvgRating(!useAvgRating)}
                    />
                    <span>Average Rating</span>
                  </label>
                </div>

                {!useCount && !useAvgRating && (
                  <p className="text-error text-sm">
                    You must select at least one criterion.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* BUTTON */}
          <div className="flex justify-center">
            <button
              className="btn btn-primary btn-wide text-lg"
              onClick={handleFindMatches}
              disabled={
                loading ||
                (filterMode === "specific" && selectedGenres.length === 0) ||
                (!useCount && !useAvgRating)
              }
            >
              {loading ? "Matching..." : "🔍 Find Matches"}
            </button>
          </div>

          {error && <div className="alert alert-error mt-4">{error}</div>}
        </div>

        {/* RESULTS */}
        {loading && (
          <div>
            <MatchLoadingAnimation cardCount={6} />
          </div>
        )}

        {!loading && matches && (
          <div>
            {matches.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-xl opacity-60 mb-6">
                  No matches found. Try adjusting your criteria.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => setMatches(null)}
                >
                  Back to Search
                </button>
              </div>
            ) : (
              <div className="space-y-12">
                {/* Leaderboard Section */}
                <MatchLeaderboard matches={matches} />

                {/* Results Grid - Top 15 matches */}
                <div>
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold mb-2">
                      🎬 All Matches
                    </h2>
                    <p className="text-base-content/60">
                      Discover {Math.min(matches.length, 15)} premium profile matches
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                    {matches.slice(0, 15).map((match, index) => (
                      <MatchCard
                        key={match.user._id}
                        match={match}
                        rank={index < 3 ? index + 1 : undefined}
                        animationDelay={index * 60}
                      />
                    ))}
                  </div>
                </div>

                {/* Info Footer */}
                {matches.length > 15 && (
                  <div className="text-center py-8 opacity-60">
                    <p className="text-sm">
                      Showing top 15 matches out of {matches.length} total
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
