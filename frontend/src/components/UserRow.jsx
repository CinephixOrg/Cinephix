// src/components/UserRow.jsx
import React from "react";

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
          <div className="avatar placeholder">
            <div className="bg-neutral text-neutral-content rounded-full w-10">
              {/* Kullanıcının adının ilk harfini al, büyük harf yap */}
              <span className="text-lg">{user.username?.[0]?.toUpperCase()}</span>
            </div>
          </div>
          <div>
            <div className="font-bold">{user.username}</div>
            {/* Buraya isterseniz kullanıcının tam adını vs. ekleyebilirsiniz */}
          </div>
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