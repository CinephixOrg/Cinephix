import React from 'react';
import { Link } from 'react-router-dom';

// TMDB'den gelen poster yollarını tam URL'e çevirmek için temel adres
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

const MovieCard = ({ movie }) => {
  // Poster yolu yoksa veya bozuksa gösterilecek yer tutucu resim

  // YENİ: Verinin yapısını görmek için konsola yazdır
  // console.log("Gelen içerik verisi:", movie);

  const posterUrl = movie.poster_path 
    ? `${IMAGE_BASE_URL}${movie.poster_path}`
    : "https://placehold.co/500x750/1d232a/e0e0e0?text=Poster+Yok";

  return (
    // DaisyUI card component'ini kullanıyoruz
    <div className="card bg-base-100 shadow-xl image-full transition-transform duration-300 hover:scale-105">
      <figure>
        <img
          src={posterUrl}
          alt={`${movie.title || movie.name} poster`}
        />
      </figure>
      <div className="card-body justify-end p-4">
        <h2 className="card-title text-sm text-white drop-shadow-md">
          {movie.title || movie.name}
        </h2>
        <div className="card-actions justify-end">
          {/* DEĞİŞİKLİK BURADA: Link artık /content/movie/:id formatında dinamik */}
          <Link to={`/content/movie/${movie._id}`} className="btn btn-primary btn-xs">
            Details
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MovieCard;

