import React, { useState, useEffect, useCallback } from 'react';
import API from '../api/axios.js';
import { useTranslation } from 'react-i18next';
import SeriesCard from '../components/SeriesCard.jsx';
import SeriesSearchBar from '../components/SeriesSearchBar.jsx';
import genresData from '../data/seriesGenres.json';

const LoadingSpinner = () => (
  <div className="flex justify-center items-center p-10 col-span-full">
    <span className="loading loading-spinner loading-lg text-primary"></span>
  </div>
);

export default function SeriesPage() {
  const { t } = useTranslation();
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeFilters, setActiveFilters] = useState({ query: '', years: [], genres: [], hasPoster: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSeries = useCallback(async (page, filters) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ page, limit: 24 });
      if (filters.query) params.append('query', filters.query);
      if (filters.years.length > 0) params.append('years', filters.years.join(','));
      if (filters.genres.length > 0) params.append('genres', filters.genres.join(','));
      if (filters.hasPoster) params.append('hasPoster', filters.hasPoster);

      const response = await API.get(`/series?${params.toString()}`);

      // response.data is the array, response.pagination has pagination info
      setSeries(response.data);
      setCurrentPage(response.pagination?.page || 1);
      setTotalPages(response.pagination?.pages || 1);

    } catch (err) {
      console.error("Error fetching series:", err);
      setError(t("Could not load series"));
      setSeries([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSeries(1, activeFilters);
  }, [fetchSeries]);

  const handleSearch = (filters) => {
    setActiveFilters(filters);
    setCurrentPage(1);
    fetchSeries(1, filters);
  };

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= totalPages) {
      fetchSeries(newPage, activeFilters);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 animate-fade-in">
      {/* Arama Çubuğu (SearchBar bileşeni) */}
      <div className="mb-8 p-6 bg-base-100 rounded-lg shadow-lg flex justify-between items-start">
        <SeriesSearchBar onResults={handleSearch} />
      </div>

      {/* Series Grid */}
      <section>
        <h2 className="text-2xl font-bold mb-4">
          {activeFilters.query
            ? t("Results for", { query: activeFilters.query })
            : activeFilters.years.length > 0
              ? t("Series from", { years: activeFilters.years.join(', ') })
              : activeFilters.genres.length > 0
                ? t("Genres list", {
                    genres: activeFilters.genres.map((id) => {
                      const genre = genresData.genres.find((g) => g.id === Number(id));
                      return genre ? genre.name : id;
                    }).join(', ')
                  })
                : t("Series")}
        </h2>

        {error && <div className="alert alert-error mb-4">{error}</div>}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {loading ? (
            <LoadingSpinner />
          ) : series.length === 0 ? (
            <p className="col-span-full text-center text-lg text-base-content/70">
              {t("No results found")}
            </p>
          ) : (
            series.map((item) => <SeriesCard key={item._id} series={item} />)
          )}
        </div>

        {/* Pagination */}
        {!loading && series.length > 0 && totalPages > 1 && (
          <div className="join flex justify-center mt-8">
            <button
              className="join-item btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              « {t("Previous")}
            </button>
            <button className="join-item btn">
              {t("Page of", { current: currentPage, total: totalPages })}
            </button>
            <button
              className="join-item btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              {t("Next")} »
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
