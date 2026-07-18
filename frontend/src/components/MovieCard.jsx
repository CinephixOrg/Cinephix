// frontend/components/MovieCard.jsx
import React, { useContext } from "react";
import { Link } from "react-router-dom";
import DisplayRating from "./DisplayRating.jsx";
import { RatingsContext } from "../context/RatingsContext.jsx";

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

const MovieCard = ({ movie, showRemove = false, onRemove = () => { } }) => {
  const posterUrl = movie.poster_path
    ? `${IMAGE_BASE_URL}${movie.poster_path}`
    : "https://placehold.co/500x750/1d232a/e0e0e0?text=Poster+Not+Found";

  const { ratingsMap } = useContext(RatingsContext) || { ratingsMap: new Map() };
  const userRating = ratingsMap
    ? (ratingsMap.get(movie._id?.toString())
      || (movie.tvdb ? ratingsMap.get(movie.tvdb.toString()) : null)
      || (movie.id?.tvdb ? ratingsMap.get(movie.id.tvdb.toString()) : null)
      || ratingsMap.get(movie._id))
    : null;

  return (
    <div className="card bg-base-100 image-full transition-all duration-300 ease-out transform hover:scale-105 hover:shadow-[0_0_25px_rgba(255,255,255,0.25)] before:transition-opacity before:duration-300 hover:before:opacity-20 group relative overflow-hidden">
      <figure className="w-full h-full">
        <img
          src={posterUrl}
          alt={`${movie.title || movie.name} poster`}
          className="w-full h-full object-cover filter brightness-75 contrast-90 saturate-90 transition-all duration-300 ease-out group-hover:brightness-110 group-hover:contrast-100 group-hover:saturate-110"
        />
      </figure>
      <div className="card-body justify-end p-4 z-10">

        {showRemove && (
          <button onClick={() => onRemove(movie._id)} className="btn btn-circle btn-error btn-xs absolute top-2 right-2 z-20">
            ✕
          </button>
        )}

        <h2 className="card-title text-sm text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          {movie.title || movie.name}
        </h2>

        <div className="card-actions justify-between items-center mt-2">
          {userRating && userRating > 0 ? (
            <DisplayRating rating={userRating} contentId={movie._id} />
          ) : (
            <div></div>
          )}

          <Link to={`/content/movie/${movie._id}`} className="btn btn-primary btn-xs shadow-md">
            Details
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MovieCard;