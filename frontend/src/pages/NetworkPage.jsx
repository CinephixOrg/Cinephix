// src/pages/NetworkPage.jsx (GÜNCELLENMİŞ TAM DOSYA)

import React, { useState, useEffect, useMemo, useContext } from "react";
import { useLocation } from "react-router-dom"; 
// 1. DEĞİŞİKLİK: 'axios' yerine kendi 'API' dosyanızı import edin
import API from "../api/axios.js"; // (ProfilePage.jsx'ten yol varsayımı)
import UserRow from "../components/UserRow"; 
import { AuthContext } from "../context/AuthContext.jsx"; 

export default function NetworkPage() {
  // 2. DEĞİŞİKLİK: 'token' yerine 'user' objesini alın
  const { user } = useContext(AuthContext); 
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  
  const activeTab = params.get('tab') || 'following'; 

  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 3. DEĞİŞİKLİK: Token'ı 'user' objesinin içinden alın
  const token = user?.token;

  // Hem takipçileri hem de takip edilenleri çeken ana fonksiyon
  const fetchLists = async () => {
    if (!token) { 
      setError("Bu sayfayı görmek için giriş yapmanız gerekiyor.");
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    try {
      // 4. DEĞİŞİKLİK: 'axios.get' yerine 'API.get' kullanın
      // ve /api/ önekini kaldırın (baseURL'de zaten var)
      const [followersRes, followingRes] = await Promise.all([
        API.get("/users/me/followers", { headers }),
        API.get("/users/me/following", { headers }),
      ]);

      setFollowers(followersRes.data);
      setFollowing(followingRes.data);
    } catch (err) {
      console.error("NetworkPage Listeleri çekilirken hata:", err);
      setError("Veriler yüklenirken bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  // 5. DEĞİŞİKLİK: useEffect'in 'token' değişkenine bağlanması
  useEffect(() => {
    fetchLists();
  }, [token]); // 'token' (user?.token) değiştiğinde veya yüklendiğinde çalışır

  // Takip et/çıkar butonu
  const handleFollowToggle = async (userId, isCurrentlyFollowing) => {
    if (!token) return; 

    // 6. DEĞİŞİKLİK: /api/ önekini kaldırın
    const endpoint = isCurrentlyFollowing
      ? `/users/${userId}/unfollow`
      : `/users/${userId}/follow`;

    try {
      // 7. DEĞİŞİKLİK: 'axios.post' yerine 'API.post' kullanın
      await API.post(endpoint, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchLists();
    } catch (err) {
      console.error("Takip işlemi hatası:", err);
      alert("İşlem başarısız oldu.");
    }
  };

  // Kodun geri kalanı (useMemo ve return) aynı
  const followingIdSet = useMemo(() => 
    new Set(following.map(user => user._id)), 
    [following]
  );

  const displayedUsers = activeTab === "following" ? following : followers;

  return (
    <div className="p-4 md:p-8">
      {/* Sekmeler (Değişiklik yok) */}
      <div role="tablist" className="tabs tabs-boxed mb-6">
        <a
          role="tab"
          className={`tab ${activeTab === "following" ? "tab-active" : ""}`}
          href="/network?tab=following"
        >
          Following ({following.length})
        </a>
        <a
          role="tab"
          className={`tab ${activeTab === "followers" ? "tab-active" : ""}`}
          href="/network?tab=followers"
        >
          Followers ({followers.length})
        </a>
        <a
          role="tab"
          className={`tab ${activeTab === "blocked" ? "tab-active" : ""}`}
          href="/network?tab=blocked"
        >
          Blocked
        </a>
      </div>

      {/* İçerik Alanı (Değişiklik yok) */}
      <div>
        {loading && (
          <div className="text-center p-10">
            <span className="loading loading-spinner loading-lg"></span>
            <p>Yükleniyor...</p>
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="alert alert-error">
            <span>{error}</span>
          </div>
        )}
        
        {!loading && !error && activeTab === "blocked" && (
           <div className="text-center p-10 text-base-content/70">
            Engellenen kullanıcı bulunmuyor.
          </div>
        )}

        {!loading && !error && (activeTab === "following" || activeTab === "followers") && (
          <>
            {displayedUsers.length === 0 ? (
              <div className="text-center p-10 text-base-content/70">
                {activeTab === "following" ? "Kimseyi takip etmiyorsunuz." : "Henüz takipçiniz yok."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedUsers.map((user) => (
                      <UserRow
                        key={user._id}
                        user={user}
                        isFollowing={activeTab === "following" || followingIdSet.has(user._id)}
                        onToggle={handleFollowToggle}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}