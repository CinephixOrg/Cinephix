import React from "react";
import { Link } from "react-router-dom";

const TMDB_IMG = "https://image.tmdb.org/t/p/w92";
const AVATAR_PLACEHOLDER = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "U")}&size=32`;

export default function PublicListCard({ list }) {
  const { _id, name, description, owner, items = [], fromFollowing } = list;

  // Show up to 4 item poster thumbnails (we only have itemId, not poster — show count instead)
  const itemCount = items.length;

  return (
    <Link
      to={`/lists/${_id}`}
      className="card bg-base-100 shadow hover:shadow-md transition hover:border-primary border border-transparent"
    >
      <div className="card-body p-4 gap-2">
        {/* Owner row */}
        <div className="flex items-center gap-2">
          <img
            src={owner.profile_pic_url || AVATAR_PLACEHOLDER(owner.username)}
            alt={owner.username}
            className="w-6 h-6 rounded-full object-cover"
            onError={(e) => { e.target.src = AVATAR_PLACEHOLDER(owner.username); }}
          />
          <span className="text-xs text-base-content/50">{owner.username}</span>
          {fromFollowing && (
            <span className="badge badge-xs badge-primary ml-auto">Following</span>
          )}
        </div>

        {/* List name */}
        <h3 className="font-semibold text-base leading-tight line-clamp-2">{name}</h3>

        {description && (
          <p className="text-xs text-base-content/50 line-clamp-2">{description}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-base-content/40">
            {itemCount} item{itemCount !== 1 ? "s" : ""}
          </span>
          <span className="badge badge-ghost badge-xs">Public</span>
        </div>
      </div>
    </Link>
  );
}
