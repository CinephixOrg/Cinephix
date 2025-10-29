// frontend/components/MovieCard.jsx
import React, { useContext } from "react"; // <-- useContext'i import et
import { Link } from "react-router-dom";
import DisplayRating from "./DisplayRating.jsx";
import { RatingsContext } from "../context/RatingsContext.jsx"; // <-- 1. YENİ IMPORT

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 2. 'userRating' PROP'UNU SİL ---
const MovieCard = ({ movie, showRemove = false, onRemove = () => {} }) => {
  const posterUrl = movie.poster_path 
    ? `${IMAGE_BASE_URL}${movie.poster_path}`
    : "https://placehold.co/500x750/1d232a/e0e0e0?text=Poster+Not Found";

  // --- 3. GLOBAL HAFIZAYI OKU ---
  const { ratingsMap } = useContext(RatingsContext);
  // --- 4. OYU DOĞRUDAN HARİTADAN AL ---
  const userRating = ratingsMap.get(movie._id);

  return (
    <div className="card bg-base-100 shadow-xl image-full transition-transform duration-300 hover:scale-105">
      {/* ... (figure, remove button, title... geri kalanı aynı) ... */}
      <figure>
        <img src={posterUrl} alt={`${movie.title || movie.name} poster`} />
      </figure>
      <div className="card-body justify-end p-4">
        
        {showRemove && (
          <button onClick={() => onRemove(movie._id)} className="btn btn-circle btn-error btn-xs absolute top-2 right-2 z-10">
            ✕
          </button>
        )}

        <h2 className="card-title text-sm text-white drop-shadow-md">
          {movie.title || movie.name}
        </h2>

        <div className="card-actions justify-between items-center">
          
          {/* Bu kod artık global 'userRating'i okuduğu için MÜKEMMEL ÇALIŞACAK */}
          {userRating && userRating > 0 ? (
            <DisplayRating rating={userRating} contentId={movie._id} />
          ) : (
            <div></div> 
          )}

          <Link to={`/content/movie/${movie._id}`} className="btn btn-primary btn-xs">
            Details
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MovieCard;