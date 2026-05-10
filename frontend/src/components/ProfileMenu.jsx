import React, { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export default function ProfileMenu({ onLogout }) {
  const { user } = useContext(AuthContext);

  const avatarSrc =
    user?.profile_pic_url && user.profile_pic_url !== ""
      ? user.profile_pic_url
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.username || "U")}&size=128`;

  return (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
        <div className="w-9 h-9 rounded-full ring ring-primary ring-offset-2 overflow-hidden bg-gray-200">
          <img
            src={avatarSrc}
            alt="avatar"
            className="w-full h-full object-cover object-center"
          />
        </div>
      </label>

      <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 mt-2">
        <li><a href="/network">Network</a></li>
        <li><a href="/watchlist">Watchlist</a></li>
        <li><a href="/my-lists">My Lists</a></li>
        <li><a href="/list">Watched List</a></li>
        <li><a href="/profile">Profile</a></li>
        <li><a href="/settings">Settings</a></li>
        <li><button className="text-error" onClick={onLogout}>Log out</button></li>
      </ul>
    </div>
  );
}