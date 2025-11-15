// src/pages/ProfilePage.jsx (FAVORİLER BÖLÜMÜ DÜZELTİLMİŞ TAM DOSYA)

import React, { useState, useEffect, useContext } from "react";
import { toast } from "react-hot-toast";
import { format } from "date-fns";
import { AuthContext } from "../context/AuthContext";
import API from '../api/axios.js';
import MovieCard from '../components/MovieCard.jsx';
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import SeriesCard from '../components/SeriesCard.jsx';
import CineGraph from "../components/CineGraph.jsx"; // CineGraph component'ini import et

export default function ProfilePage() {
  const { user } = useContext(AuthContext);

  // --- State'ler GÜNCELLENDİ ---
  const [profile, setProfile] = useState(null);
  const [favorites, setFavorites] = useState({ movies: [], series: [] });
  const [cineGraphData, setCineGraphData] = useState(null); // <-- CINEGRAPH VERİSİ
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profilePic, setProfilePic] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Bio state'leri (Değişiklik yok)
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioText, setBioText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // --- useEffect (fetchData) GÜNCELLENDİ (CineGraph eklendi) ---
  useEffect(() => {
    if (!user?._id) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // --- ARTIK 3 İSTEK ATIYORUZ ---
        const [profileResponse, favoritesResponse, cineGraphResponse] = await Promise.all([
          API.get(`/users/profile/${user._id}`),    // 1: Profil
          API.get(`/users/favorites/${user._id}`), // 2: Favoriler
          API.get(`/users/me/cinegraph`)            // 3: YENİ: CineGraph verisi
        ]);

        setProfile(profileResponse.data);
        setFavorites(favoritesResponse.data);
        setCineGraphData(cineGraphResponse.data); // <-- YENİ STATE'İ AYARLA
        
        setBioText(profileResponse.data.bio || "");
        setProfilePic(profileResponse.data.profile_pic_url); 

      } catch (err) {
        console.error("Profil verisi çekilirken hata:", err);
        setError("Profil yüklenemedi. Lütfen daha sonra tekrar deneyin.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?._id]);

  // Profil resmi yükleme fonksiyonu (Değişiklik yok)
  const handleUploadProfilePic = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("profilePic", file);
    setIsUploading(true);
    try {
      const response = await API.post(`/users/profile/${user._id}/upload-profile-pic`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProfilePic(response.data.profilePicUrl);
      toast.success("Profil resmi başarıyla güncellendi!");
    } catch (error) {
      console.error("Profil resmi yüklenirken hata:", error);
      toast.error("Profil resmi yüklenemedi.");
    } finally {
      setIsUploading(false);
    }
  };

  // Bio kaydetme (Değişiklik yok)
  const handleSaveBio = async () => {
    setIsSaving(true);
    try {
      const response = await API.patch(`/users/profile/${user._id}/bio`, { bio: bioText });
      setProfile(response.data);
      setIsEditingBio(false);
      toast.success("Bio güncellendi!");
    } catch (err) { console.error("Bio güncellenirken hata:", err); toast.error("Hata: Bio güncellenemedi."); }
    finally { setIsSaving(false); }
  };

  // Bio iptal (Değişiklik yok)
  const handleCancelEdit = () => {
    setIsEditingBio(false);
    setBioText(profile.bio || "");
  };

  // Yüklenme ve Hata durumları (Değişiklik yok)
  if (loading) return <LoadingSpinner />;
  if (error) return <div className="alert alert-error max-w-lg mx-auto mt-10">{error}</div>;

  // Render
  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-8 animate-fade-in">

      {/* --- Profil Bilgileri Alanı (Değişiklik yok) --- */}
      <section className="bg-base-100 p-8 rounded-lg shadow-lg flex flex-col items-center">
        <div className="avatar mb-4 relative">
          {isUploading && (
            <div className="absolute inset-0 flex justify-center items-center bg-black bg-opacity-50 rounded-full z-10">
              <span className="loading loading-spinner loading-md"></span>
            </div>
          )}
          <div className="w-32 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
            <img 
              src={profilePic || `https://ui-avatars.com/api/?name=${user.username}&size=128`} 
              alt="Profile" 
            />
          </div>
        </div>
        <input
          type="file"
          accept="image/*"
          className="file-input file-input-bordered file-input-xs w-full max-w-xs"
          onChange={(e) => handleUploadProfilePic(e.target.files[0])}
          disabled={isUploading}
        />
        <h1 className="text-3xl font-bold mt-4">{profile?.username || user.username}</h1>
        <p className="text-sm text-base-content/70 mt-2">
          {profile?.createdAt ?
            `Joined on ${format(new Date(profile.createdAt), "MMMM d, yyyy")}` :
            "Joined recently"
          }
        </p>
        <div className="w-full max-w-lg mt-6 text-center">
          {isEditingBio ? (
            <div className="flex flex-col gap-2">
              <textarea
                className="textarea textarea-bordered w-full"
                rows="3"
                value={bioText}
                onChange={(e) => setBioText(e.target.value)}
                placeholder="Write something about yourself..."
              ></textarea>
              <div className="flex justify-center gap-2">
                <button
                  className={`btn btn-sm btn-primary ${isSaving ? 'loading' : ''}`}
                  onClick={handleSaveBio}
                  disabled={isSaving}
                >
                  Save
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="relative group">
              <p className="text-base-content/80 min-h-[4rem] whitespace-pre-wrap break-words">
                {profile?.bio || "No bio yet."}
              </p>
              <button
                className="btn btn-ghost btn-sm btn-circle absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setIsEditingBio(true)}
              >
                ✏️
              </button>
            </div>
          )}
        </div>
      </section>

      {/* --- YENİ: CineGraph Bölümü --- */}
      <section className="mt-12">
        <h2 className="text-3xl font-bold mb-6 text-center">CineGraph</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {cineGraphData ? (
            <>
              <CineGraph 
                data={cineGraphData.movieStats} 
                title="Watchlist Movie Genres" 
              />
              <CineGraph 
                data={cineGraphData.seriesStats} 
                title="Watchlist Series Genres" 
              />
            </>
          ) : (
            <div className="text-center p-6 bg-base-100 rounded-lg shadow-inner col-span-2">
               <p className="text-base-content/70">No CineGraph data available.</p>
            </div>
          )}
        </div>
      </section>
      {/* --- BİTİŞ: CineGraph Bölümü --- */}


      {/* --- DÜZELTME: FAVORİ FİLMLER ALANI (GERİ GETİRİLDİ) --- */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold mb-4">Favorite Movies</h2>
        {/* favorites.movies objesinin varlığını ve uzunluğunu kontrol et */}
        {favorites && favorites.movies && favorites.movies.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {favorites.movies.map((movie) => (
              <div key={movie._id} className="flex-none w-36">
                <MovieCard movie={movie} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-6 bg-base-100 rounded-lg shadow-inner">
            <p className="text-base-content/70">No favorite movies added yet.</p>
          </div>
        )}
      </section>
      {/* --- BİTİŞ: FAVORİ FİLMLER --- */}

      {/* --- DÜZELTME: FAVORİ DİZİLER ALANI (GERİ GETİRİLDİ) --- */}
      <section className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Favorite Series</h2>
        {/* favorites.series objesinin varlığını ve uzunluğunu kontrol et */}
        {favorites.series && favorites.series.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {favorites.series.map((series) => (
              <div key={series._id} className="flex-none w-36">
                <SeriesCard series={series} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-6 bg-base-100 rounded-lg shadow-inner">
            <p className="text-base-content/70">No favorite series added yet.</p>
          </div>
        )}
      </section>
      {/* --- BİTİŞ: FAVORİ DİZİLER --- */}

    </div>
  );
}