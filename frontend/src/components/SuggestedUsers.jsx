// frontend/src/components/SuggestedUsers.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import userService from "../api/userService.js";

const AVATAR_PLACEHOLDER = "https://placehold.co/40x40/1d232a/e0e0e0?text=?";

function SuggestionRow({ user, onFollow }) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFollow = async () => {
    setLoading(true);
    try {
      await userService.follow(user._id);
      setFollowing(true);
      onFollow(user._id);
    } catch {
      // already following or error — just mark done
      setFollowing(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 py-2">
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

      <div className="flex-1 min-w-0">
        <Link
          to={`/profile/${user._id}`}
          className="text-sm font-semibold hover:underline block truncate"
        >
          {user.username}
        </Link>
        <p className="text-xs text-base-content/50">
          {user.mutualCount === 1
            ? "1 mutual connection"
            : `${user.mutualCount} mutual connections`}
        </p>
      </div>

      <button
        onClick={handleFollow}
        disabled={loading || following}
        className={`btn btn-xs flex-shrink-0 ${
          following ? "btn-disabled" : "btn-primary"
        }`}
      >
        {following ? "Following" : loading ? "…" : "Follow"}
      </button>
    </div>
  );
}

export default function SuggestedUsers() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userService
      .getSuggestions(5)
      .then((data) => setSuggestions(Array.isArray(data) ? data : []))
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, []);

  const handleFollow = (followedId) => {
    // Keep the row briefly then fade it out
    setTimeout(() => {
      setSuggestions((prev) => prev.filter((u) => u._id !== followedId));
    }, 1200);
  };

  if (loading) {
    return (
      <div className="bg-base-100 rounded-2xl shadow p-4 space-y-3">
        <div className="h-4 w-32 bg-base-300 rounded animate-pulse" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-base-300 animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-base-300 rounded animate-pulse w-2/3" />
              <div className="h-3 bg-base-300 rounded animate-pulse w-1/3" />
            </div>
            <div className="w-14 h-6 bg-base-300 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="bg-base-100 rounded-2xl shadow p-4">
      <h2 className="text-sm font-bold text-base-content mb-3">People you might know</h2>
      <div className="divide-y divide-base-200">
        {suggestions.map((user) => (
          <SuggestionRow key={user._id} user={user} onFollow={handleFollow} />
        ))}
      </div>
      <Link
        to="/network"
        className="block text-center text-xs text-primary hover:underline mt-3"
      >
        See more →
      </Link>
    </div>
  );
}
