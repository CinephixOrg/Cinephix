// frontend/src/components/PopularReviews.jsx
import React, { useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import { useTranslation } from "react-i18next";
import { reviewService } from "../api/reviewService.js";
import toast from "react-hot-toast";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w300";
const POSTER_PLACEHOLDER = "https://placehold.co/300x450/1d232a/e0e0e0?text=No+Poster";
const AVATAR_PLACEHOLDER = "https://placehold.co/24x24/1d232a/e0e0e0?text=?";

function ReviewPosterCard({ review, currentUserId, onLikeToggle }) {
  const { t } = useTranslation();
  const { content, user, text, likeCount: initialLikeCount, hasLiked: initialHasLiked, _id } = review;
  const [likeCount, setLikeCount] = useState(initialLikeCount || 0);
  const [hasLiked, setHasLiked] = useState(initialHasLiked || false);
  const [liking, setLiking] = useState(false);

  const handleLike = async (e) => {
    e.preventDefault();
    if (!currentUserId) return toast.error(t("Log in to like reviews"));
    if (liking) return;
    setLiking(true);
    setHasLiked((p) => !p);
    setLikeCount((p) => p + (hasLiked ? -1 : 1));
    try {
      await reviewService.toggleLike(_id);
    } catch {
      setHasLiked((p) => !p);
      setLikeCount((p) => p + (hasLiked ? 1 : -1));
      toast.error(t("Failed to like review"));
    } finally {
      setLiking(false);
    }
  };

  return (
    <div className="flex-shrink-0 w-40 flex flex-col group">
      {/* Poster */}
      <Link to={`/content/${content.type}/${content.id}`} className="block">
        <div className="relative rounded-xl overflow-hidden ring-1 ring-base-300 group-hover:ring-primary transition-all">
          <img
            src={content.poster_path ? `${TMDB_IMAGE_BASE}${content.poster_path}` : POSTER_PLACEHOLDER}
            alt={content.title}
            className="w-full aspect-[2/3] object-cover"
            onError={(e) => { e.target.src = POSTER_PLACEHOLDER; }}
          />
          {/* Like badge */}
          <div className="absolute top-1.5 right-1.5 bg-black/70 text-white text-xs font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
            <span className="text-rose-400">♥</span>
            {likeCount}
          </div>
          {/* Type badge */}
          <div className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 bg-black/50">
            <span className="text-xs text-white/70 capitalize">{content.type}</span>
          </div>
        </div>
      </Link>

      {/* Below poster */}
      <div className="mt-2 px-0.5 flex flex-col gap-1.5 flex-1">
        <Link to={`/content/${content.type}/${content.id}`}>
          <p className="text-xs font-semibold text-base-content line-clamp-1 leading-tight hover:text-primary transition-colors">
            {content.title}
          </p>
        </Link>

        {/* Reviewer */}
        <Link to={`/profile/${user?._id}`} className="flex items-center gap-1 hover:opacity-80 transition-opacity">
          <div className="w-4 h-4 rounded-full overflow-hidden ring-1 ring-base-300 flex-shrink-0">
            <img
              src={user?.profile_pic_url || AVATAR_PLACEHOLDER}
              alt={user?.username}
              className="w-full h-full object-cover"
              onError={(e) => { e.target.src = AVATAR_PLACEHOLDER; }}
            />
          </div>
          <span className="text-xs text-base-content/60 truncate">{user?.username}</span>
        </Link>

        {/* Review excerpt */}
        <p className="text-xs text-base-content/70 line-clamp-3 leading-relaxed">{text}</p>

        {/* Like button */}
        <button
          onClick={handleLike}
          disabled={liking}
          className={`mt-auto flex items-center gap-1 text-xs font-medium transition-colors w-fit ${
            hasLiked ? "text-rose-400" : "text-base-content/40 hover:text-rose-400"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={hasLiked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            className="w-3.5 h-3.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          {hasLiked ? t("Liked") : t("Like")}
        </button>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-40">
      <div className="w-full aspect-[2/3] rounded-xl bg-base-300 animate-pulse" />
      <div className="mt-2 space-y-1.5">
        <div className="h-3 bg-base-300 rounded animate-pulse w-full" />
        <div className="h-3 bg-base-300 rounded animate-pulse w-2/3" />
        <div className="h-3 bg-base-300 rounded animate-pulse w-full" />
        <div className="h-3 bg-base-300 rounded animate-pulse w-4/5" />
      </div>
    </div>
  );
}

export default function PopularReviews() {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    reviewService
      .getPopularReviews(10)
      .then((data) => setReviews(Array.isArray(data) ? data : data?.data || []))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, []);

  const scroll = (dir) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 300, behavior: "smooth" });
    }
  };

  if (!loading && reviews.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-base-content">{t("Popular reviews")}</h2>
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
          : reviews.map((review, i) => (
              <ReviewPosterCard
                key={`${review._id}-${i}`}
                review={review}
                currentUserId={user?._id}
              />
            ))}
      </div>
    </section>
  );
}
