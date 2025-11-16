import React, { useEffect, useState, useContext } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import API from "../api/axios";
import { AuthContext } from "../context/AuthContext.jsx";

export default function PublicProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: authUser } = useContext(AuthContext);

  const [profile, setProfile] = useState(null);
  const [cinegraph, setCinegraph] = useState([]);
  const [favorites, setFavorites] = useState([]);
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
        // normalize avatar url
        if (p?.profile_pic_url) p.profile_pic_url = makeAbsolute(p.profile_pic_url);
        setProfile(p);
        setIsFollowed(Boolean(p?.isFollowed || p?.followedByMe)); // backend may call it differently
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
        const headers = authUser?.token ? { Authorization: `Bearer ${authUser.token}` } : {};
        // cinegraph endpoint (best-effort)
        try {
          const cg = await API.get(`/users/${id}/cinegraph`, { headers });
          setCinegraph(Array.isArray(cg.data) ? cg.data : cg.data.results || []);
        } catch (e) {
          // endpoint may not exist — fallback empty
          setCinegraph([]);
        }
        // favorites endpoint (best-effort)
        try {
          const fav = await API.get(`/users/${id}/favorites`, { headers });
          setFavorites(Array.isArray(fav.data) ? fav.data : fav.data.results || []);
        } catch (e) {
          setFavorites([]);
        }
      } catch (err) {
        console.error("Failed to load lists", err);
      } finally {
        setLoadingLists(false);
      }
    };

    loadProfile();
    loadLists();

    return () => {
      mounted = false;
    };
  }, [id, authUser?.token]);

  const isOwn = Boolean(authUser && (authUser._id === (profile?._id || profile?.id) || authUser.id === (profile?._id || profile?.id)));

  const toggleFollow = async () => {
    if (!authUser?.token) {
      navigate("/login");
      return;
    }
    if (isOwn) return;
    setFollowLoading(true);
    try {
      if (!isFollowed) {
        // try follow
        await API.post(`/users/${id}/follow`, {}, { headers: { Authorization: `Bearer ${authUser.token}` } });
        setIsFollowed(true);
        // optionally update profile.followers count locally
        setProfile((p) => p ? { ...p, followersCount: (p.followersCount || p.followers || 0) + 1 } : p);
      } else {
        // try unfollow
        // try common endpoints
        try {
          await API.post(`/users/${id}/unfollow`, {}, { headers: { Authorization: `Bearer ${authUser.token}` } });
        } catch (e) {
          // fallback to delete or other pattern
          await API.delete(`/users/${id}/follow`, { headers: { Authorization: `Bearer ${authUser.token}` } });
        }
        setIsFollowed(false);
        setProfile((p) => p ? { ...p, followersCount: Math.max(0, (p.followersCount || p.followers || 1) - 1) } : p);
      }
    } catch (err) {
      console.error("Follow toggle failed", err);
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading profile...</div>;
  if (error) return <div className="p-8 text-red-400">{error}</div>;
  if (!profile) return <div className="p-8">Profile not found.</div>;

  const avatar = profile.profile_pic_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.username || "U")}&size=256`;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="bg-base-100 p-8 rounded-lg text-center shadow">
        <div className="flex flex-col items-center">
          <div className="w-36 h-36 rounded-full overflow-hidden ring ring-primary cursor-pointer">
            <img src={avatar} alt={`${profile.username} avatar`} className="w-full h-full object-cover object-center" />
          </div>

          <h2 className="text-2xl font-bold mt-4">{profile.username}</h2>
          {profile.bio && <p className="mt-2 text-sm text-muted">{profile.bio}</p>}

          <div className="mt-3 flex items-center gap-3">
            <div className="text-sm text-muted">Joined {new Date(profile.createdAt || profile.created_at || Date.now()).toLocaleDateString()}</div>
            <div className="text-sm text-muted">•</div>
            <div className="text-sm text-muted">{profile.followersCount ?? profile.followers ?? 0} followers</div>
          </div>

          {!isOwn && (
            <div className="mt-4">
              <button
                className={`btn ${isFollowed ? "btn-success" : "btn-primary"} btn-sm`}
                onClick={toggleFollow}
                disabled={followLoading}
              >
                {followLoading ? "..." : isFollowed ? "Following" : "Follow"}
              </button>
            </div>
          )}

          {isOwn && (
            <div className="mt-4">
              <Link to="/profile" className="btn btn-outline btn-sm">Edit your profile</Link>
            </div>
          )}
        </div>
      </div>

      {/* Cinegraph section */}
      <section className="mt-6">
        <h3 className="text-lg font-semibold mb-3">Cinegraph</h3>
        {loadingLists ? (
          <div>Loading cinegraph...</div>
        ) : cinegraph && cinegraph.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {cinegraph.map((item) => (
              <div key={item._id || item.id || item.contentId} className="bg-base-100 rounded overflow-hidden">
                <Link to={`/content/${item.type || item.contentType || "movie"}/${item.contentId || item._id || item.id}`}>
                  <div className="w-full h-36 bg-gray-200">
                    <img
                      src={item.poster || item.thumbnail || item.image || ""}
                      alt={item.title || item.name}
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                  <div className="p-2 text-sm font-medium">{item.title || item.name}</div>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted">No cinegraph items to show.</div>
        )}
      </section>

      {/* Favorites section */}
      <section className="mt-6">
        <h3 className="text-lg font-semibold mb-3">Favorites</h3>
        {loadingLists ? (
          <div>Loading favorites...</div>
        ) : favorites && favorites.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {favorites.map((f) => (
              <div key={f._id || f.id || f.contentId} className="bg-base-100 rounded overflow-hidden">
                <Link to={`/content/${f.type || f.contentType || "movie"}/${f.contentId || f._id || f.id}`}>
                  <div className="w-full h-36 bg-gray-200">
                    <img
                      src={f.poster || f.thumbnail || f.image || ""}
                      alt={f.title || f.name}
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                  <div className="p-2 text-sm font-medium">{f.title || f.name}</div>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted">No favorites to show.</div>
        )}
      </section>
    </div>
  );
}