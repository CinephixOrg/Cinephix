// frontend/components/MovieCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- YENİ PROPLAR EKLENDİ: showRemove, onRemove ---
const MovieCard = ({ movie, showRemove = false, onRemove = () => {} }) => {
  const posterUrl = movie.poster_path 
    ? `${IMAGE_BASE_URL}${movie.poster_path}`
    : "https://placehold.co/500x750/1d232a/e0e0e0?text=Poster+Not Found";

  return (
    <div className="card bg-base-100 shadow-xl image-full transition-transform duration-300 hover:scale-105">
      <figure>
        <img src={posterUrl} alt={`${movie.title || movie.name} poster`} />
      </figure>
      <div className="card-body justify-end p-4">
        
        {/* --- YENİ EKLENEN KALDIR BUTONU --- */}
        {showRemove && (
          <button 
            // onRemove'a movie'nin ID'sini gönder
            onClick={() => onRemove(movie._id)} 
            className="btn btn-circle btn-error btn-xs absolute top-2 right-2 z-10"
          >
            ✕
          </button>
        )}
        {/* --- BİTİŞ --- */}

        <h2 className="card-title text-sm text-white drop-shadow-md">
          {movie.title || movie.name}
        </h2>
        <div className="card-actions justify-end">
          <Link to={`/content/movie/${movie._id}`} className="btn btn-primary btn-xs">
            Details
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MovieCard;