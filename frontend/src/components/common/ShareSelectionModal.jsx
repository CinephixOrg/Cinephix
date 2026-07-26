import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiSearch, FiX, FiCheck } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import userService from '../../api/userService';
import API from '../../api/axios';
import { API_ROUTES } from '../../constants/apiRoutes';

function Avatar({ user: u, size = 'md' }) {
  const dim = size === 'sm' ? 'w-9 h-9 text-sm' : 'w-11 h-11 text-lg';
  if (u?.profile_pic_url) {
    return <img src={u.profile_pic_url} alt={u.username} className={`${dim} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${dim} rounded-full bg-neutral flex items-center justify-center font-bold text-neutral-content flex-shrink-0`}>
      {u?.username?.[0]?.toUpperCase()}
    </div>
  );
}

export default function ShareSelectionModal({ isOpen, onClose, onShare, title }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [connections, setConnections] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const debounceRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSearchResults([]);
      setSelectedUserIds(new Set());
      // Load connections by default using current user following & followers list
      Promise.all([
        API.get(`${API_ROUTES.USERS.GET_FOLLOWING}?limit=100`),
        API.get(`${API_ROUTES.USERS.GET_FOLLOWING.replace('following', 'followers')}?limit=100`)
      ])
        .then(([followingRes, followersRes]) => {
          const map = new Map();
          const following = Array.isArray(followingRes.data) ? followingRes.data : [];
          const followers = Array.isArray(followersRes.data) ? followersRes.data : [];
          
          following.forEach(u => map.set(u._id, u));
          followers.forEach(u => map.set(u._id, u));
          
          setConnections(Array.from(map.values()));
        })
        .catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { 
      setSearchResults([]); 
      return; 
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await API.get(API_ROUTES.USERS.SEARCH(query));
        setSearchResults(Array.isArray(res.data) ? res.data : []);
      } catch {
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, [query]);

  if (!isOpen) return null;

  const displayList = query.trim() ? searchResults : connections;

  const toggleSelection = (userId) => {
    const next = new Set(selectedUserIds);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setSelectedUserIds(next);
  };

  const handleShare = () => {
    if (selectedUserIds.size === 0) return;
    onShare(Array.from(selectedUserIds));
  };

  return createPortal(
    <div className="modal modal-open bg-black/60 backdrop-blur-sm z-[9999]">
      <div className="modal-box p-0 max-w-sm w-full bg-base-100 flex flex-col h-[500px] z-[10000] relative">
        {/* Header */}
        <div className="p-4 border-b border-base-200 flex justify-between items-center bg-base-100 sticky top-0 z-10">
          <h3 className="font-bold text-lg">{title || t("Share Analysis")}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <FiX size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-base-200">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input
              autoFocus
              type="text"
              placeholder={t("Search users...")}
              className="input input-sm input-bordered w-full pl-9 rounded-full bg-base-200/50"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="p-4 text-center text-base-content/50 text-sm">{t("Searching...")}</div>
          ) : displayList.length > 0 ? (
            <div className="flex flex-col gap-1">
              {displayList.map(u => {
                const isSelected = selectedUserIds.has(u._id);
                return (
                  <button
                    key={u._id}
                    className={`flex items-center gap-3 p-2 rounded-xl transition-colors text-left ${isSelected ? 'bg-primary/10' : 'hover:bg-base-200'}`}
                    onClick={() => toggleSelection(u._id)}
                  >
                    <div className="relative">
                      <Avatar user={u} size="md" />
                      {isSelected && (
                        <div className="absolute -bottom-1 -right-1 bg-primary text-primary-content rounded-full p-0.5 border-2 border-base-100">
                          <FiCheck size={12} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{u.username}</div>
                    </div>
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-sm checkbox-primary" 
                      checked={isSelected}
                      readOnly
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center text-base-content/50 text-sm">
              {query.trim() ? t("No users found.") : t("No connections found.")}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-base-200 bg-base-100">
          <button 
            className="btn btn-primary w-full"
            disabled={selectedUserIds.size === 0}
            onClick={handleShare}
          >
            {t("Share")} {selectedUserIds.size > 0 && `(${selectedUserIds.size})`}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>,
    document.body
  );
}
