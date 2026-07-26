// src/pages/ProfilePage.jsx (Using service layer)

import React, { useState, useEffect, useContext } from "react";
import { ShareSelectionModal } from '../components/common';
import dmService from '../api/dmService';
import { AuthContext } from "../context/AuthContext";
import { toast } from "react-hot-toast";
import { format } from "date-fns";
import { userService } from '../api/userService.js';
import { matchService } from '../api/matchService.js';
import { getCacheItem, CACHE_KEYS } from '../api/cacheService.js';
import MovieCard from '../components/MovieCard.jsx';
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import SeriesCard from '../components/SeriesCard.jsx';
import CineGraph from "../components/CineGraph.jsx"; // CineGraph component'ini import et
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user, updateUser } = useContext(AuthContext); // use updateUser from context

  // --- State'ler GÜNCELLENDİ ---
  const [profile, setProfile] = useState(null);
  const [profilePic, setProfilePic] = useState("");
  const [favorites, setFavorites] = useState({ movies: [], series: [] });
  const [cineGraphData, setCineGraphData] = useState(null); // <-- CINEGRAPH VERİSİ
  const [loading, setLoading] = useState(true);
  const [loadingExtras, setLoadingExtras] = useState(true);
  const [error, setError] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false); // <-- YENİ: Görüntüleyici durumu
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  // Profile Analysis feature states
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const handleAnalyzeProfile = async () => {
    setAnalysisLoading(true);
    try {
      const data = await userService.getProfileAnalysis();
      setAnalysisData(data.data || data);
      setIsAnalysisModalOpen(true);
      toast.success(t("Profile analyzed!"));
    } catch (err) {
      console.error("Profile analysis error:", err);
      toast.error(err.message || t("Failed to analyze profile."));
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Bio state'leri (Değişiklik yok)
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioText, setBioText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { userId } = useParams(); // URL'den gelen ID

  // YENİ: Cinematch state'leri
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState(null);

  // Cinematch Filters
  const [matchType, setMatchType] = useState('movie');
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [useCount, setUseCount] = useState(true);
  const [useAvgRating, setUseAvgRating] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Hangi profili göster? URL'den gelen ID varsa onu, yoksa kendi profilin
  const targetUserId = userId || user._id;
  const isOwnProfile = !userId || userId === user._id;

  // Share Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // --- useEffect (fetchData) GÜNCELLENDİ (CineGraph eklendi) ---
  useEffect(() => {
    if (!targetUserId) return;

    const cachedProfile = getCacheItem(CACHE_KEYS.USER(targetUserId));
    const cachedFavorites = getCacheItem(CACHE_KEYS.FAVORITES(targetUserId));
    const cachedCineGraph = getCacheItem(CACHE_KEYS.CINE_GRAPH(targetUserId));

    // If we have cached data, use it immediately
    if (cachedProfile || cachedFavorites || cachedCineGraph) {
      if (cachedProfile) {
        setProfile(cachedProfile);
        setBioText(cachedProfile.bio || "");
        setProfilePic(cachedProfile.profile_pic_url);
        updateUser({ ...cachedProfile });
      }
      if (cachedFavorites) {
        setFavorites(cachedFavorites);
      }
      if (cachedCineGraph) {
        setCineGraphData(cachedCineGraph);
      }
      setLoading(false);
    } else {
      // No cached data, show loading
      setLoading(true);
    }

    setError(null);

    // Always fetch fresh data in background
    const fetchData = async () => {
      try {
        setLoading(true);
        const profileData = await userService.getProfile(targetUserId);
        
        setProfile(profileData);
        setBioText(profileData.bio || "");
        setProfilePic(profileData.profile_pic_url);
        updateUser({ ...profileData });

        if (profileData.isPrivate) {
          setIsAccessDenied(true);
        } else {
          setIsAccessDenied(false);
        }
        
        // Profile header is ready, show it!
        setLoading(false);

        // Fetch the rest asynchronously
        const [favoritesData, cineGraphData] = await Promise.all([
          userService.getFavorites(targetUserId),
          userService.getCineGraphData(targetUserId),
        ]);

        setFavorites(favoritesData);
        setCineGraphData(cineGraphData);
        setLoadingExtras(false);

      } catch (err) {
        setError(t("Profile could not be loaded."));
        console.error("Profile fetch error:", err);
        setLoading(false);
        setLoadingExtras(false);
      }
    };

    fetchData();
  }, [targetUserId]);




  // Bio kaydetme (Değişiklik yok)
  const handleSaveBio = async () => {
    if (!isOwnProfile) return;
    setIsSaving(true);
    try {
      const response = await userService.updateBio(user._id, bioText);
      setProfile(response);
      setIsEditingBio(false);
      toast.success(t("Bio updated!"));
    } catch (err) {
      console.error("Bio güncellenirken hata:", err);
      toast.error(t("Error: Bio could not be updated."));
    }
    finally {
      setIsSaving(false);
    }
  };

  // Bio iptal (Değişiklik yok)
  const handleCancelEdit = () => {
    setIsEditingBio(false);
    setBioText(profile.bio || "");
  };

  // YENİ: Cinematch işlemi
  const handleCinematch = async () => {
    setMatchLoading(true);
    setMatchError(null);
    try {
      console.log(`🎬 Calculating cinematch with user ${profile._id}...`);
      const filters = {
        type: matchType,
        genres: selectedGenres,
        useCount,
        useAvgRating,
      };
      console.log('📋 Filters:', filters);
      const result = await matchService.getMatchWithUser(profile._id, matchType, filters);
      console.log('✅ Cinematch result:', result);
      const data = result.data || result;
      console.log('📊 Setting matchResult:', data);
      setMatchResult(data);
      toast.success(t("Match calculated!"));
    } catch (error) {
      console.error('❌ Cinematch error:', error);
      setMatchError(error.message || t("Error calculating Cinematch"));
      toast.error(error.message || t("Error calculating Cinematch"));
    } finally {
      setMatchLoading(false);
    }
  };

  // Yüklenme ve Hata durumları (Değişiklik yok)
  if (loading) return <LoadingSpinner />;
  if (error) return <div className="alert alert-error max-w-lg mx-auto mt-10">{error}</div>;



  const handleShareProfileAnalysis = async (userIds) => {
    try {
      const message = {
        type: 'analysis_share',
        text: t("{{user}} is sharing their profile analysis with you. Click to view.", { user: user.username }),
        analysisData: { ...analysisData, type: 'profile' } // mark as profile analysis
      };
      
      const promises = userIds.map(async (uid) => {
        const conv = await dmService.getOrCreateConversation(uid);
        return dmService.sendMessage(conv._id, message);
      });
      
      await Promise.all(promises);
      toast.success(t("Analysis shared successfully!"));
      setIsShareModalOpen(false);
    } catch (error) {
      console.error("Error sharing analysis:", error);
      toast.error(t("Failed to share analysis"));
    }
  };

  // Render
  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-8 animate-fade-in">

      {/* --- Profil Bilgileri Alanı (Değişiklik yok) --- */}
      <section className="bg-base-100 p-8 rounded-lg shadow-lg flex flex-col items-center">
        <div className="avatar mb-4 relative">
          <div
            onClick={() => { if (profilePic) setViewerOpen(true); }}
            role="button"
            tabIndex={0}
            className="w-32 h-32 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 overflow-hidden bg-transparent cursor-pointer"
            onKeyDown={(e) => { if (e.key === "Enter") { if (profilePic) setViewerOpen(true); } }}
          >
            <img
              src={profilePic || `https://ui-avatars.com/api/?name=${user.username}&size=128`}
              alt="Profile"
              className="w-full h-full object-cover object-center"
            />
          </div>
        </div>

        {/* {lastSelectedFile && (
          <button className="btn btn-sm btn-outline ml-2" onClick={() => { setSelectedFileForCrop(lastSelectedFile); setIsCropOpen(true); }}>
            Re-edit last
          </button>
        )} */}
        <div className="flex flex-col items-center gap-2 mt-4">
          <h1 className="text-3xl font-bold">{profile?.username || user.username}</h1>
          <div className="flex gap-4 mt-2 text-sm">
            <Link to="/network?tab=followers" className="hover:text-primary transition-colors cursor-pointer">
              <span className="font-bold">{profile?.followers?.length || 0}</span> {t("Followers")}
            </Link>
            <Link to="/network?tab=following" className="hover:text-primary transition-colors cursor-pointer">
              <span className="font-bold">{profile?.following?.length || 0}</span> {t("Following")}
            </Link>

          </div>
          {isOwnProfile && (
            <button
              onClick={handleAnalyzeProfile}
              disabled={analysisLoading}
              className="btn btn-sm btn-primary gap-2 mt-1"
            >
              {analysisLoading ? <span className="loading loading-spinner loading-sm" /> : "✨"}
              {t("Analyze Profile")}
            </button>
          )}
          {!isOwnProfile && !profile?.isPrivate && (
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="btn btn-sm btn-outline gap-2"
                >
                  ⚙️ {t("Filters")}
                </button>
                <button
                  onClick={handleCinematch}
                  disabled={matchLoading}
                  className="btn btn-sm btn-primary gap-2"
                >
                  {matchLoading ? <span className="loading loading-spinner loading-sm"></span> : '🎬'}
                  {t("Cinematch")}
                </button>
              </div>

              {/* Filtreleme seçenekleri */}
              {showFilters && (
                <div className="mt-3 p-4 bg-base-200 rounded-lg space-y-3 w-full max-w-md">
                  {/* Type toggle */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{t("Type:")}</span>
                    <div className="btn-group btn-group-sm">
                      <button
                        className={`btn ${matchType === 'movie' ? 'btn-active' : ''}`}
                        onClick={() => setMatchType('movie')}
                      >
                        🎬 {t("Movie")}
                      </button>
                      <button
                        className={`btn ${matchType === 'series' ? 'btn-active' : ''}`}
                        onClick={() => setMatchType('series')}
                      >
                        📺 {t("Series")}
                      </button>
                    </div>
                  </div>

                  {/* Criteria toggles */}
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useCount}
                        onChange={(e) => setUseCount(e.target.checked)}
                        className="checkbox checkbox-sm"
                      />
                      <span className="text-sm">{t("Use Count")}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useAvgRating}
                        onChange={(e) => setUseAvgRating(e.target.checked)}
                        className="checkbox checkbox-sm"
                      />
                      <span className="text-sm">{t("Use Rating")}</span>
                    </label>
                  </div>

                  {/* Genre selection */}
                  <div>
                    <span className="text-sm font-semibold block mb-2">{t("Genres:")}</span>
                    <div className="flex flex-wrap gap-2">
                      {['Action', 'Drama', 'Comedy', 'Thriller', 'Horror', 'Romance', 'Sci-Fi', 'Fantasy', 'Animation', 'Documentary'].map((genre) => (
                        <button
                          key={genre}
                          onClick={() => {
                            if (selectedGenres.includes(genre)) {
                              setSelectedGenres(selectedGenres.filter(g => g !== genre));
                            } else {
                              setSelectedGenres([...selectedGenres, genre]);
                            }
                          }}
                          className={`btn btn-xs ${selectedGenres.includes(genre) ? 'btn-primary' : 'btn-outline'}`}
                        >
                          {genre}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* YENİ: Match Result Bar */}
              {matchResult && (
                <div role="alert" className="alert alert-info mt-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <span>{t("Your match score is")} <strong>{matchResult.matchPercentage}%</strong> 🎬</span>
                </div>
              )}

              {matchError && (
                <div role="alert" className="alert alert-error mt-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <span>{matchError}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <p className="text-sm text-base-content/70 mt-2">
          {profile?.createdAt ?
            `${t("Joined on")} ${format(new Date(profile.createdAt), "MMMM d, yyyy")}` :
            t("Joined recently")
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
                placeholder={t("Write something about yourself...")}
              ></textarea>
              <div className="flex justify-center gap-2">
                <button
                  className={`btn btn-sm btn-primary ${isSaving ? 'loading' : ''}`}
                  onClick={handleSaveBio}
                  disabled={isSaving}
                >
                  {t("Save")}
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  {t("Cancel")}
                </button>
              </div>
            </div>
          ) : (
            <div className="relative group">
              <p className="text-base-content/80 min-h-[4rem] whitespace-pre-wrap break-words">
                {profile?.bio || (isOwnProfile ? t("No bio yet. Click edit to add one.") : t("No bio."))}
              </p>

              {isOwnProfile && (
                <button
                  className="btn btn-ghost btn-sm btn-circle absolute -top-2 -right-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setIsEditingBio(true)}
                >
                  ✏️
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-3xl font-bold mb-6 text-center">
          {isOwnProfile ? t("My CineGraph") : `${profile?.username || 'User'} - ${t("User's CineGraph")}`}
        </h2>
        {loadingExtras ? (
          <div className="flex justify-center p-12">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : cineGraphData?.isPrivateMasked ? (
          <div className="text-center p-8 bg-base-200 rounded-lg shadow-inner mt-4 border border-base-300">
            <div className="text-4xl mb-2">🔒</div>
            <p className="text-xl font-semibold mb-2">{t("This account is private.")}</p>
            <p className="text-base-content/70">{t("Follow to see detailed lists and genres.")}</p>
            <div className="flex justify-center gap-4 mt-4">
              <div className="badge badge-primary badge-lg">{t("Movies Logged:")} {cineGraphData.totalMovies}</div>
              <div className="badge badge-secondary badge-lg">{t("Series Logged:")} {cineGraphData.totalSeries}</div>
            </div>
          </div>
        ) : (
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
                <p className="text-base-content/70">{t("No CineGraph data available.")}</p>
              </div>
            )}
          </div>
        )}
      </section>
      {/* --- BİTİŞ: CineGraph Bölümü --- */}


      {/* --- DÜZELTME: FAVORİ FİLMLER ALANI (GERİ GETİRİLDİ) --- */}
      <section className="mt-12 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">{t("Favorite Movies")}</h2>
        {loadingExtras ? (
          <div className="flex justify-center p-6">
            <span className="loading loading-spinner loading-md text-primary"></span>
          </div>
        ) : favorites?.isPrivateMasked ? (
          <div className="text-center p-6 bg-base-200 rounded-lg shadow-inner">
            <div className="text-2xl mb-2">🔒</div>
            <p className="text-base-content/70">{t("Follow to see favorite movies.")}</p>
          </div>
        ) : favorites && favorites.movies && favorites.movies.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {favorites.movies.map((movie) => (
              <div key={movie._id} className="flex-none w-36">
                <MovieCard movie={movie} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-6 bg-base-100 rounded-lg shadow-inner">
            <p className="text-base-content/70">{t("No favorite movies added yet.")}</p>
          </div>
        )}
      </section>
      {/* --- BİTİŞ: FAVORİ FİLMLER --- */}

      {/* --- DÜZELTME: FAVORİ DİZİLER ALANI (GERİ GETİRİLDİ) --- */}
      <section className="mt-8">
        <h2 className="text-2xl font-bold mb-4">{t("Favorite Series")}</h2>
        {loadingExtras ? (
          <div className="flex justify-center p-6">
            <span className="loading loading-spinner loading-md text-primary"></span>
          </div>
        ) : favorites?.isPrivateMasked ? (
          <div className="text-center p-6 bg-base-200 rounded-lg shadow-inner">
            <div className="text-2xl mb-2">🔒</div>
            <p className="text-base-content/70">{t("Follow to see favorite series.")}</p>
          </div>
        ) : favorites && favorites.series && favorites.series.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {favorites.series.map((series) => (
              <div key={series._id} className="flex-none w-36">
                <SeriesCard series={series} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-6 bg-base-100 rounded-lg shadow-inner">
            <p className="text-base-content/70">{t("No favorite series added yet.")}</p>
          </div>
        )}
      </section>



      {matchModalOpen && matchResult && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-base-100 rounded-lg shadow-xl p-8 max-w-md w-full">
            <div className="text-center">
              <h3 className="text-3xl font-bold mb-4">🎬 {t("Cinematch Result")}</h3>

              <div className="mb-6">
                <img
                  src={matchResult.targetUser?.profile_pic_url || `https://ui-avatars.com/api/?name=${matchResult.targetUser?.username}&size=80`}
                  alt={matchResult.targetUser?.username}
                  className="w-20 h-20 rounded-full mx-auto mb-3 object-cover"
                />
                <h4 className="text-xl font-semibold">{matchResult.targetUser?.username}</h4>
              </div>

              <div className="mb-6">
                <div className="text-6xl font-bold text-primary mb-2">
                  {matchResult.matchPercentage}%
                </div>
                <div className="text-sm text-base-content/70">{t("Match Percentage")}</div>
              </div>

              {/* Breakdown */}
              {matchResult.breakdown && (
                <div className="mb-6 text-left bg-base-200 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>🎬 {t("Collaborative:")}</span>
                    <span className="font-semibold">{matchResult.breakdown.collaborative}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>📽️ {t("Content-Based:")}</span>
                    <span className="font-semibold">{matchResult.breakdown.contentBased}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>👥 {t("Social:")}</span>
                    <span className="font-semibold">{matchResult.breakdown.social}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>🎭 {t("Diversity:")}</span>
                    <span className="font-semibold">{matchResult.breakdown.diversity}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>⭐ {t("Bonus:")}</span>
                    <span className="font-semibold">{matchResult.breakdown.bonus}%</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  className="btn btn-primary flex-1"
                  onClick={() => setMatchModalOpen(false)}
                >
                  {t("Close")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewerOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-75 p-4">
          <div className="relative max-w-4xl w-full">
            <button
              className="absolute right-2 top-2 btn btn-ghost btn-sm z-50"
              onClick={() => setViewerOpen(false)}
            >
              {t("Close")}
            </button>
            <div className="bg-base-100 p-4 rounded shadow-lg flex flex-col items-center">
              <img
                src={profilePic || `https://ui-avatars.com/api/?name=${user.username}&size=512`}
                alt="Profile large"
                className="max-h-[80vh] object-contain rounded-md"
              />

            </div>
          </div>
        </div>
      )}

      {/* Profile Analysis Modal */}
      {isAnalysisModalOpen && (
        <dialog className="modal modal-open bg-black/60">
          <div className="modal-box w-11/12 max-w-2xl bg-base-100 border border-base-300 shadow-2xl rounded-2xl overflow-hidden p-0">
            <div className="bg-gradient-to-r from-primary to-secondary p-6 text-primary-content relative">
              <button
                onClick={() => setIsAnalysisModalOpen(false)}
                className="btn btn-sm btn-circle btn-ghost absolute right-4 top-4 text-primary-content hover:bg-black/10"
              >
                ✕
              </button>
              <span className="text-xs font-bold tracking-widest uppercase opacity-75">{t("AI Cinematic Persona")}</span>
              <h2 className="text-3xl font-extrabold tracking-tight mt-1">
                {analysisData?.nickname || t("Silent Observer")}
              </h2>
            </div>

            <div className="p-6 space-y-6">
              {analysisData ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="card bg-base-200 border border-base-300 shadow-sm rounded-xl">
                      <div className="card-body p-5">
                        <h4 className="card-title text-xs font-extrabold uppercase tracking-wider text-base-content/50 flex items-center gap-2">
                          🧠 {t("Profile Insights")}
                        </h4>
                        <p className="text-sm text-base-content/95 leading-relaxed mt-1">
                          {analysisData.personalitySummary}
                        </p>
                      </div>
                    </div>

                    <div className="card bg-base-200 border border-base-300 shadow-sm rounded-xl">
                      <div className="card-body p-5">
                        <h4 className="card-title text-xs font-extrabold uppercase tracking-wider text-base-content/50 flex items-center gap-2">
                          💡 {t("Recommended Vibe")}
                        </h4>
                        <p className="text-sm text-base-content/95 leading-relaxed mt-1">
                          {analysisData.recommendedConcept}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-warning/10 border border-warning/20 flex items-start gap-4 shadow-inner">
                    <span className="text-3xl select-none leading-none mt-1">🍿</span>
                    <div>
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-warning-content/85">{t("Did You Know?")}</h4>
                      <p className="text-sm text-base-content/85 mt-1 italic leading-relaxed">
                        "{analysisData.funFact}"
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <span className="loading loading-ring loading-lg text-primary"></span>
                  <p className="text-sm text-base-content/60 mt-2">{t("Aggregating statistics...")}</p>
                </div>
              )}
            </div>

            <div className="px-6 pb-6 pt-2 flex justify-between items-center">
              <button 
                className="btn btn-primary btn-sm gap-2"
                onClick={() => setIsShareModalOpen(true)}
              >
                {t("Share")}
              </button>
              <button className="btn btn-outline btn-sm border-base-300 hover:bg-base-200 hover:text-base-content font-bold px-6" onClick={() => setIsAnalysisModalOpen(false)}>
                {t("Close")}
              </button>
            </div>
          </div>
        </dialog>
      )}

      <ShareSelectionModal 
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onShare={handleShareProfileAnalysis}
        title={t("Share Profile Analysis")}
      />
    </div>
  );
}