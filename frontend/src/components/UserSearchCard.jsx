// src/components/UserSearchCard.jsx (GÜNCELLENMİŞ TAM DOSYA)
import React, { useState, useContext } from 'react';
import API from '../api/axios'; // Sizin özel API (axios) importunuz

// 1. DEĞİŞİKLİK: AuthContext'i doğru yoldan import edin
import { AuthContext } from '../context/AuthContext.jsx'; 

export default function UserSearchCard({ user }) {
  // 2. DEĞİŞİKLİK: 'token' yerine 'user' objesini alın
  // 'user' prop'u ile çakışmasın diye 'loggedInUser' olarak yeniden adlandırdık
  const { user: loggedInUser } = useContext(AuthContext); 
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFollowed, setIsFollowed] = useState(false); 

  // 3. DEĞİŞİKLİK: Token'ı 'user' objesinin içinden alın
  const token = loggedInUser?.token;

  const handleFollow = async () => {
    // 4. DEĞİŞİKLİK: Bu token kontrolü artık DOĞRU çalışacak
    if (isFollowed || !token) {
      console.log("Token bulunamadı veya zaten takip ediliyor.");
      return; 
    }

    setIsLoading(true);
    try {
      // 5. DEĞİŞİKLİK: '/api' önekini kaldırın (baseURL'de zaten var)
      await API.post(`/users/${user._id}/follow`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Başarılı olursa, butonu '✓' (onay işareti) yap
      setIsFollowed(true); 

    } catch (err) {
      console.error("Takip etme hatası:", err);
      // Eğer hata "Zaten takip ediyorsunuz" (400) ise, butonu yine de '✓' yap
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
          <div className="avatar placeholder">
            <div className="bg-neutral text-neutral-content rounded-full w-10">
              <span className="text-lg">{user.username?.[0]?.toUpperCase()}</span>
            </div>
          </div>
          <span className="font-bold">{user.username}</span>
        </div>
        
        {/* Takip Et Butonu (+ veya ✓) */}
        <button
          className={`btn btn-circle btn-primary btn-sm ${isFollowed ? 'btn-success' : 'btn-outline'}`}
          onClick={handleFollow}
          disabled={isLoading || isFollowed}
        >
          {isLoading 
            ? <span className="loading loading-spinner loading-xs" />
            : isFollowed 
            ? '✓' // Takip edildiyse Checkmark
            : '+'  // Takip edilmediyse Artı
          }
        </button>
      </div>
    </div>
  );
}