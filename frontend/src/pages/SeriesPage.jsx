import React, { useState, useEffect, useCallback } from 'react';
import API from '../api/axios.js';
import SeriesCard from '../components/SeriesCard.jsx';

const LoadingSpinner = () => (
  <div className="flex justify-center items-center p-10 col-span-full">
    <span className="loading loading-spinner loading-lg text-primary"></span>
  </div>
);

export default function SeriesPage() {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeFilters, setActiveFilters] = useState({ title: '', year: 2025 });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSeries = useCallback(async (page, filters) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ page, limit: 18 });
      if (filters.title) params.append('name', filters.title); // backend'de name kullanılıyor
      if (filters.year) params.append('year', filters.year);

      const response = await API.get(`/series?${params.toString()}`);

      setSeries(response.data.results);
      setCurrentPage(response.data.page);
      setTotalPages(Math.ceil(response.data.total / response.data.limit));

    } catch (err) {
      console.error("Error fetching series:", err);
      setError("Could not load series. Please try again later.");
      setSeries([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, []);

  // İlk yükleme: 2025 dizileri
  useEffect(() => {
    fetchSeries(1, activeFilters);
  }, [fetchSeries]);

  // Search butonuyla arama
  const handleSearch = (event) => {
  event.preventDefault();
  const trimmedTerm = searchTerm.trim(); // boşlukları kırp
  let newFilters;

  if (trimmedTerm === "") {
    // boş arama → tüm diziler
    newFilters = { title: null, year: null };
  } else {
    newFilters = { title: trimmedTerm, year: null };
  }

  setActiveFilters(newFilters);
  setCurrentPage(1);
  fetchSeries(1, newFilters);
};


  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= totalPages) {
      fetchSeries(newPage, activeFilters);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 animate-fade-in">
      {/* Arama Çubuğu */}
      <div className="mb-8 p-6 bg-base-100 rounded-lg shadow-lg">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search for a series..."
            className="input input-bordered w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="loading loading-spinner loading-xs"></span> : 'Search'}
          </button>
        </form>
      </div>

      {/* Series Grid */}
      <section>
        <h2 className="text-2xl font-bold mb-4">
          {activeFilters.title
          ? `Results for "${activeFilters.title}"`
          : activeFilters.year
          ? `Series from ${activeFilters.year}`
          : `All Series`}
        </h2>



        {error && <div className="alert alert-error mb-4">{error}</div>}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {loading ? (
            <LoadingSpinner />
          ) : series.length === 0 ? (
            <p className="col-span-full text-center text-lg text-base-content/70">
              No results found.
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
              « Previous
            </button>
            <button className="join-item btn">
              Page {currentPage} of {totalPages}
            </button>
            <button
              className="join-item btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next »
            </button>
          </div>
        )}
      </section>

      {/*
      // Anbean güncellenen, debounce ile canlı arama versiyonu
      useEffect(() => {
        const delayDebounce = setTimeout(() => {
          const newFilters = searchTerm
            ? { title: searchTerm, year: null }
            : { title: '', year: 2025 };
          setActiveFilters(newFilters);
          fetchSeries(1, newFilters);
        }, 400);
        return () => clearTimeout(delayDebounce);
      }, [searchTerm, fetchSeries]);
      */}
    </div>
  );
}
