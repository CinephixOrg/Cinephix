// pages/Homepage.jsx (GÜNCELLENMİŞ TAM DOSYA)
import React, { useState } from "react";
import SearchBar from "../components/SearchBar.jsx";
import MovieCard from "../components/MovieCard.jsx";
import SeriesCard from "../components/SeriesCard.jsx";
import UserSearchCard from "../components/UserSearchCard.jsx"; // <-- 1. YENİ KARTI İMPORT ET

export default function Homepage() {
  const [searchData, setSearchData] = useState(null);

  // Arama sonuçlarını render etmek için yardımcı fonksiyon
  const renderResults = () => {
    if (searchData.results.length === 0) {
      return (
        <p className="text-center text-base-content/70 text-lg">
          No results found.
        </p>
      );
    }

    // 2. KATEGORİYE GÖRE KARTLARI DEĞİŞTİR
    if (searchData.category === "movies") {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {searchData.results.map((m) => <MovieCard key={m._id} movie={m} />)}
        </div>
      );
    }
    
    if (searchData.category === "series") {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {searchData.results.map((s) => <SeriesCard key={s._id} series={s} />)}
        </div>
      );
    }

    if (searchData.category === "users") {
      return (
        // Kullanıcı kartları için ızgara yapısını ayarlayabilirsiniz (daha az sütun)
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {searchData.results.map((u) => <UserSearchCard key={u._id} user={u} />)}
        </div>
      );
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      {/* 🔍 Arama Barı */}
      <div className="mb-10 p-6 bg-base-100 rounded-lg shadow-lg">
        <SearchBar onResults={setSearchData} />
      </div>

      {/* Sonuçlar */}
      {searchData ? (
        <section>
          <h2 className="text-2xl font-bold mb-6">
            {searchData.error
              ? searchData.error
              : `Results for "${searchData.query}" in ${searchData.category}`}
          </h2>
          {renderResults()}
        </section>
      ) : (
        <p className="text-center text-lg text-base-content/70">
          Start searching for a movie, series, or user!
        </p>
      )}
    </div>
  );
}