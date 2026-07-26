// src/components/UserSearchCard.jsx (GÜNCELLENMİŞ TAM DOSYA)
import React, { useState, useContext, useEffect } from "react";
import API from "../api/axios";
import { AuthContext } from "../context/AuthContext.jsx";
import { Link } from "react-router-dom";

export default function UserSearchCard({ user }) {
  const { user: loggedInUser } = useContext(AuthContext);
  const token = loggedInUser?.token;

  const [isLoading, setIsLoading] = useState(false);
  const [isFollowed, setIsFollowed] = useState(Boolean(user?.isFollowed));

  // helper: produce an absolute URL or fallback
  const makeAbsolute = (url) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    // prepend axios baseURL if available, else use origin
    const base = (API && API.defaults && API.defaults.baseURL) || window.location.origin;
    return `${base.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
  };

  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    user?.username || "U"
  )}&size=64`;

  // use state so we can swap to fallback on error
  const [avatarSrc, setAvatarSrc] = useState(() => {
    if (user?.profile_pic_url && user.profile_pic_url !== "") {
      return makeAbsolute(user.profile_pic_url);
    }
    return user?.avatar || defaultAvatar;
  });

  // keep avatarSrc in sync when prop changes (e.g. updated from context)
  useEffect(() => {
    if (user?.profile_pic_url && user.profile_pic_url !== "") {
      setAvatarSrc(makeAbsolute(user.profile_pic_url));
    } else if (user?.avatar) {
      setAvatarSrc(user.avatar);
    } else {
      setAvatarSrc(defaultAvatar);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.profile_pic_url, user?.avatar, user?.username]);

  const handleImgError = () => {
    // don't loop: if already fallback, do nothing
    if (avatarSrc === defaultAvatar) return;
    setAvatarSrc(defaultAvatar);
  };

  const handleFollow = async () => {
    if (isFollowed || !token) {
      console.log("No token or already followed.");
      return;
    }

    setIsLoading(true);
    try {
      await API.post(
        `/users/${user._id}/follow`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsFollowed(true);
    } catch (err) {
      console.error("Follow error:", err);
      if (err.response && err.response.status === 400) {
        setIsFollowed(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl border border-base-300">
      <div className="card-body p-4 flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${user._id || user.id}`} className="flex items-center gap-3">
            <div className="avatar">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
                <img
                  src={avatarSrc}
                  alt={`${user.username || "User"} avatar`}
                  className="w-full h-full object-cover object-center"
                  onError={handleImgError}
                />
              </div>
            </div>
            <div>
              <div className="font-bold">{user.username}</div>
              {user?.bio && <div className="text-sm text-muted">{user.bio}</div>}
            </div>
          </Link>
        </div>

        <button
          className={`btn btn-circle btn-primary btn-sm ${isFollowed ? "btn-success" : "btn-outline"}`}
          onClick={handleFollow}
          disabled={isLoading || isFollowed}
          aria-pressed={isFollowed}
        >
          {isLoading ? (
            <span className="loading loading-spinner loading-xs" />
          ) : isFollowed ? (
            "✓"
          ) : (
            "+"
          )}
        </button>
      </div>
    </div>
  );
}