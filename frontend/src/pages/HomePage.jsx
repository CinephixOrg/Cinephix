import React, { useState, useEffect, useContext } from "react";
import API from '../api/axios'; // Merkezi API yapılandırmamız
import MovieCard from '../components/MovieCard'; // Az önce oluşturduğumuz kart
import { AuthContext } from "../context/AuthContext"; // AuthContext'i de dahil edelim

// Yükleniyor... animasyonu için basit bir component
const LoadingSpinner = () => (
  <div className="flex justify-center items-center p-10">
    <span className="loading loading-spinner loading-lg text-primary"></span>
  </div>
);

export default function HomePage() {
  const { user, logout } = useContext(AuthContext);

  // Verileri, yüklenme durumunu ve hata durumunu tutmak için state'ler
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Bu `useEffect` hook'u, component ekrana ilk yüklendiğinde bir kez çalışır.
  useEffect(() => {
    // Veri çekme işlemini yönetecek asenkron fonksiyon
    const fetchRecentMovies = async () => {
      try {
        setLoading(true); // Veri çekme işlemi başlarken yükleniyor durumunu aktif et

        // Merkezi API'mizi kullanarak backend'deki /movies endpoint'ine istek at
        const response = await API.get('/movies?limit=12'); // Sadece son 12 filmi alalım

        setMovies(response.data.results); // Gelen veriyi state'e kaydet
        setError(null); // Başarılı olursa önceki hataları temizle

      } catch (err) {
        console.error("Filmler çekilirken hata oluştu:", err);
        setError("Filmler yüklenemedi. Lütfen daha sonra tekrar deneyin.");
      } finally {
        setLoading(false); // İşlem bitince (başarılı veya hatalı) yükleniyor durumunu kapat
      }
    };

    fetchRecentMovies(); // Fonksiyonu çalıştır
  }, []); // Boş dependency array `[]` -> "sadece bir kez çalıştır" demek

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 animate-fade-in">
      <header className="bg-base-100 p-6 rounded-lg shadow-lg mb-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Tekrar Hoş Geldin, {user?.username || "Guest"} 🎬</h1>
            <p className="mt-1 text-base-content/70">Cinephix hesabında olup bitenler.</p>
          </div>
          <div className="flex items-center gap-3">
            {user && <button onClick={logout} className="btn btn-error">Çıkış Yap</button>}
          </div>
        </div>
      </header>

      <main>
        {/* İstatistikler bölümü aynı kalabilir */}
        <div className="stats shadow w-full mb-8">
            {/* ... stat component'leri ... */}
        </div>

        {/* İçerik */}
        <section>
          <h2 className="text-xl font-bold mb-4">Yakın Zamanda Eklenen Filmler</h2>
          {/* Yüklenme ve Hata durumlarını kontrol et */}
          {loading ? (
            <LoadingSpinner />
          ) : error ? (
            <div className="alert alert-error">{error}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {/* Gelen `movies` dizisini map'leyerek her film için bir MovieCard oluştur */}
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