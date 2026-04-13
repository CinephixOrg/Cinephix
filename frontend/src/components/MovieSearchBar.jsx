import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FaSearch, FaFilter, FaTimes } from "react-icons/fa";
import { useDebounce } from "../hooks/index.js";
import API from "../api/axios.js";
import genresData from "../data/movieGenres.json";

export default function MovieSearchBar({ onResults }) {
  const [query, setQuery] = useState("");
  const [years, setYears] = useState([]);
  const [hasPoster, setHasPoster] = useState("");
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Debounce the query to prevent excessive API calls
  const debouncedQuery = useDebounce(query, 300);

  const genres = genresData.genres;

  useEffect(() => {
    setQuery(searchParams.get("query") || "");
    setYears(searchParams.get("years")?.split(",") || []);
    setHasPoster(searchParams.get("hasPoster") || "");
    setSelectedGenres(searchParams.get("genres")?.split(",") || []);
  }, [searchParams]);

  // Auto-search when debounced query changes (optional feature for search-as-you-type)
  // Uncomment below if you want auto-search on type instead of requiring form submission
  // useEffect(() => {
  //   if (debouncedQuery) {
  //     triggerSearch(debouncedQuery);
  //   }
  // }, [debouncedQuery]);

  const handleSearch = (e) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    const newSearchParams = {};

    if (trimmedQuery) newSearchParams.query = trimmedQuery;
    if (years.length > 0) newSearchParams.years = years.join(",");
    if (hasPoster) newSearchParams.hasPoster = hasPoster;
    if (selectedGenres.length > 0) newSearchParams.genres = selectedGenres.join(",");

    newSearchParams.page = 1;
    setSearchParams(newSearchParams);
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
        <button type="submit" className="btn btn-primary">
          <FaSearch />
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
