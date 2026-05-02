// frontend/src/components/FeedItem.jsx
import React from "react";
import { Link } from "react-router-dom";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w92";
const AVATAR_PLACEHOLDER = "https://placehold.co/40x40/1d232a/e0e0e0?text=?";
const POSTER_PLACEHOLDER = "https://placehold.co/92x138/1d232a/e0e0e0?text=?";

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function StarBar({ value }) {
  const filled = Math.round(value / 2);
  return (
    <span className="inline-flex gap-0.5 text-warning text-sm">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i}>{i < filled ? "★" : "☆"}</span>
      ))}
      <span className="ml-1 text-base-content/70 text-xs font-semibold">{value}/10</span>
    </span>
  );
}

function Avatar({ user }) {
  return (
    <Link to={`/profile/${user._id}`} className="flex-shrink-0">
      <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-base-300">
        <img
          src={user.profile_pic_url || AVATAR_PLACEHOLDER}
          alt={user.username}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.src = AVATAR_PLACEHOLDER; }}
        />
      </div>
    </Link>
  );
}

function Poster({ content }) {
  if (!content) return null;
  return (
    <Link to={`/content/${content.type}/${content.id}`} className="flex-shrink-0">
      <div className="w-10 h-14 rounded overflow-hidden ring-1 ring-base-300 hover:ring-primary transition-all">
        <img
          src={content.poster_path ? `${TMDB_IMAGE_BASE}${content.poster_path}` : POSTER_PLACEHOLDER}
          alt={content.title}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.src = POSTER_PLACEHOLDER; }}
        />
      </div>
    </Link>
  );
}

function ContentLink({ content }) {
  if (!content) return null;
  return (
    <Link
      to={`/content/${content.type}/${content.id}`}
      className="font-semibold text-primary hover:underline"
    >
      {content.title}
    </Link>
  );
}

function UserLink({ user }) {
  return (
    <Link to={`/profile/${user._id}`} className="font-semibold hover:underline">
      {user.username}
    </Link>
  );
}

function ActivityText({ item }) {
  switch (item.type) {
    case "rated":
      return (
        <span>
          <UserLink user={item.user} /> rated <ContentLink content={item.content} />
          <span className="ml-2 inline-block">
            <StarBar value={item.value} />
          </span>
        </span>
      );
    case "reviewed":
      return (
        <span>
          <UserLink user={item.user} /> wrote a review for <ContentLink content={item.content} />
          {item.excerpt && (
            <span className="block mt-1 text-sm text-base-content/60 italic line-clamp-2">
              "{item.excerpt}{item.excerpt?.length >= 150 ? "…" : ""}"
            </span>
          )}
        </span>
      );
    case "watchlisted":
      return (
        <span>
          <UserLink user={item.user} /> added <ContentLink content={item.content} /> to their watchlist
        </span>
      );
    case "followed":
      return (
        <span>
          <UserLink user={item.user} /> started following{" "}
          {item.targetUser ? <UserLink user={item.targetUser} /> : "someone"}
        </span>
      );
    default:
      return null;
  }
}

function ActivityIcon({ type }) {
  const icons = {
    rated: "⭐",
    reviewed: "✍️",
    watchlisted: "🎬",
    followed: "👥",
  };
  return (
    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-base-200 text-[10px] flex items-center justify-center">
      {icons[type] || "•"}
    </span>
  );
}

export default function FeedItem({ item }) {
  return (
    <div className="flex items-start gap-3 py-3 px-4 rounded-xl hover:bg-base-200/60 transition-colors">
      <div className="relative flex-shrink-0">
        <Avatar user={item.user} />
        <ActivityIcon type={item.type} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug text-base-content">
          <ActivityText item={item} />
        </p>
        <p className="text-xs text-base-content/40 mt-0.5">{timeAgo(item.createdAt)}</p>
      </div>

      {item.content && <Poster content={item.content} />}
    </div>
  );
}
