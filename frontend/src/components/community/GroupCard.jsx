import { Link } from 'react-router-dom';
import { FiUsers } from 'react-icons/fi';

const CATEGORY_BADGE = {
  director: 'badge-primary',
  genre: 'badge-secondary',
  era: 'badge-accent',
  style: 'badge-info',
};

export default function GroupCard({ group, onJoin, onLeave, loading }) {
  return (
    <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-300 flex flex-col">
      <div className="card-body p-5 flex flex-col flex-1">
        <div className="flex justify-between items-center mb-1">
          <span
            className={`badge ${CATEGORY_BADGE[group.category] ?? 'badge-ghost'} badge-sm capitalize`}
          >
            {group.category}
          </span>
          <span className="text-base-content/50 text-xs flex items-center gap-1">
            <FiUsers size={12} />
            {group.memberCount}
          </span>
        </div>

        <Link to={`/community/${group.slug}`}>
          <h2 className="card-title text-base hover:text-primary transition-colors cursor-pointer">
            {group.name}
          </h2>
        </Link>

        <p className="text-sm text-base-content/70 line-clamp-2 flex-1">
          {group.description}
        </p>

        <div className="flex flex-wrap gap-1 mt-2">
          {group.tags?.slice(0, 3).map((tag) => (
            <span key={tag} className="badge badge-ghost badge-xs">
              {tag}
            </span>
          ))}
        </div>

        <div className="card-actions justify-end mt-3">
          {group.isMember ? (
            <button
              className="btn btn-sm btn-outline btn-error"
              onClick={() => onLeave(group.slug)}
              disabled={loading}
            >
              Leave
            </button>
          ) : (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => onJoin(group.slug)}
              disabled={loading}
            >
              Join
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
