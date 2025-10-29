// src/pages/ProfilePage.jsx (GÜNCELLENMİŞ VE TEMİZLENMİŞ TAM DOSYA)

import React, { useState, useEffect, useContext } from "react"; // useMemo'yu sildik
import { toast } from "react-hot-toast";
import { format } from "date-fns";
import { AuthContext } from "../context/AuthContext";
import API from '../api/axios.js';
import MovieCard from '../components/MovieCard.jsx';
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import SeriesCard from '../components/SeriesCard.jsx';
// DisplayRating import'unu sildik, çünkü artık kartların içinde

export default function ProfilePage() {
  const { user } = useContext(AuthContext); 

  // --- State'ler (Ratings state'ini sildik) ---
  const [profile, setProfile] = useState(null);       
  const [favorites, setFavorites] = useState({ movies: [], series: [] });
  // const [ratings, setRatings] = useState([]); // <-- SİLİNDİ
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Bio düzenleme için state'ler
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioText, setBioText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // --- useEffect (fetchData) GÜNCELLENDİ (Sadeleşti) ---
  useEffect(() => {
    if (!user?._id) return; 

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // --- ARTIK SADECE 2 İSTEK ATIYORUZ ---
        const [profileResponse, favoritesResponse] = await Promise.all([
          API.get(`/users/profile/${user._id}`),    // Profil
          API.get(`/users/favorites/${user._id}`), // Favoriler
          // Ratings isteği buradan SİLİNDİ
        ]);

        setProfile(profileResponse.data);
        setFavorites(favoritesResponse.data);
        // setRatings(ratingsResponse.data); // <-- SİLİNDİ
        setBioText(profileResponse.data.bio || ""); 

      } catch (err) {
        console.error("Profil verisi çekilirken hata:", err);
        setError("Profil yüklenemedi. Lütfen daha sonra tekrar deneyin.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?._id]); 

  // --- ratingsMap (useMemo) bloğu buradan SİLİNDİ ---

  
  // Bio'yu kaydetme fonksiyonu (Değişiklik yok)
  const handleSaveBio = async () => {
    setIsSaving(true);
    try {
      const response = await API.patch(`/users/profile/${user._id}/bio`, {
        bio: bioText
      });
      setProfile(response.data);
      setIsEditingBio(false);
      toast.success("Bio güncellendi!");
    } catch (err) {
      console.error("Bio güncellenirken hata:", err);
      toast.error("Hata: Bio güncellenemedi.");
    } finally {
      setIsSaving(false);
    }
  };

  // Bio düzenlemeyi iptal etme (Değişiklik yok)
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
         <div className="avatar mb-4">
           <div className="w-32 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
             <img src={profile?.profilePicUrl || `https://ui-avatars.com/api/?name=${user.username}&size=128`} alt="Profile" />
           </div>
         </div>
         <h1 className="text-3xl font-bold">{profile?.username || user.username}</h1>
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

      {/* --- FAVORİ FİLMLER ALANI (GÜNCELLENDİ) --- */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold mb-4">Favorite Movies</h2>
        
        {favorites.movies && favorites.movies.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            
            {favorites.movies.map((movie) => (
              <div key={movie._id} className="flex-none w-36">
                {/* --- userRating prop'u SİLİNDİ --- */}
                {/* Kart artık oyu global context'ten kendi alıyor */}
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

      {/* --- FAVORİ DİZİLER ALANI (GÜNCELLENDİ) --- */}
      <section className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Favorite Series</h2>
        
        {favorites.series && favorites.series.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            
            {favorites.series.map((series) => (
              <div key={series._id} className="flex-none w-36">
                {/* --- userRating prop'u SİLİNDİ --- */}
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

    </div>
  );
}