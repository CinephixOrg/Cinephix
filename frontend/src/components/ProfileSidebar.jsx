import React from "react";

export default function ProfileSidebar({ open, onClose, user, onSelect }) {
  return (
    <div
      data-theme="forest"
      className={`${
        open ? "translate-x-0" : "translate-x-full"
      } fixed top-0 right-0 h-full w-80 bg-base-100 shadow-2xl border-l border-base-300 transition-transform duration-300 z-50`}
    >
      {/* Üst bölüm */}
      <div className="p-4 border-b border-base-300 flex items-center justify-between bg-base-200">
        <div className="flex items-center gap-3">
            <div className="avatar">
              <div className="ring-primary ring-offset-base-100 w-9 rounded-full ring ring-offset-2">
                <img src={user?.profile_pic_url} alt="Profile Picture" />
                {user.username?.[0]?.toUpperCase()}
              </div>
            </div>
          <div>
            <div className="font-semibold text-base-content">
              {user?.username || "Guest"}
            </div>
            <div className="text-xs text-base-content/70">
              {user?.email || "Not logged in"}
            </div>
          </div>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={onClose}>
          ✕
        </button>
      </div>

      {/* Menü */}
      <nav className="p-4 flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-2">
          <li>
            <button
              className="w-full justify-start btn btn-ghost"
              onClick={() => onSelect("movies")}
            >
              Movies
            </button>
          </li>
          <li>
            <button
              className="w-full justify-start btn btn-ghost"
              onClick={() => onSelect("series")}
            >
              Series
            </button>
          </li>
          <li>
            <button
              className="w-full justify-start btn btn-ghost"
              onClick={() => onSelect("following")}
            >
              Followings
            </button>
          </li>
          <li>
            <button
              className="w-full justify-start btn btn-ghost"
              onClick={() => onSelect("followers")}
            >
              Followers
            </button>
          </li>
          <li>
            <button
              className="w-full justify-start btn btn-ghost"
              onClick={() => onSelect("settings")}
            >
              Settings
            </button>
          </li>
          <li>
            <button
              className="w-full justify-start btn btn-ghost"
              onClick={() => onSelect("avatar")}
            >
              Avatar
            </button>
          </li>
        </ul>
      </nav>

      {/* Alt kısım */}
      <div className="p-4 border-t border-base-300 text-sm text-base-content/70 bg-base-200 text-center">
        © Cinephix
      </div>
    </div>
  );
}
