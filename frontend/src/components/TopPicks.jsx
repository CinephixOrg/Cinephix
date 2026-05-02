// frontend/src/components/TopPicks.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import feedService from "../api/feedService.js";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w300";
const POSTER_PLACEHOLDER = "https://placehold.co/300x450/1d232a/e0e0e0?text=No+Poster";
const AVATAR_PLACEHOLDER = "https://placehold.co/24x24/1d232a/e0e0e0?text=?";

function RaterAvatars({ raters }) {
  return (
    <div className="flex -space-x-2">
      {raters.map((r) => (
        <div
          key={r._id}
          className="w-5 h-5 rounded-full overflow-hidden ring-1 ring-base-100"
          title={r.username}
        >
          <img
            src={r.profile_pic_url || AVATAR_PLACEHOLDER}
            alt={r.username}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.src = AVATAR_PLACEHOLDER; }}
          />
        </div>
      ))}
    </div>
  );
}

function PickCard({ pick }) {
  const { content, avgRating, raterCount, topRaters } = pick;
  return (
    <Link
      to={`/content/${content.type}/${content.id}`}
      className="flex-shrink-0 w-32 group"
    >
      <div className="relative rounded-xl overflow-hidden ring-1 ring-base-300 group-hover:ring-primary transition-all">
        <img
          src={content.poster_path ? `${TMDB_IMAGE_BASE}${content.poster_path}` : POSTER_PLACEHOLDER}
          alt={content.title}
          className="w-full aspect-[2/3] object-cover"
          onError={(e) => { e.target.src = POSTER_PLACEHOLDER; }}
        />
        {/* Rating badge */}
        <div className="absolute top-1.5 right-1.5 bg-black/70 text-white text-xs font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
          <span className="text-warning">★</span>
          {avgRating}
        </div>
      </div>

      <div className="mt-2 px-0.5">
        <p className="text-xs font-semibold text-base-content line-clamp-2 leading-tight">
          {content.title}
        </p>
        <div className="flex items-center gap-1 mt-1">
          <RaterAvatars raters={topRaters} />
          <span className="text-xs text-base-content/50">
            {raterCount === 1 ? "1 rating" : `${raterCount} ratings`}
          </span>
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-32">
      <div className="w-full aspect-[2/3] rounded-xl bg-base-300 animate-pulse" />
      <div className="mt-2 space-y-1.5">
        <div className="h-3 bg-base-300 rounded animate-pulse w-full" />
        <div className="h-3 bg-base-300 rounded animate-pulse w-2/3" />
      </div>
    </div>
  );
}

export default function TopPicks() {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    feedService
      .getTopPicks(10)
      .then((data) => setPicks(Array.isArray(data) ? data : []))
      .catch(() => setPicks([]))
      .finally(() => setLoading(false));
  }, []);

  const scroll = (dir) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 300, behavior: "smooth" });
    }
  };

  if (!loading && picks.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-base-content">
          Your network's top picks
        </h2>
        <div className="flex gap-1">
          <button
            onClick={() => scroll(-1)}
            className="btn btn-ghost btn-xs text-base-content/50"
            aria-label="Scroll left"
          >
            ←
          </button>
          <button
            onClick={() => scroll(1)}
            className="btn btn-ghost btn-xs text-base-content/50"
            aria-label="Scroll right"
          >
            →
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : picks.map((pick, i) => <PickCard key={`${pick.content.id}-${i}`} pick={pick} />)}
      </div>
    </section>
  );
}
