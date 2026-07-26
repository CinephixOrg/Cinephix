import React, { useState, useEffect, useMemo, useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { AuthContext } from "../context/AuthContext.jsx";
import { NotificationContext } from "../context/NotificationContext.jsx";
import { userService } from "../api/userService.js";
import axios from "axios";
import API from "../api/axios.js";
import API_ROUTES from "../constants/apiRoutes.js";
import { FiCheck, FiX, FiUserPlus, FiUserMinus } from "react-icons/fi";

export default function NetworkPage() {
  const { user } = useContext(AuthContext);
  const { fetchUnreadCount, fetchNotifications } = useContext(NotificationContext);
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const urlTab = params.get("tab");
  const activeTab = urlTab === "requests" ? "pending" : (urlTab || "followers");

  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Track IDs of users we've just requested to follow to update UI optimistically
  const [requestedIds, setRequestedIds] = useState(new Set());

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

      const [followersRes, followingRes, requestsRes, suggestionsRes, sentRequestsRes] = await Promise.all([
        API.get(API_ROUTES.USERS.GET_FOLLOWING.replace('following', 'followers') + limitQuery, { headers }),
        API.get(API_ROUTES.USERS.GET_FOLLOWING + limitQuery, { headers }),
        userService.getPendingRequests(),
        userService.getSuggestions(5),
        userService.getSentRequests()
      ]);

      setFollowers(followersRes.data?.data || followersRes.data || []);
      setFollowing(followingRes.data?.data || followingRes.data || []);
      setPendingRequests(requestsRes?.data || requestsRes || []);
      setSuggestions(suggestionsRes?.data || suggestionsRes || []);
      
      const sentIds = Array.isArray(sentRequestsRes) ? sentRequestsRes : (sentRequestsRes?.data || []);
      setRequestedIds(new Set(sentIds.map(id => typeof id === 'object' ? id._id : id)));
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
        setRequestedIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(targetId);
          return newSet;
        });

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

        const res = await API.post('/users/follow', { targetId }, { headers });
        const resType = res.data?.data?.type || res.data?.type || res.type;
        
        if (resType === 'requested') {
          // Revert optimistic add if it was just a request
          setFollowing(prev => prev.filter(u => u._id !== targetId));
          if (userToAdd) {
            setSuggestions(prev => [userToAdd, ...prev]);
          }
          setRequestedIds(prev => new Set(prev).add(targetId));
          toast.success("Follow request sent");
        } else {
          toast.success("Followed successfully");
        }
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

  const handleAcceptRequest = async (requesterId) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const currentUserId = user?._id || user?.id;
      
      // Find the requester from pendingRequests to add them to followers list
      const requestObj = pendingRequests.find(req => {
        const id = req?.requesterId?._id || req?.requesterId || req?._id || req;
        return id === requesterId;
      });
      const userToAdd = requestObj?.requesterId || requestObj;
      const isLastRequest = pendingRequests.length <= 1;

      // Optimistic UI update
      setPendingRequests(prev => prev.filter(req => {
        const id = req?.requesterId?._id || req?.requesterId || req?._id || req;
        return id !== requesterId;
      }));
      
      if (userToAdd) {
         setFollowers(prev => [...prev, userToAdd]);
      }

      await API.post(`/users/${currentUserId}/follow-request/accept`, { requesterId }, { headers });
      toast.success("Follow request accepted");
      
      // Force refresh notifications in UI
      if (fetchUnreadCount) fetchUnreadCount();
      if (fetchNotifications) fetchNotifications();

      // Let it navigate if needed
      setTimeout(() => {
        if (isLastRequest && activeTab === "pending") {
          navigate("/network?tab=followers");
        }
      }, 100);
    } catch (err) {
      console.error("Accept error:", err);
      toast.error("Failed to accept request");
      fetchLists(true);
    }
  };

  const handleRejectRequest = async (requesterId) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const currentUserId = user?._id || user?.id;
      
      const isLastRequest = pendingRequests.length <= 1;

      // Optimistic UI update
      setPendingRequests(prev => prev.filter(req => {
        const id = req?.requesterId?._id || req?.requesterId || req?._id || req;
        return id !== requesterId;
      }));

      await API.post(`/users/${currentUserId}/follow-request/reject`, { requesterId }, { headers });
      toast.success("Follow request rejected");
      
      setTimeout(() => {
        if (isLastRequest && activeTab === "pending") {
          navigate("/network?tab=followers");
        }
      }, 100);
    } catch (err) {
      console.error("Reject error:", err);
      toast.error("Failed to reject request");
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

  const getDisplayedUsers = () => {
    switch (activeTab) {
      case "following":
        return Array.isArray(following) ? following : [];
      case "followers":
        return Array.isArray(followers) ? followers : [];
      case "pending":
        if (!Array.isArray(pendingRequests)) return [];
        // Map the populated requester (or use directly if backend returns users), and filter out invalid items
        return pendingRequests
          .map(req => req?.requesterId || req)
          .filter(u => u && u._id);
      default:
        return Array.isArray(following) ? following : [];
    }
  };

  const displayedUsers = getDisplayedUsers();

  const UserListItem = ({ displayUser, isRequest }) => {
    // If it's a request, we might be dealing with populated requesterId object
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
          {isRequest ? (
            <>
              <button
                onClick={() => handleAcceptRequest(u._id)}
                className="btn btn-sm btn-primary no-animation"
              >
                <FiCheck className="mr-1" /> Accept
              </button>
              <button
                onClick={() => handleRejectRequest(u._id)}
                className="btn btn-sm btn-ghost text-error no-animation"
              >
                <FiX className="mr-1" /> Reject
              </button>
            </>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => handleFollowToggle(u._id || u.id, isFollowing)}
                disabled={requestedIds.has(u._id || u.id)}
                className={`btn btn-sm no-animation ${requestedIds.has(u._id || u.id) ? 'btn-disabled' : isFollowing ? "btn-outline" : "btn-primary"}`}
              >
                {requestedIds.has(u._id || u.id) ? (
                  'Requested'
                ) : isFollowing ? (
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
              {pendingRequests.length > 0 && (
                <a
                  className={`tab tab-lg flex-1 rounded-lg transition-all ${activeTab === "pending" ? "tab-active bg-primary text-primary-content shadow-lg font-bold" : "hover:bg-base-300"}`}
                  onClick={() => handleTabChange("pending")}
                >
                  Requests
                  <span className="indicator-item badge badge-secondary ml-2 border-none">
                    {pendingRequests.length}
                  </span>
                </a>
              )}
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
                  <UserListItem
                    key={u._id || index}
                    displayUser={u}
                    isRequest={activeTab === "pending"}
                  />
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
                      className={`btn btn-xs shrink-0 no-animation ${requestedIds.has(u._id) ? 'btn-disabled' : 'btn-primary'}`}
                      disabled={requestedIds.has(u._id)}
                      onClick={() => handleFollowToggle(u._id, false)}
                    >
                      {requestedIds.has(u._id) ? 'Requested' : 'Follow'}
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