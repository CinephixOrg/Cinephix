import React, { useEffect, useState, useContext } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import API from "../api/axios";
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

  const makeAbsolute = (url) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    const base = (API && API.defaults && API.defaults.baseURL) || window.location.origin;
    return `${base.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
  };

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const headers = authUser?.token ? { Authorization: `Bearer ${authUser.token}` } : {};
        const res = await API.get(`/users/profile/${id}`, { headers });
        if (!mounted) return;
        const p = res.data;
        if (p?.profile_pic_url) p.profile_pic_url = makeAbsolute(p.profile_pic_url);

        if (p && p.followers && !Array.isArray(p.followers)) {
          p.followers = [p.followers];
        }

        setProfile(p);

        // Determine if the authenticated user is following this profile
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
        const headers = authUser?.token
          ? { Authorization: `Bearer ${authUser.token}` }
          : {};

        const favRes = await API.get(`/users/favorites/${id}`, { headers });

        const movies = Array.isArray(favRes.data?.movies)
          ? favRes.data.movies
          : [];

        const series = Array.isArray(favRes.data?.series)
          ? favRes.data.series
          : [];

        // ⬇️ KRİTİK SATIR (ProfilePage ile birebir)
        setFavorites({ movies, series });

      } catch (err) {
        console.error("Failed to load favorites", err);
        setFavorites({ movies: [], series: [] });
      } finally {
        setLoadingLists(false);
      }
    };


    const loadCineGraph = async () => {
      try {
        const headers = authUser?.token
          ? { Authorization: `Bearer ${authUser.token}` }
          : {};

        const res = await API.get(`/users/cinegraph-data/${id}`, { headers });

        console.log("🎬 PUBLIC CINEGRAPH RAW:", res.data);

        setCineGraphData(res.data);
      } catch (e) {
        console.error("Failed to load cinegraph", e);
        setCineGraphData(null);
      }
    };


    loadProfile();
    loadLists();
    loadCineGraph();

    return () => { mounted = false; };
  }, [id, authUser?.token]);

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
        setProfile((p) => {
          if (!p) return p;
          const np = { ...p };
          if (Array.isArray(np.followers)) {
            if (!np.followers.some((f) => (typeof f === 'string' ? f === authUser._id || f === authUser.id : f._id === authUser._id || f._id === authUser.id))) {
              np.followers = [...np.followers, authUser._id || authUser.id];
            }
          } else {
            np.followersCount = (np.followersCount || np.followers || 0) + 1;
          }
          return np;
        });
      } else {
        await tryEndpoints([
          () => API.post(`/users/${id}/unfollow`, {}, { headers }),
          () => API.delete(`/users/${id}/follow`, { headers }),
          () => API.post(`/users/unfollow`, { userId: id }, { headers }),
        ]);
        setIsFollowed(false);
        setProfile((p) => {
          if (!p) return p;
          const np = { ...p };
          if (Array.isArray(np.followers)) {
            np.followers = np.followers.filter((f) => {
              if (!f) return false;
              if (typeof f === 'string') return f !== authUser._id && f !== authUser.id;
              return f._id !== authUser._id && f._id !== authUser.id && f.id !== authUser._id && f.id !== authUser.id;
            });
          } else {
            np.followersCount = Math.max(0, (np.followersCount || np.followers || 1) - 1);
          }
          return np;
        });
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

          <div className="mt-3 flex items-center gap-3">
            <div className="text-sm text-muted">Joined {new Date(profile.createdAt || profile.created_at || Date.now()).toLocaleDateString()}</div>
            <div className="text-sm text-muted">•</div>
            <div className="text-sm text-muted">{derivedFollowersCount} followers</div>
          </div>

          {!isOwn && (
            <div className="mt-4">
              <button className={`btn ${isFollowed ? 'btn-success' : 'btn-primary'} btn-sm`} onClick={toggleFollow} disabled={followLoading}>{followLoading ? '...' : isFollowed ? 'Following' : 'Follow'}</button>
            </div>
          )}

          {isOwn && (
            <div className="mt-4">
              <Link to="/profile" className="btn btn-outline btn-sm">Edit your profile</Link>
            </div>
          )}
        </div>
      </div>

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
    </div>
  );
}