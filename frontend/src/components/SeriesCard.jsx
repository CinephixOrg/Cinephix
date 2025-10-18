import React from 'react';
import { Link } from 'react-router-dom';

// TMDB'den gelen poster yollarını tam URL'e çevirmek için temel adres
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

const SeriesCard = ({ series }) => {
  // Poster yolu yoksa veya bozuksa gösterilecek yer tutucu resim
  const posterUrl = series.poster_path 
    ? `${IMAGE_BASE_URL}${series.poster_path}`
    : "https://placehold.co/500x750/1d232a/e0e0e0?text=Poster+Not Found";

  // İYİLEŞTİRME: Diziler için 'name' alanını öncelikli kontrol ediyoruz.
  const displayName = series.name || series.title; 

  return (
    // DaisyUI card component'ini kullanıyoruz
    <div className="card bg-base-100 shadow-xl image-full transition-transform duration-300 hover:scale-105">
      <figure>
        <img
          src={posterUrl}
          alt={`${displayName} poster`} // displayName değişkeni kullanıldı
        />
      </figure>
      <div className="card-body justify-end p-4">
        <h2 className="card-title text-sm text-white drop-shadow-md">
          {displayName} {/* displayName değişkeni kullanıldı */}
        </h2>
        <div className="card-actions justify-end">
          {/* Link /content/series/:id formatında olmalı, ki zaten öyle */}
          <Link to={`/content/series/${series._id}`} className="btn btn-primary btn-xs">
            Details
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SeriesCard;