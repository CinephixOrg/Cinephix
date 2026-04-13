import React, { useState, useContext } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import { AuthContext } from "../context/AuthContext";
import { MOVIE_GENRES, SERIES_GENRES } from "../constants/genreConstants.js";

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
        limit: 50,
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
          <h1 className="text-4xl font-bold mb-2">CineMatch 🔮</h1>
          <p className="text-base-content/70">
            Find your cinematic soulmate! Select your preferences and let CineMatch connect you with users who share your movie and series tastes.
          </p>
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
        {matches && (
          <div>
            <h2 className="text-2xl font-bold mb-6">
              Top Matches ({matches.length})
            </h2>

            {matches.length === 0 ? (
              <p className="text-center opacity-60">
                No matches found. Try adjusting your criteria.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {matches.map((match) => (
                  <div
                    key={match.user._id}
                    className="card bg-base-100 shadow-xl border"
                  >
                    <div className="card-body flex-row items-center gap-4">
                      <div className="avatar">
                        <div className="w-14 rounded-full">
                          <img
                            src={
                              match.user.profile_pic_url ||
                              `https://ui-avatars.com/api/?name=${match.user.username}`
                            }
                            alt="avatar"
                          />
                        </div>
                      </div>

                      <div className="flex-1">
                        <h3 className="font-semibold">
                          {match.user.username}
                        </h3>
                        <Link
                          to={`/users/${match.user._id}`}
                          className="btn btn-xs btn-outline mt-2"
                        >
                          View Profile
                        </Link>
                      </div>

                      <div
                        className="radial-progress text-primary font-bold"
                        style={{
                          "--value": match.matchPercentage,
                          "--size": "3rem",
                        }}
                      >
                        {match.matchPercentage}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
