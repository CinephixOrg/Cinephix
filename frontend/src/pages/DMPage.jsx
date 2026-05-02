import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useUnread } from '../context/UnreadContext';
import { useInbox } from '../hooks/useInbox';
import dmService from '../api/dmService';
import ChatWindow from '../components/community/ChatWindow';
import API from '../api/axios';
import { formatDistanceToNow } from 'date-fns';
import { API_ROUTES } from '../constants/apiRoutes';
import { FiSearch, FiEdit, FiX, FiMessageSquare } from 'react-icons/fi';
import toast from 'react-hot-toast';

// ── Avatar helper ─────────────────────────────────────────────────────────────
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

// ── Conversation list item ────────────────────────────────────────────────────
function ConversationItem({ conv, isActive, onClick }) {
  const other = conv.otherUser;
  const unread = conv.unreadCount ?? 0;
  const preview = conv.lastMessage || 'No messages yet';
  const time = conv.lastMessageAt
    ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })
    : '';

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors rounded-xl
        ${isActive ? 'bg-primary/15 border border-primary/30' : 'hover:bg-base-200'}`}
    >
      <div className="relative">
        <Avatar user={other} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full text-primary-content text-[10px] flex items-center justify-center font-bold leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline gap-1">
          <span className={`text-sm font-semibold truncate ${unread > 0 ? 'text-base-content' : 'text-base-content/80'}`}>
            {other?.username}
          </span>
          <span className="text-xs text-base-content/40 flex-shrink-0">{time}</span>
        </div>
        <p className={`text-xs truncate mt-0.5 ${unread > 0 ? 'text-base-content/80 font-medium' : 'text-base-content/50'}`}>
          {preview}
        </p>
      </div>
    </button>
  );
}

// ── Following user row (no conversation yet) ──────────────────────────────────
function FollowingItem({ user: u, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors rounded-xl hover:bg-base-200"
    >
      <Avatar user={u} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate text-base-content/80">{u.username}</p>
        <p className="text-xs text-base-content/40 truncate">{u.bio || 'Start a conversation'}</p>
      </div>
    </button>
  );
}

// ── User search modal for new DM ──────────────────────────────────────────────
function NewDMModal({ onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const search = useCallback((q) => {
    clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await API.get(API_ROUTES.USERS.SEARCH(q));
        setResults(Array.isArray(res.data) ? res.data : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => { search(query); }, [query, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-base-200">
          <h2 className="text-lg font-semibold">New Message</h2>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <FiX size={18} />
          </button>
        </div>

        <div className="p-4">
          <label className="input input-bordered flex items-center gap-2 w-full">
            <FiSearch size={16} className="text-base-content/40" />
            <input
              autoFocus
              type="text"
              placeholder="Search by username…"
              className="grow bg-transparent outline-none text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {loading && <span className="loading loading-spinner loading-xs" />}
          </label>
        </div>

        <div className="max-h-72 overflow-y-auto px-2 pb-4">
          {results.length === 0 && query.trim() && !loading && (
            <p className="text-center text-sm text-base-content/40 py-8">No users found</p>
          )}
          {results.map((u) => (
            <button
              key={u._id}
              onClick={() => onSelect(u)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-base-200 transition-colors"
            >
              <Avatar user={u} size="sm" />
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold truncate">{u.username}</p>
                {u.bio && <p className="text-xs text-base-content/50 truncate">{u.bio}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Chat panel header ─────────────────────────────────────────────────────────
function ChatHeader({ conversation, onBack }) {
  const other = conversation?.otherUser;
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-base-200 bg-base-100">
      <button className="btn btn-ghost btn-sm btn-circle md:hidden" onClick={onBack}>
        ←
      </button>
      <Avatar user={other} size="sm" />
      <p className="font-semibold text-sm">{other?.username}</p>
    </div>
  );
}

// ── Main DMPage ───────────────────────────────────────────────────────────────
export default function DMPage() {
  const { user } = useContext(AuthContext);
  const { setTotalUnread } = useUnread();
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [following, setFollowing] = useState([]);        // all followed users
  const [activeConv, setActiveConv] = useState(null);
  const activeConvRef = useRef(null);
  const [initialMessages, setInitialMessages] = useState([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [showNewDM, setShowNewDM] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  // Real-time inbox updates
  useInbox(user?.token, (payload) => {
    setConversations((prev) =>
      prev.map((c) =>
        c._id === payload.conversationId
          ? {
              ...c,
              lastMessage: payload.lastMessage,
              lastMessageAt: payload.lastMessageAt,
              unreadCount:
                activeConvRef.current?._id === payload.conversationId
                  ? c.unreadCount
                  : payload.senderId !== user?._id
                  ? (c.unreadCount ?? 0) + 1
                  : c.unreadCount,
            }
          : c
      ).sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0))
    );
  });

  // Keep TopBar unread badge in sync
  useEffect(() => {
    const total = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
    setTotalUnread(total);
  }, [conversations, setTotalUnread]);

  // Load conversations + following list on mount
  useEffect(() => {
    Promise.all([
      dmService.getConversations(),
      API.get(`${API_ROUTES.USERS.GET_FOLLOWING}?limit=100`).then((r) =>
        Array.isArray(r.data) ? r.data : []
      ),
    ])
      .then(([convs, followingUsers]) => {
        setConversations(convs);
        setFollowing(followingUsers);
      })
      .catch(() => toast.error('Failed to load messages'))
      .finally(() => setLoadingConvs(false));
  }, []);

  // Open conversation from URL param
  useEffect(() => {
    if (!conversationId || conversations.length === 0) return;
    const found = conversations.find((c) => c._id === conversationId);
    if (found) openConversation(found);
  }, [conversationId, conversations]);

  const openConversation = useCallback(async (conv) => {
    // Reset messages FIRST so the new ChatWindow never inherits the previous
    // conversation's messages while the real fetch is in flight.
    setInitialMessages([]);
    setActiveConv(conv);
    activeConvRef.current = conv;
    setMobileShowChat(true);
    navigate(`/dm/${conv._id}`, { replace: true });

    if (conv.unreadCount > 0) {
      await dmService.markAsRead(conv._id).catch(() => {});
      setConversations((prev) =>
        prev.map((c) => (c._id === conv._id ? { ...c, unreadCount: 0 } : c))
      );
    }

    const msgs = await dmService.getMessages(conv._id).catch(() => []);
    setInitialMessages(Array.isArray(msgs) ? msgs : []);
  }, [navigate]);

  // Start a DM with a user who has no conversation yet
  const startDM = useCallback(async (targetUser) => {
    // Safely resolve _id — Mongoose docs expose both _id (ObjectId) and id (string)
    const participantId = (targetUser._id ?? targetUser.id)?.toString();
    if (!participantId) {
      toast.error('Invalid user selected');
      return;
    }
    try {
      const conv = await dmService.getOrCreateConversation(participantId);
      setConversations((prev) => {
        if (prev.find((c) => c._id === conv._id)) return prev;
        return [conv, ...prev];
      });
      openConversation(conv);
    } catch (err) {
      toast.error('Could not open conversation');
    }
  }, [openConversation]);

  const handleNewDMSelect = async (selectedUser) => {
    setShowNewDM(false);
    await startDM(selectedUser);
  };

  // Following users who don't have a conversation yet
  const conversationUserIds = new Set(
    conversations.map((c) => c.otherUser?._id).filter(Boolean)
  );
  const followingWithoutConv = following.filter(
    (u) => !conversationUserIds.has(u._id)
  );

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div
        className="flex rounded-2xl overflow-hidden shadow-xl bg-base-100"
        style={{ height: 'calc(100vh - 140px)', minHeight: '520px' }}
      >
        {/* ── LEFT SIDEBAR ───────────────────────────────────────────── */}
        <div
          className={`flex flex-col border-r border-base-200
            ${mobileShowChat ? 'hidden md:flex' : 'flex'}
            w-full md:w-80 lg:w-96 flex-shrink-0`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-base-200">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg">Messages</h2>
              {totalUnread > 0 && (
                <span className="badge badge-primary badge-sm">{totalUnread}</span>
              )}
            </div>
            <button
              className="btn btn-ghost btn-sm btn-circle tooltip tooltip-left"
              data-tip="New message"
              onClick={() => setShowNewDM(true)}
            >
              <FiEdit size={17} />
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2">
            {loadingConvs && (
              <div className="flex justify-center pt-16">
                <span className="loading loading-spinner loading-md" />
              </div>
            )}

            {/* Conversations */}
            {!loadingConvs && conversations.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {conversations.map((conv) => (
                  <ConversationItem
                    key={conv._id}
                    conv={conv}
                    isActive={activeConv?._id === conv._id}
                    onClick={() => openConversation(conv)}
                  />
                ))}
              </div>
            )}

            {/* Following section */}
            {!loadingConvs && followingWithoutConv.length > 0 && (
              <div className="mt-3">
                <p className="px-4 py-1.5 text-xs font-semibold text-base-content/40 uppercase tracking-wider">
                  Following
                </p>
                <div className="flex flex-col gap-0.5">
                  {followingWithoutConv.map((u) => (
                    <FollowingItem key={u._id} user={u} onClick={() => startDM(u)} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!loadingConvs && conversations.length === 0 && followingWithoutConv.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-base-content/40 px-6 text-center py-16">
                <FiMessageSquare size={40} />
                <div>
                  <p className="font-semibold text-base-content/60 mb-1">No messages yet</p>
                  <p className="text-sm">Follow people or search to start chatting.</p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowNewDM(true)}>
                  New Message
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────── */}
        <div className={`flex-1 flex flex-col min-w-0 ${mobileShowChat ? 'flex' : 'hidden md:flex'}`}>
          {activeConv ? (
            <>
              <ChatHeader
                conversation={activeConv}
                onBack={() => {
                  setMobileShowChat(false);
                  navigate('/dm', { replace: true });
                }}
              />
              <div className="flex-1 overflow-hidden">
                <ChatWindow
                  key={activeConv._id}
                  roomType="dm"
                  roomId={activeConv._id}
                  initialMessages={initialMessages}
                  canChat={true}
                  emptyText="No messages yet. Say something!"
                  className="h-full rounded-none"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-base-content/30 p-8">
              <FiMessageSquare size={56} />
              <div className="text-center">
                <p className="text-lg font-semibold text-base-content/50 mb-1">Your messages</p>
                <p className="text-sm">Select a conversation or start a new one.</p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowNewDM(true)}>
                New Message
              </button>
            </div>
          )}
        </div>
      </div>

      {showNewDM && (
        <NewDMModal onSelect={handleNewDMSelect} onClose={() => setShowNewDM(false)} />
      )}
    </div>
  );
}
