// frontend/src/components/ReviewCard.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { reviewService } from "../api/reviewService.js";
import toast from "react-hot-toast";

const AVATAR_PLACEHOLDER = "https://placehold.co/40x40/1d232a/e0e0e0?text=?";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w92";
const POSTER_PLACEHOLDER = "https://placehold.co/92x138/1d232a/e0e0e0?text=?";

export default function ReviewCard({
  review,
  currentUserId,
  onDelete,
  showContent = false,
}) {
  const [likeCount, setLikeCount] = useState(review.likeCount || 0);
  const [hasLiked, setHasLiked] = useState(review.hasLiked || false);
  const [liking, setLiking] = useState(false);

  const handleLike = async () => {
    if (!currentUserId) return toast.error("Log in to like reviews");
    if (liking) return;
    setLiking(true);
    // Optimistic update
    setHasLiked((prev) => !prev);
    setLikeCount((prev) => prev + (hasLiked ? -1 : 1));
    try {
      await reviewService.toggleLike(review._id);
    } catch {
      // Revert on error
      setHasLiked((prev) => !prev);
      setLikeCount((prev) => prev + (hasLiked ? 1 : -1));
      toast.error("Failed to like review");
    } finally {
      setLiking(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    try {
      await reviewService.deleteReview(review._id, review.contentId);
      onDelete(review._id);
      toast.success("Review deleted");
    } catch {
      toast.error("Failed to delete review");
    }
  };

  const isOwn = currentUserId && review.user?._id === currentUserId;

  return (
    <div className="bg-base-100 rounded-2xl p-4 shadow-sm border border-base-200 flex flex-col gap-3">
      {/* Content info (for homepage popular reviews) */}
      {showContent && review.content && (
        <Link
          to={`/content/${review.content.type}/${review.content.id}`}
          className="flex items-center gap-3 pb-3 border-b border-base-200 hover:opacity-80 transition-opacity"
        >
          <img
            src={
              review.content.poster_path
                ? `${TMDB_IMAGE_BASE}${review.content.poster_path}`
                : POSTER_PLACEHOLDER
            }
            alt={review.content.title}
            className="w-9 h-14 object-cover rounded-md flex-shrink-0"
            onError={(e) => { e.target.src = POSTER_PLACEHOLDER; }}
          />
          <div className="min-w-0">
            <p className="text-xs font-bold text-base-content line-clamp-2 leading-tight">
              {review.content.title}
            </p>
            <p className="text-xs text-base-content/40 capitalize mt-0.5">
              {review.content.type}
            </p>
          </div>
        </Link>
      )}

      {/* Reviewer header */}
      <div className="flex items-center justify-between gap-2">
        <Link
          to={`/users/${review.user?._id}`}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-base-300">
            <img
              src={review.user?.profile_pic_url || AVATAR_PLACEHOLDER}
              alt={review.user?.username}
              className="w-full h-full object-cover"
              onError={(e) => { e.target.src = AVATAR_PLACEHOLDER; }}
            />
          </div>
          <span className="text-sm font-semibold text-base-content">
            {review.user?.username || "Unknown"}
          </span>
        </Link>
        <span className="text-xs text-base-content/40 flex-shrink-0">
          {review.createdAt
            ? formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })
            : ""}
        </span>
      </div>

      {/* Review text */}
      <p className="text-sm text-base-content/80 whitespace-pre-wrap break-words leading-relaxed">
        {review.text}
      </p>

      {/* Footer: like + delete */}
      <div className="flex items-center justify-between mt-1">
        <button
          onClick={handleLike}
          disabled={liking}
          className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg transition-colors ${
            hasLiked
              ? "text-primary bg-primary/10"
              : "text-base-content/50 hover:text-primary hover:bg-primary/5"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={hasLiked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            className="w-4 h-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
          {likeCount > 0 && <span>{likeCount}</span>}
          <span>{hasLiked ? "Liked" : "Like"}</span>
        </button>

        {isOwn && onDelete && (
          <button
            onClick={handleDelete}
            className="text-xs text-error/60 hover:text-error transition-colors px-2 py-1 rounded-lg hover:bg-error/5"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
