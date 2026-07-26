import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import communityService from '../api/communityService';
import ChatWindow from '../components/community/ChatWindow';
import MemberList from '../components/community/MemberList';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { FiUsers, FiArrowLeft } from 'react-icons/fi';

const TABS = ['Chat', 'Members', 'About'];

const CATEGORY_BADGE = {
  director: 'badge-primary',
  genre: 'badge-secondary',
  era: 'badge-accent',
  style: 'badge-info',
};

export default function GroupDetailPage() {
  const { slug } = useParams();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [initialMessages, setInitialMessages] = useState([]);
  const [activeTab, setActiveTab] = useState('Chat');
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Load group details
  useEffect(() => {
    communityService
      .getGroupBySlug(slug)
      .then(setGroup)
      .catch(() => toast.error('Group not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  // Load initial chat messages when group is known and user is a member
  useEffect(() => {
    if (!group?.isMember) return;
    setMessagesLoading(true);
    communityService
      .getMessages(slug)
      .then(setInitialMessages)
      .catch(() => { })
      .finally(() => setMessagesLoading(false));
  }, [slug, group?.isMember]);

  // Lazy-load members on first visit to Members tab
  useEffect(() => {
    if (activeTab !== 'Members' || members.length > 0) return;
    setMembersLoading(true);
    communityService
      .getMembers(slug)
      .then(setMembers)
      .catch(() => toast.error('Failed to load members'))
      .finally(() => setMembersLoading(false));
  }, [activeTab, slug]);

  const handleJoin = async () => {
    setActionLoading(true);
    try {
      await communityService.joinGroup(slug);
      setGroup((prev) => ({ ...prev, isMember: true, memberCount: prev.memberCount + 1 }));
      toast.success('Joined group!');
    } catch {
      toast.error('Failed to join');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    setActionLoading(true);
    try {
      await communityService.leaveGroup(slug);
      setGroup((prev) => ({
        ...prev,
        isMember: false,
        memberCount: Math.max(0, prev.memberCount - 1),
      }));
      toast.success('Left group');
    } catch {
      toast.error('Failed to leave');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-24">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center p-24">
        Group not found.{' '}
        <Link to="/community" className="link link-primary">
          Go back
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        to="/community"
        className="inline-flex items-center gap-2 text-sm text-base-content/60 hover:text-primary mb-6"
      >
        <FiArrowLeft size={14} /> Back to Communities
      </Link>

      {/* Group header */}
      <div className="bg-base-100 rounded-2xl p-6 mb-6 flex justify-between items-start gap-4 shadow">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`badge ${CATEGORY_BADGE[group.category] ?? 'badge-ghost'} capitalize`}
            >
              {group.category}
            </span>
          </div>
          <h1 className="text-2xl font-bold mb-1">{group.name}</h1>
          <p className="text-base-content/60 text-sm mb-3">{group.description}</p>
          <span className="text-sm text-base-content/50 flex items-center gap-1">
            <FiUsers size={14} />
            {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
          </span>
        </div>

        <div className="flex-shrink-0">
          {group.isMember ? (
            <button
              className="btn btn-outline btn-error btn-sm"
              onClick={handleLeave}
              disabled={actionLoading}
            >
              Leave
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleJoin}
              disabled={actionLoading}
            >
              Join Group
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="tabs tabs-boxed mb-6">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            className={`tab ${activeTab === tab ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Chat' && (
        <ChatWindow
          roomType="group"
          roomId={group._id}
          initialMessages={initialMessages}
          canChat={group.isMember}
          emptyText="No messages yet. Start the conversation!"
        />
      )}

      {activeTab === 'Members' && (
        <MemberList members={members} loading={membersLoading} />
      )}

      {activeTab === 'About' && (
        <div className="bg-base-100 rounded-2xl p-6 shadow">
          <h2 className="text-lg font-semibold mb-4">About {group.name}</h2>
          <p className="text-base-content/70 mb-5">{group.description}</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {group.tags?.map((tag) => (
              <span key={tag} className="badge badge-outline">
                {tag}
              </span>
            ))}
          </div>
          {group.createdAt && (
            <p className="text-sm text-base-content/50">
              Created {format(new Date(group.createdAt), 'MMMM d, yyyy')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
