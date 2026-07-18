// frontend/components/SeriesCard.jsx
import React, { useContext } from "react";
import { Link } from "react-router-dom";
import DisplayRating from "./DisplayRating.jsx";
import { RatingsContext } from "../context/RatingsContext.jsx";

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

const SeriesCard = ({ series, showRemove = false, onRemove = () => { } }) => {
  const posterUrl = series.poster_path
    ? `${IMAGE_BASE_URL}${series.poster_path}`
    : "https://placehold.co/500x750/1d232a/e0e0e0?text=Poster+Not+Found";

  const title = series.name || series.title;

  const { ratingsMap } = useContext(RatingsContext) || { ratingsMap: new Map() };
  const userRating = ratingsMap
    ? (ratingsMap.get(series._id?.toString())
      || (series.tvdb ? ratingsMap.get(series.tvdb.toString()) : null)
      || (series.id?.tvdb ? ratingsMap.get(series.id.tvdb.toString()) : null)
      || ratingsMap.get(series._id))
    : null;

  return (
    <div className="card bg-base-100 image-full transition-all duration-300 ease-out transform hover:scale-105 hover:shadow-[0_0_25px_rgba(255,255,255,0.25)] before:transition-opacity before:duration-300 hover:before:opacity-20 group relative overflow-hidden">
      <figure className="w-full h-full">
        <img
          src={posterUrl}
          alt={`${title} poster`}
          className="w-full h-full object-cover filter brightness-75 contrast-90 saturate-90 transition-all duration-300 ease-out group-hover:brightness-110 group-hover:contrast-100 group-hover:saturate-110"
        />
      </figure>
      <div className="card-body justify-end p-4 z-10">

        {showRemove && (
          <button onClick={() => onRemove(series._id)} className="btn btn-circle btn-error btn-xs absolute top-2 right-2 z-20">
            ✕
          </button>
        )}

        <h2 className="card-title text-sm text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          {title}
        </h2>

        <div className="card-actions justify-between items-center mt-2">
          {userRating && userRating > 0 ? (
            <DisplayRating rating={userRating} contentId={series._id} />
          ) : (
            <div></div>
          )}

          <Link to={`/content/series/${series._id}`} className="btn btn-primary btn-xs shadow-md">
            Details
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SeriesCard;