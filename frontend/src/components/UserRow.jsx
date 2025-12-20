// src/components/UserRow.jsx
import React from "react";
import { Link } from "react-router-dom";

/**
 * props:
 * - user: { _id, username } - Gösterilecek kullanıcı objesi
 * - isFollowing: boolean - Bu kullanıcıyı şu anda takip edip etmediğiniz
 * - onToggle: (userId, isCurrentlyFollowing) => void - Takip et/çıkar butonuna basıldığında çağrılacak fonksiyon
 */
export default function UserRow({ user, isFollowing, onToggle }) {
  // Butonun "Unfollow" (Takipten Çık) veya "Follow" (Takip Et) olmasına karar ver
  const buttonText = isFollowing ? "Unfollow" : "Follow";
  const buttonClass = isFollowing ? "btn-outline" : "btn-primary";

  return (
    <tr className="hover:bg-base-200">
      <td>
        <div className="flex items-center gap-3">
          <Link to={`/users/${user._id}`} className="flex items-center gap-3">
            <div className="avatar">
              {user.profile_pic_url ? (
                <div className="w-10 rounded-full overflow-hidden">
                  <img
                    src={user.profile_pic_url}
                    alt={`${user.username}'s avatar`}
                    className="w-10 h-10 object-cover"
                  />
                </div>
              ) : (
                <div className="bg-neutral text-neutral-content rounded-full w-10 h-10 flex items-center justify-center">
                  <span className="text-lg">{user.username?.[0]?.toUpperCase()}</span>
                </div>
              )}
            </div>
            <div>
              <div className="font-bold">{user.username}</div>
            </div>
          </Link>
      </div>
      </td>
      {/* Sağ taraftaki buton için boş bir <th> ekledik */}
      <th className="text-right">
        <button
          className={`btn btn-sm ${buttonClass}`}
          onClick={() => onToggle(user._id, isFollowing)}
        >
          {buttonText}
        </button>
      </th>
    </tr>
  );
}