import React, { useState, useEffect, useContext } from "react";
import API from '../api/axios.js'; // Merkezi API yapılandırmamız
import MovieCard from '../components/MovieCard.jsx'; // Film kartı component'i
import { AuthContext } from "../context/AuthContext.jsx";

// Yükleniyor... animasyonu için basit bir component
const LoadingSpinner = () => (
  <div className="flex justify-center items-center p-10">
    <span className="loading loading-spinner loading-lg text-primary"></span>
  </div>
);

export default function HomePage() {
  const { user, logout } = useContext(AuthContext);

  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Bu `useEffect` hook'u, component ekrana ilk yüklendiğinde bir kez çalışır.
  useEffect(() => {
    // Fetch recent movies (optionally by year). Fixed: define and call the function correctly.
    const fetchRecentMovies = async (year) => {
      try {
        setLoading(true);

        // If year is provided use it, otherwise fetch recent movies without year filter
        const url = year ? `/movies?year=${year}&limit=30` : `/movies?limit=30`;
        const response = await API.get(url);

        // API may return { results: [...] } or an array directly
        const results = response?.data?.results ?? response?.data ?? [];
        setMovies(results);
        setError(null);

      } catch (err) {
        console.error('Filmler çekilirken hata oluştu:', err);
        setError("Filmler yüklenemedi. Lütfen daha sonra tekrar deneyin.");
      } finally {
        setLoading(false);
      }
    };

    fetchRecentMovies(); // call the correctly named function
  }, []); // Boş dependency array `[]` -> "sadece bir kez çalıştır" demek

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 animate-fade-in">
      <header className="bg-base-100 p-6 rounded-lg shadow-lg mb-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user?.username || "Guest"} 🎬</h1>
            <p className="mt-1 text-sm text-gray-600">Here’s what's happening with your Cinephix account.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={logout} className="inline-flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg">Logout</button>
          </div>
        </div>
      </header>

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">Movies in DB</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">12,345</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">Series in DB</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">4,321</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">Your Contributions</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">23</p>
            </div>
          </div>

          {/* Content grid */}
          <section>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Movies</h2>

            {loading ? (
              <LoadingSpinner />
            ) : error ? (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">{error}</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {movies && movies.length > 0 ? (
                  movies.map((movie, idx) => (
                    <MovieCard key={movie.id ?? movie._id ?? idx} movie={movie} />
                  ))
                ) : (
                  // fallback placeholders
                  [1,2,3,4,5,6].map((i) => (
                    <article key={i} className="bg-white rounded-lg shadow-sm overflow-hidden">
                      <div className="h-40 bg-gray-200 flex items-center justify-center text-gray-500">Poster {i}</div>
                      <div className="p-4">
                        <h3 className="font-semibold text-gray-900">Movie Title {i}</h3>
                        <p className="text-sm text-gray-500 mt-1">Short description or genres...</p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-sm font-medium text-pink-500">View</span>
                          <span className="text-sm text-gray-400">2025</span>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
