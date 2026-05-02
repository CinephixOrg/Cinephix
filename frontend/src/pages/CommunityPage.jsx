import { useState, useEffect } from 'react';
import communityService from '../api/communityService';
import GroupCard from '../components/community/GroupCard';
import toast from 'react-hot-toast';

const CATEGORIES = ['all', 'genre', 'director', 'era', 'style'];

export default function CommunityPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    communityService
      .getAllGroups()
      .then(setGroups)
      .catch(() => toast.error('Failed to load groups'))
      .finally(() => setLoading(false));
  }, []);

  const handleJoin = async (slug) => {
    setActionLoading(slug);
    try {
      await communityService.joinGroup(slug);
      setGroups((prev) =>
        prev.map((g) =>
          g.slug === slug ? { ...g, isMember: true, memberCount: g.memberCount + 1 } : g
        )
      );
      toast.success('Joined group!');
    } catch {
      toast.error('Failed to join group');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeave = async (slug) => {
    setActionLoading(slug);
    try {
      await communityService.leaveGroup(slug);
      setGroups((prev) =>
        prev.map((g) =>
          g.slug === slug
            ? { ...g, isMember: false, memberCount: Math.max(0, g.memberCount - 1) }
            : g
        )
      );
      toast.success('Left group');
    } catch {
      toast.error('Failed to leave group');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered =
    activeCategory === 'all' ? groups : groups.filter((g) => g.category === activeCategory);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Community Groups</h1>
        <p className="text-base-content/60">
          Join groups to connect with fellow film enthusiasts and chat in real-time.
        </p>
      </header>

      {/* Category filter tabs */}
      <div role="tablist" className="tabs tabs-boxed mb-8 w-fit">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            role="tab"
            className={`tab capitalize ${activeCategory === cat ? 'tab-active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center p-24">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center p-24 text-base-content/50">No groups in this category.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((group) => (
            <GroupCard
              key={group._id}
              group={group}
              onJoin={handleJoin}
              onLeave={handleLeave}
              loading={actionLoading === group.slug}
            />
          ))}
        </div>
      )}
    </div>
  );
}
