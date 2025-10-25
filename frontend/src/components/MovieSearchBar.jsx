import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FaSearch, FaFilter, FaTimes } from "react-icons/fa"; // Import icons
import API from "../api/axios.js";
import genresData from "../data/movieGenres.json"; // Import the correct JSON structure

export default function MovieSearchBar({ onResults }) {
  const [query, setQuery] = useState("");
  const [years, setYears] = useState([]); // Updated to handle multiple years
  const [hasPoster, setHasPoster] = useState("");
  const [selectedGenres, setSelectedGenres] = useState([]); // Updated to handle multiple genres
  const [loading, setLoading] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const genres = genresData.genres;

  useEffect(() => {
    setQuery(searchParams.get("query") || "");
    setYears(searchParams.get("years")?.split(",") || []);
    setHasPoster(searchParams.get("hasPoster") || "");
    setSelectedGenres(searchParams.get("genres")?.split(",") || []);
  }, [searchParams]);

  const handleSearch = async (e) => {
    e.preventDefault(); // Prevent page reload
    const trimmedQuery = query.trim();
    const newSearchParams = {};

    if (trimmedQuery) newSearchParams.query = trimmedQuery;
    if (years.length > 0) newSearchParams.years = years.join(",");
    if (hasPoster) newSearchParams.hasPoster = hasPoster;
    if (selectedGenres.length > 0) newSearchParams.genres = selectedGenres.join(",");

    // Eğer hiçbir filtre yoksa tüm filmleri getir
    if (!trimmedQuery && years.length === 0 && !hasPoster && selectedGenres.length === 0) {
      newSearchParams.page = 1; // Ensure page=1 is added even when no filters are applied
    } else {
      newSearchParams.page = 1; // Always add page=1 after search
    }

    setSearchParams(newSearchParams);

    setLoading(true);
    try {
      const params = new URLSearchParams({ ...newSearchParams, limit: 18 });
      const res = await API.get(`/movies?${params.toString()}`);

      onResults({
        query: trimmedQuery,
        years,
        hasPoster,
        genres: selectedGenres,
        results: res.data.results || [],
        total: res.data.total || 0,
      });
    } catch (err) {
      console.error("Search error:", err);
      const errorMsg =
        err.response?.data?.message || "Something went wrong. Try again later.";
      onResults({
        query: trimmedQuery,
        years,
        hasPoster,
        genres: selectedGenres,
        results: [],
        error: errorMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleGenreSelection = (genreId) => {
    setSelectedGenres((prev) =>
      prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]
    );
  };

  const toggleYearSelection = (year) => {
    setYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  };

  const toggleFiltersVisibility = (e) => {
    e.preventDefault(); // Prevent page reload
    setFiltersVisible(!filtersVisible);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Always visible text search bar and filters toggle button */}
      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row gap-3 items-center w-full"
      >
        <input
          type="text"
          placeholder="Search movies..."
          className="input input-bordered w-full sm:w-2/3"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <FaSearch />
          )}
        </button>
        <button
          onClick={toggleFiltersVisibility}
          className="btn btn-secondary"
        >
          {filtersVisible ? <FaTimes /> : <FaFilter />}
        </button>
      </form>

      {filtersVisible && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="flex flex-col">
            <label className="font-bold mb-2">Years</label>
            <div className="grid grid-cols-3 gap-4 overflow-y-auto max-h-40">
              {Array.from({ length: 126 }, (_, i) => 1900 + i).map((y) => (
                <button
                  key={y}
                  type="button"
                  className={`btn ${years.includes(String(y)) ? "btn-primary" : "btn-outline"}`}
                  onClick={() => toggleYearSelection(String(y))}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col">
            <label className="font-bold mb-2">Genres</label>
            <div className="grid grid-cols-3 gap-4 overflow-y-auto max-h-40">
              {genres.map((genre) => (
                <button
                  key={genre.id}
                  type="button"
                  className={`btn ${selectedGenres.includes(String(genre.id)) ? "btn-primary" : "btn-outline"}`}
                  onClick={() => toggleGenreSelection(String(genre.id))}
                >
                  {genre.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col">
            <label className="font-bold mb-2">Has Poster?</label>
            <select
              value={hasPoster}
              onChange={(e) => setHasPoster(e.target.value)}
              className="select select-bordered w-full"
            >
              <option value="">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
