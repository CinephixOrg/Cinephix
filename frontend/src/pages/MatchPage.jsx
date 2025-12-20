// src/pages/MatchPage.jsx

import React, { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import API from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

// Backend'deki MOVIE_GENRE_MAP ve SERIES_GENRE_MAP ile uyumlu tür isimleri
const MOVIE_GENRES = [
  "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", 
  "Drama", "Family", "Fantasy", "History", "Horror", "Music", 
  "Mystery", "Romance", "Science Fiction", "TV Movie", "Thriller", "War", "Western"
];

const SERIES_GENRES = [
  "Action & Adventure", "Animation", "Comedy", "Crime", "Documentary", 
  "Drama", "Family", "Kids", "Mystery", "News", "Reality", 
  "Sci-Fi & Fantasy", "Soap", "Talk", "War & Politics", "Western"
];

export default function MatchPage() {
  const { user } = useContext(AuthContext);

  // --- STATE'LER ---
  const [matchType, setMatchType] = useState('movie'); // 'movie' veya 'series'
  const [filterMode, setFilterMode] = useState('general'); // 'general' veya 'specific'
  const [selectedGenres, setSelectedGenres] = useState([]); // Seçilen türler
  
  const [matches, setMatches] = useState(null); // Sonuçlar
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Tür seçme/kaldırma fonksiyonu
  const toggleGenre = (genre) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genre));
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  // EŞLEŞTİRME İSTEĞİ (ALGORİTMAYI ÇALIŞTIR)
  const handleFindMatches = async () => {
    setLoading(true);
    setError(null);
    setMatches(null);

    try {
      // Backend'e gönderilecek veri
      const payload = {
        type: matchType,
        // Eğer 'specific' seçildiyse seçilen türleri, değilse boş dizi yolla
        genres: filterMode === 'specific' ? selectedGenres : []
      };

      const response = await API.post('/users/matches', payload);
      setMatches(response.data);

    } catch (err) {
      console.error("Eşleşme hatası:", err);
      setError(err.response?.data?.message || "Eşleşme yapılırken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  // Aktif tür listesi (Film mi Dizi mi?)
  const currentGenreList = matchType === 'movie' ? MOVIE_GENRES : SERIES_GENRES;

  return (
    <div className="min-h-screen bg-base-200 p-4 md:p-8 animate-fade-in">
      <div className="max-w-5xl mx-auto">
        
        {/* --- BAŞLIK --- */}
        <header className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-2">CineMatch 🔮</h1>
          <p className="text-base-content/70">
            Find users whose tastes are most similar to yours!
          </p>
        </header>

        {/* --- KONTROL PANELİ --- */}
        <div className="bg-base-100 rounded-xl shadow-xl p-6 mb-8">
          
          {/* 1. Film / Dizi Seçimi */}
          <div className="flex justify-center mb-6">
            <div className="tabs tabs-boxed">
              <a 
                className={`tab tab-lg ${matchType === 'movie' ? 'tab-active' : ''}`}
                onClick={() => { setMatchType('movie'); setSelectedGenres([]); setMatches(null); }}
              >
                Movies
              </a>
              <a 
                className={`tab tab-lg ${matchType === 'series' ? 'tab-active' : ''}`}
                onClick={() => { setMatchType('series'); setSelectedGenres([]); setMatches(null); }}
              >
                Series
              </a>
            </div>
          </div>

          {/* 2. Filtre Modu Seçimi */}
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="form-control">
              <label className="label cursor-pointer gap-4">
                <span className="label-text text-lg">Match my entire CineGraph</span> 
                <input 
                  type="radio" 
                  name="filterMode" 
                  className="radio radio-primary" 
                  checked={filterMode === 'general'} 
                  onChange={() => setFilterMode('general')} 
                />
              </label>
            </div>
            <div className="form-control">
              <label className="label cursor-pointer gap-4">
                <span className="label-text text-lg">Match specific genres</span> 
                <input 
                  type="radio" 
                  name="filterMode" 
                  className="radio radio-primary" 
                  checked={filterMode === 'specific'} 
                  onChange={() => setFilterMode('specific')} 
                />
              </label>
            </div>
          </div>

          {/* 3. Tür Seçici (Sadece 'specific' modunda görünür) */}
          {filterMode === 'specific' && (
            <div className="mb-8 animate-fade-in">
              <h3 className="text-center font-semibold mb-4">Which genres do you want to match?</h3>
              <div className="flex flex-wrap justify-center gap-2">
                {currentGenreList.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => toggleGenre(genre)}
                    className={`btn btn-sm ${selectedGenres.includes(genre) ? 'btn-primary' : 'btn-outline'}`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. EŞLEŞTİR BUTONU */}
          <div className="flex justify-center">
            <button 
              className="btn btn-wide btn-primary text-lg"
              onClick={handleFindMatches}
              disabled={loading || (filterMode === 'specific' && selectedGenres.length === 0)}
            >
              {loading ? <span className="loading loading-spinner"></span> : '🔍 Find Matches'}
            </button>
          </div>
          
          {error && <div className="alert alert-error mt-4">{error}</div>}
        </div>

        {/* --- SONUÇLAR --- */}
        {matches && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold mb-6">
              Top Matches ({matches.length})
            </h2>

            {matches.length === 0 ? (
              <div className="text-center p-10 opacity-60">
                <p className="text-xl">Sorry, no matches found for your criteria.</p>
                <p>Try rating more movies or adjust your filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {matches.map((match) => (
                  // USER CARD
                  <div key={match.user._id} className="card bg-base-100 shadow-xl border border-base-300 hover:border-primary transition-colors">
                    <div className="card-body flex flex-row items-center gap-4">
                      
                      {/* Avatar */}
                      <div className="avatar">
                        <div className="w-16 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 overflow-hidden bg-gray-200">
                          <img
                            src={
                              match.user?.profile_pic_url || match.user?.profilePicUrl || match.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(match.user?.username || 'U')}`
                            }
                            alt="avatar"
                            className="w-full h-full object-cover object-center"
                          />
                        </div>
                      </div>

                      {/* Bilgiler */}
                      <div className="flex-1">
                        <h3 className="card-title text-lg">
                          {match.user.username}
                        </h3>
                        <p className="text-xs opacity-70">
                          {match.sharedGenres} genres compared
                        </p>
                        <div className="mt-2">
                            <Link to={`/users/${match.user._id || match.user.id}`} className="btn btn-xs btn-outline">
                              View Profile
                            </Link>
                        </div>
                      </div>

                      {/* Eşleşme Skoru (Badge) */}
                      <div className="flex flex-col items-center">
                        <div className={`radial-progress font-bold text-sm ${match.matchPercentage > 80 ? 'text-success' : match.matchPercentage > 50 ? 'text-warning' : 'text-error'}`} 
                             style={{"--value": match.matchPercentage, "--size": "3rem"}}>
                          {match.matchPercentage}%
                        </div>
                        <span className="text-[10px] uppercase font-bold mt-1 opacity-60">Match</span>
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