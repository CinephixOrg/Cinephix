import React, { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export default function ProfileMenu({ onLogout }) {
  const { user } = useContext(AuthContext); // `AuthContext`'ten `user` nesnesini alın

  return (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
        <div className="w-9 rounded-full ring ring-primary ring-offset-2">
          <img
            src={user?.profile_pic_url}
            alt="avatar"
          />
        </div>
      </label>
      <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 mt-2">
        <li><a href="/network">Network</a></li>
        <li><a href="/list">Watchedlist</a></li>
        <li><a href="/reviews">Reviews</a></li>
        <li><a href="/profile">Profile</a></li>
        <li><a href="/settings">Settings</a></li>
        <li><button className="text-error" onClick={onLogout}>Log out</button></li>
      </ul>
    </div>
  );
}