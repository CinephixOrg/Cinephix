import React, { useState, useEffect, useMemo, useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { AuthContext } from "../context/AuthContext.jsx";
import { NotificationContext } from "../context/NotificationContext.jsx";
import { userService } from "../api/userService.js";
import API from "../api/axios.js";
import API_ROUTES from "../constants/apiRoutes.js";
import { FiUserPlus, FiUserMinus } from "react-icons/fi";

export default function NetworkPage() {
  const { user } = useContext(AuthContext);
  const { fetchUnreadCount, fetchNotifications } = useContext(NotificationContext);
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const activeTab = params.get("tab") === "following" ? "following" : "followers";

  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const token = user?.token;

  const fetchLists = async (hideLoading = false) => {
    if (!token) {
      setError("Please log in to view this page.");
      if (!hideLoading) setLoading(false);
      return;
    }

    if (!hideLoading) setLoading(true);
    if (!hideLoading) setError(null);

    const headers = { Authorization: `Bearer ${token}` };
    const queryUserId = params.get("user");
    const qs = queryUserId ? `?userId=${queryUserId}` : "";

    try {
      const limitQuery = qs ? `${qs}&limit=1000` : `?limit=1000`;

      const [followersRes, followingRes, suggestionsRes] = await Promise.all([
        API.get(API_ROUTES.USERS.GET_FOLLOWING.replace('following', 'followers') + limitQuery, { headers }),
        API.get(API_ROUTES.USERS.GET_FOLLOWING + limitQuery, { headers }),
        userService.getSuggestions(5),
      ]);

      setFollowers(followersRes.data?.data || followersRes.data || []);
      setFollowing(followingRes.data?.data || followingRes.data || []);
      setSuggestions(suggestionsRes?.data || suggestionsRes || []);
    } catch (err) {
      console.error("Error fetching network data:", err);
      if (!hideLoading) setError("Failed to load network data. Please try again.");
    } finally {
      if (!hideLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
    // Intentionally omitted location.search to prevent redundant full-list API calls on tab change
  }, [token]);

  const handleFollowToggle = async (userId, isCurrentlyFollowing) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const targetId = typeof userId === 'object' ? (userId._id || userId.id) : userId;

      if (isCurrentlyFollowing) {
        // Optimistic update
        setFollowing(prev => prev.filter(u => u._id !== targetId));

        await API.post('/users/unfollow', { targetId }, { headers });
        toast.success("Unfollowed successfully");
      } else {
        // Optimistic update
        const userToAdd = followers.find(u => u._id === targetId) || suggestions.find(u => u._id === targetId);
        if (userToAdd) {
          setFollowing(prev => [...prev, userToAdd]);
        }
        // Remove from suggestions optimistically
        setSuggestions(prev => prev.filter(u => u._id !== targetId));

        await API.post('/users/follow', { targetId }, { headers });
        toast.success("Followed successfully");
        // Force refresh notifications in UI
        if (fetchUnreadCount) fetchUnreadCount();
        if (fetchNotifications) fetchNotifications();
      }
    } catch (err) {
      console.error("Follow toggle error:", err);
      toast.error(err.message || "Operation failed.");
      fetchLists(true); // Revert on error
    }
  };

  const handleRemoveFollower = async (followerId) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const targetId = typeof followerId === 'object' ? (followerId._id || followerId.id) : followerId;

      // Optimistic update
      setFollowers(prev => prev.filter(u => u._id !== targetId));

      await API.post('/users/remove-follower', { followerId: targetId }, { headers });
      toast.success("Follower removed successfully");
    } catch (err) {
      console.error("Remove follower error:", err);
      toast.error(err.message || "Failed to remove follower");
      fetchLists(true);
    }
  };

  const followingIdSet = useMemo(
    () => new Set(following.map((u) => u._id)),
    [following]
  );

  const handleTabChange = (tab) => {
    navigate(`/network?tab=${tab}`);
  };

  const displayedUsers = activeTab === "following"
    ? (Array.isArray(following) ? following : [])
    : (Array.isArray(followers) ? followers : []);

  const UserListItem = ({ displayUser }) => {
    const u = displayUser;
    const isFollowing = followingIdSet.has(u._id);

    return (
      <div className="flex items-center justify-between p-4 bg-base-200/50 rounded-xl hover:bg-base-200 transition-colors duration-200 mb-3 border border-base-300">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/profile/${u._id}`)}>
          <div className="avatar">
            <div className="w-12 h-12 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
              <img
                src={u.profile_pic_url || "https://ui-avatars.com/api/?name=" + (u.username || "U")}
                alt={u.username}
              />
            </div>
          </div>
          <div>
            <h3 className="font-bold text-lg">{u.username}</h3>
            <p className="text-sm text-base-content/70 line-clamp-1 max-w-xs">{u.bio || "No bio available"}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleFollowToggle(u._id || u.id, isFollowing)}
            className={`btn btn-sm no-animation ${isFollowing ? "btn-outline" : "btn-primary"}`}
          >
            {isFollowing ? (
              <><FiUserMinus className="mr-1" /> Unfollow</>
            ) : (
              <><FiUserPlus className="mr-1" /> Follow</>
            )}
          </button>
          {activeTab === "followers" && (
            <button
              onClick={() => handleRemoveFollower(u._id || u.id)}
              className="btn btn-sm btn-ghost text-error no-animation"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-base-100 py-8 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">

        {/* Main Content Area */}
        <div className="flex-1">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-6">Your Network</h1>

            <div className="tabs tabs-boxed bg-base-200 p-1 gap-1">
              <a
                className={`tab tab-lg flex-1 rounded-lg transition-all ${activeTab === "followers" ? "tab-active bg-primary text-primary-content shadow-lg font-bold" : "hover:bg-base-300"}`}
                onClick={() => handleTabChange("followers")}
              >
                Followers ({followers.length})
              </a>
              <a
                className={`tab tab-lg flex-1 rounded-lg transition-all ${activeTab === "following" ? "tab-active bg-primary text-primary-content shadow-lg font-bold" : "hover:bg-base-300"}`}
                onClick={() => handleTabChange("following")}
              >
                Following ({following.length})
              </a>
            </div>
          </div>

          <div className="bg-base-100 rounded-2xl">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <span className="loading loading-spinner loading-lg text-primary"></span>
              </div>
            ) : error ? (
              <div className="alert alert-error shadow-lg">
                <span>{error}</span>
              </div>
            ) : displayedUsers.length === 0 ? (
              <div className="text-center py-20 text-base-content/60">
                <div className="text-5xl mb-4">👻</div>
                <p className="text-lg">Nothing to see here yet.</p>
              </div>
            ) : (
              <div>
                {displayedUsers.map((u, index) => (
                  <UserListItem key={u._id || index} displayUser={u} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Suggestions */}
        <div className="w-full lg:w-80">
          <div className="bg-base-200 rounded-2xl p-6 sticky top-24">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FiUserPlus className="text-primary" /> Suggested for you
            </h2>

            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-4 items-center">
                    <div className="skeleton w-10 h-10 rounded-full shrink-0"></div>
                    <div className="flex flex-col gap-2 flex-1">
                      <div className="skeleton h-4 w-3/4"></div>
                      <div className="skeleton h-3 w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-base-content/60 italic">No suggestions right now.</p>
            ) : (
              <div className="space-y-4">
                {suggestions.map((u) => (
                  <div key={u._id} className="flex items-center gap-3 group">
                    <div className="avatar cursor-pointer shrink-0" onClick={() => navigate(`/profile/${u._id}`)}>
                      <div className="w-10 h-10 rounded-full">
                        <img src={u.profile_pic_url || "https://ui-avatars.com/api/?name=" + u.username} alt={u.username} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/profile/${u._id}`)}>
                      <h4 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{u.username}</h4>
                      <p className="text-xs text-base-content/60 truncate">Suggested User</p>
                    </div>
                    <button
                      className="btn btn-xs shrink-0 no-animation btn-primary"
                      onClick={() => handleFollowToggle(u._id, false)}
                    >
                      Follow
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
