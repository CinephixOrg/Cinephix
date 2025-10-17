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

  useEffect(() => {
    // Fonksiyonun adını daha anlamlı hale getirelim
    const fetchMoviesByYear = async (year) => {
      try {
        setLoading(true);

        // --- DEĞİŞİKLİK BURADA ---
        // API isteğine ?year=2025 parametresini ekliyoruz.
        // Ayrıca, daha fazla sonuç görmek için limiti 18'e çıkaralım.
        const response = await API.get(`/movies?year=${year}&limit=30`); 

        setMovies(response.data.results);
        setError(null);

      } catch (err) {
        console.error(`${year} yılı filmleri çekilirken hata oluştu:`, err);
        setError("Filmler yüklenemedi. Lütfen daha sonra tekrar deneyin.");
      } finally {
        setLoading(false);
      }
    };

    // Fonksiyonu 2025 yılı için çalıştırıyoruz
    fetchMoviesByYear(2025);
  }, []); // [] -> Bu effect sadece component ilk yüklendiğinde bir kez çalışır

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 animate-fade-in">
      <header className="bg-base-100 p-6 rounded-lg shadow-lg mb-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Welcome back, {user?.username || "Guest"} 🎬</h1>
          </div>
        </div>
      </header>

      <main>
        {/* İçerik */}
        <section>
          {/* --- BAŞLIK DEĞİŞİKLİĞİ BURADA --- */}
          <h2 className="text-xl font-bold mb-4">Released in 2025</h2>
          
          {/* Yüklenme ve Hata durumlarını kontrol et */}
          {loading ? (
            <LoadingSpinner />
          ) : error ? (
            <div className="alert alert-error">{error}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {movies.map((movie) => (
                <MovieCard key={movie._id} movie={movie} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

