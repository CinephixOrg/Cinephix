import React, { useEffect, useState, useContext } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import API from "../api/axios";
import { matchService } from "../api/matchService.js";
import CineGraph from "../components/CineGraph.jsx";
import { AuthContext } from "../context/AuthContext.jsx";
import MovieCard from "../components/MovieCard.jsx";
import SeriesCard from "../components/SeriesCard.jsx";

export default function PublicProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: authUser } = useContext(AuthContext);
  console.log("🔥 PublicProfilePage MOUNTED");
  console.log("PUBLIC PROFILE ID:", id);

  useEffect(() => {
    if (!id) {
      navigate("/home");
      return;
    }
  }, [id, navigate]);

  const [profile, setProfile] = useState(null);
  const [cineGraphData, setCineGraphData] = useState(null);
  const [favorites, setFavorites] = useState({ movies: [], series: [] });
  const [loading, setLoading] = useState(true);
  const [loadingLists, setLoadingLists] = useState(true);
  const [isFollowed, setIsFollowed] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const makeAbsolute = (url) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    const base = (API && API.defaults && API.defaults.baseURL) || window.location.origin;
    return `${base.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
  };

  // YENİ: Cinematch işlemi
  const handleCinematch = async () => {
    setMatchLoading(true);
    setMatchError(null);
    try {
      console.log(`🎬 Calculating cinematch with user ${id}...`);
      const filters = {
        type: matchType,
        genres: selectedGenres,
        useCount,
        useAvgRating,
      };
      console.log('📋 Filters:', filters);
      const result = await matchService.getMatchWithUser(id, matchType, filters);
      console.log('✅ Cinematch result:', result);
      const data = result.data || result;
      console.log('📊 Setting matchResult:', data);
      setMatchResult(data);
      toast.success('Match hesaplandı!');
    } catch (error) {
      console.error('❌ Cinematch error:', error);
      setMatchError(error.message || 'Cinematch hesaplandırken hata oluştu');
      toast.error(error.message || 'Cinematch hesaplandırken hata oluştu');
    } finally {
      setMatchLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    
    if (!authUser?.token) {
      navigate("/login");
      return;
    }

    const abortController = new AbortController();
    const signal = abortController.signal;
    let mounted = true;

    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const headers = { Authorization: `Bearer ${authUser.token}` };
        const res = await API.get(`/users/profile/${id}`, { headers, signal });
        if (!mounted) return;
        const p = res.data;
        if (p?.profile_pic_url) p.profile_pic_url = makeAbsolute(p.profile_pic_url);

        if (p && p.followers && !Array.isArray(p.followers)) {
          p.followers = [p.followers];
        }

        setProfile(p);

        let followed = false;
        if (authUser && p) {
          if (Array.isArray(p.followers)) {
            followed = p.followers.some((f) => {
              if (!f) return false;
              if (typeof f === "string") return f === authUser._id || f === authUser.id;
              return f._id === authUser._id || f._id === authUser.id || f.id === authUser._id || f.id === authUser.id;
            });
          }
          if (!followed) followed = Boolean(p?.isFollowed || p?.followedByMe || p?.followedByCurrentUser);
        } else {
          followed = Boolean(p?.isFollowed || p?.followedByMe);
        }
        setIsFollowed(Boolean(followed));
      } catch (err) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        console.error("Failed to fetch public profile", err);
        setError("Profile load failed.");
        setProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const loadLists = async () => {
      setLoadingLists(true);
      try {
        const headers = { Authorization: `Bearer ${authUser.token}` };
        const favRes = await API.get(`/users/favorites/${id}`, { headers, signal });
        if (!mounted) return;

        const movies = Array.isArray(favRes.data?.movies) ? favRes.data.movies : [];
        const series = Array.isArray(favRes.data?.series) ? favRes.data.series : [];
        setFavorites({ movies, series });
      } catch (err) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        console.error("Failed to load favorites", err);
        setFavorites({ movies: [], series: [] });
      } finally {
        if (mounted) setLoadingLists(false);
      }
    };

    const loadCineGraph = async () => {
      try {
        const headers = { Authorization: `Bearer ${authUser.token}` };
        const res = await API.get(`/users/cinegraph-data/${id}`, { headers, signal });
        if (!mounted) return;

        setCineGraphData(res.data);
      } catch (err) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        console.error("Failed to load cinegraph", err);
        setCineGraphData(null);
      }
    };

    loadProfile();
    loadLists();
    loadCineGraph();

    return () => {
      mounted = false;
      abortController.abort();
    };
  }, [id, authUser?.token, navigate]);

  const refreshProfileData = async () => {
    if (!authUser?.token || !id) return;
    try {
      const headers = { Authorization: `Bearer ${authUser.token}` };
      const [profileRes, favRes, cgRes] = await Promise.all([
        API.get(`/users/profile/${id}`, { headers }),
        API.get(`/users/favorites/${id}`, { headers }),
        API.get(`/users/cinegraph-data/${id}`, { headers })
      ]);
      
      const p = profileRes.data;
      if (p?.profile_pic_url) p.profile_pic_url = makeAbsolute(p.profile_pic_url);
      if (p && p.followers && !Array.isArray(p.followers)) p.followers = [p.followers];
      setProfile(p);
      
      const movies = Array.isArray(favRes.data?.movies) ? favRes.data.movies : [];
      const series = Array.isArray(favRes.data?.series) ? favRes.data.series : [];
      setFavorites({ movies, series });
      
      setCineGraphData(cgRes.data);
    } catch (err) {
      console.error("Failed to refresh profile data", err);
    }
  };

  const isOwn = Boolean(authUser && (authUser._id === (profile?._id || profile?.id) || authUser.id === (profile?._id || profile?.id)));

  const toggleFollow = async () => {
    if (!authUser?.token) { navigate('/login'); return; }
    if (isOwn) return;
    setFollowLoading(true);
    try {
      const headers = { Authorization: `Bearer ${authUser.token}` };
      const tryEndpoints = async (attempts) => {
        let lastErr = null;
        for (const fn of attempts) {
          try { return await fn(); } catch (e) { lastErr = e; }
        }
        throw lastErr;
      };

      if (!isFollowed) {
        await tryEndpoints([
          () => API.post(`/users/${id}/follow`, {}, { headers }),
          () => API.post(`/users/follow`, { userId: id }, { headers }),
          () => API.post(`/follow/${id}`, {}, { headers }),
        ]);
        setIsFollowed(true);
        await refreshProfileData();
      } else {
        await tryEndpoints([
          () => API.post(`/users/${id}/unfollow`, {}, { headers }),
          () => API.delete(`/users/${id}/follow`, { headers }),
          () => API.post(`/users/unfollow`, { userId: id }, { headers }),
        ]);
        setIsFollowed(false);
        await refreshProfileData();
      }
    } catch (err) {
      console.error('Follow toggle failed', err);
    } finally { setFollowLoading(false); }
  };

  if (loading) return <div className="p-8">Loading profile...</div>;
  if (error) return <div className="p-8 text-red-400">{error}</div>;
  if (!profile) return <div className="p-8">Profile not found.</div>;

  const avatar = profile.profile_pic_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.username || 'U')}&size=256`;
  const favoritesCount = Array.isArray(favorites) ? favorites.length : 0;
  const cinegraphCount = (cineGraphData && ((Object.values(cineGraphData.movieStats || {}).reduce((a,b)=>a+b,0) || 0) + (Object.values(cineGraphData.seriesStats || {}).reduce((a,b)=>a+b,0) || 0))) || 0;

  const derivedFollowersCount = Array.isArray(profile?.followers) ? profile.followers.length : (profile?.followersCount ?? profile?.followers ?? 0);
  const derivedFollowingCount = Array.isArray(profile?.following) ? profile.following.length : (profile?.followingCount ?? profile?.following ?? 0);

  const topGenres = profile.topGenres && Array.isArray(profile.topGenres) && profile.topGenres.length > 0 ? profile.topGenres : (() => {
    const map = new Map();
    const add = (obj) => { if (!obj) return; Object.entries(obj).forEach(([k,v]) => map.set(k, (map.get(k)||0)+v)); };
    if (cineGraphData) { add(cineGraphData.movieStats); add(cineGraphData.seriesStats); }
    if (favorites?.movies) {
      favorites.movies.forEach(m => {
        (m.genres || []).forEach(g => map.set(g, (map.get(g) || 0) + 1));
      });
    }

    if (favorites?.series) {
      favorites.series.forEach(s => {
        (s.genres || []).forEach(g => map.set(g, (map.get(g) || 0) + 1));
      });
    }
    return Array.from(map.entries()).sort((a,b)=>b[1]-a[1]).slice(0,6).map(e=>e[0]);
  })();

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="bg-base-100 p-8 rounded-lg text-center shadow">
        <div className="flex flex-col items-center">
          <div className="w-36 h-36 rounded-full overflow-hidden ring ring-primary cursor-pointer">
            <img src={avatar} alt={`${profile.username} avatar`} className="w-full h-full object-cover object-center" />
          </div>

          <h2 className="text-2xl font-bold mt-4">{profile.username}</h2>
          {profile.bio && <p className="mt-2 text-sm text-muted">{profile.bio}</p>}

          <div className="mt-4 flex gap-4 items-center text-sm text-base-content/70">
            <div>{cinegraphCount} Cinegraph</div>
            <div>•</div>
            <div>{favoritesCount} Favorites</div>
            <div>•</div>
            <div>{derivedFollowersCount} followers</div>
            <div>•</div>
            <div>{derivedFollowingCount} following</div>
          </div>

          {topGenres && topGenres.length > 0 && (
            <div className="mt-4 text-left max-w-xl mx-auto">
              <h4 className="font-semibold">Top genres</h4>
              <div className="flex flex-wrap gap-2 mt-2">
                {topGenres.map((g) => (
                  <span key={g} className="badge badge-outline text-xs">{g}</span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-center gap-3">
            <div className="text-sm text-muted">Joined {new Date(profile.createdAt || profile.created_at || Date.now()).toLocaleDateString()}</div>
          </div>

          {!isOwn && (
            <div>
              <div className="mt-4 flex gap-2">
                <button className={`btn ${isFollowed ? 'btn-success' : 'btn-primary'} btn-sm`} onClick={toggleFollow} disabled={followLoading}>{followLoading ? '...' : isFollowed ? 'Following' : 'Follow'}</button>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="btn btn-sm btn-outline gap-2"
                >
                  ⚙️ Filters
                </button>
                <button
                  onClick={handleCinematch}
                  disabled={matchLoading}
                  className="btn btn-sm btn-secondary gap-2"
                >
                  {matchLoading ? <span className="loading loading-spinner loading-sm"></span> : '🎬'}
                  Cinematch
                </button>
              </div>
              
              {/* Filtreleme seçenekleri */}
              {showFilters && (
                <div className="mt-4 p-4 bg-base-200 rounded-lg space-y-3">
                  {/* Type toggle */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">Type:</span>
                    <div className="btn-group btn-group-sm">
                      <button
                        className={`btn ${matchType === 'movie' ? 'btn-active' : ''}`}
                        onClick={() => setMatchType('movie')}
                      >
                        🎬 Movie
                      </button>
                      <button
                        className={`btn ${matchType === 'series' ? 'btn-active' : ''}`}
                        onClick={() => setMatchType('series')}
                      >
                        📺 Series
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
                      <span className="text-sm">Use Count</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useAvgRating}
                        onChange={(e) => setUseAvgRating(e.target.checked)}
                        className="checkbox checkbox-sm"
                      />
                      <span className="text-sm">Use Rating</span>
                    </label>
                  </div>
                  
                  {/* Genre selection - en yaygın türleri göster */}
                  <div>
                    <span className="text-sm font-semibold block mb-2">Genres:</span>
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
                  <span>Your match score is <strong>{matchResult.matchPercentage}%</strong> 🎬</span>
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

          {isOwn && (
            <div className="mt-4">
              <Link to="/profile" className="btn btn-outline btn-sm">Edit your profile</Link>
            </div>
          )}
        </div>
      </div>

      {profile?.isAuthorized === false ? (
        <div className="text-center p-12 bg-base-200 rounded-lg shadow-inner mt-8 border border-base-300">
          <div className="text-6xl mb-4">🔒</div>
          <h3 className="text-2xl font-bold mb-2">This account is private</h3>
          <p className="text-base-content/70">Follow to see detailed lists.</p>
        </div>
      ) : (
        <>
          {/* CineGraph charts (computed from favorites) */}
          <section className="mt-6">
            <h3 className="text-lg font-semibold mb-3">CineGraph</h3>
            {loadingLists ? (
              <div>Loading cinegraph...</div>
            ) : cineGraphData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CineGraph data={cineGraphData.movieStats || {}} title="Movie Genres" />
                <CineGraph data={cineGraphData.seriesStats || {}} title="Series Genres" />
              </div>
            ) : (
              <div className="text-sm text-muted">No cinegraph data to show.</div>
            )}
          </section>

          {/* Favorites section */}
          <section className="mt-12">
            <h2 className="text-2xl font-bold mb-4">Favorite Movies</h2>

            {favorites.movies && favorites.movies.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {favorites.movies.map((movie) => (
                  <div key={movie._id} className="flex-none w-36">
                    <MovieCard movie={movie} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-6 bg-base-100 rounded-lg shadow-inner">
                <p className="text-base-content/70">No favorite movies.</p>
              </div>
            )}
          </section>

          {/* --- FAVORİ DİZİLER --- */}
          <section className="mt-8">
            <h2 className="text-2xl font-bold mb-4">Favorite Series</h2>

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
                <p className="text-base-content/70">No favorite series.</p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}