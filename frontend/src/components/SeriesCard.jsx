// frontend/components/SeriesCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- YENİ PROPLAR EKLENDİ: showRemove, onRemove ---
const SeriesCard = ({ series, showRemove = false, onRemove = () => {} }) => {
  const posterUrl = series.poster_path 
    ? `${IMAGE_BASE_URL}${series.poster_path}`
    : "https://placehold.co/500x750/1d232a/e0e0e0?text=Poster+Not Found";
  
  const displayName = series.name || series.title; 

  return (
    <div className="card bg-base-100 shadow-xl image-full transition-transform duration-300 hover:scale-105">
      <figure>
        <img src={posterUrl} alt={`${displayName} poster`} />
      </figure>
      <div className="card-body justify-end p-4">
        
        {/* --- YENİ EKLENEN KALDIR BUTONU --- */}
        {showRemove && (
          <button 
            // onRemove'a series'in ID'sini gönder
            onClick={() => onRemove(series._id)} 
            className="btn btn-circle btn-error btn-xs absolute top-2 right-2 z-10"
          >
            ✕
          </button>
        )}
        {/* --- BİTİŞ --- */}
        
        <h2 className="card-title text-sm text-white drop-shadow-md">
          {displayName}
        </h2>
        <div className="card-actions justify-end">
          <Link to={`/content/series/${series._id}`} className="btn btn-primary btn-xs">
            Details
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SeriesCard;