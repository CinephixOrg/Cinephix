import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { AuthContext } from '../../context/AuthContext';

export default function MemberList({ members = [], loading }) {
  const { user: currentUser } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="flex justify-center p-16">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center p-16 text-base-content/50">
        No members yet. Be the first to join!
      </div>
    );
  }

  // Current user's card first, rest in original order
  const sorted = [
    ...members.filter((m) => m.user._id === currentUser?._id),
    ...members.filter((m) => m.user._id !== currentUser?._id),
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4">
      {sorted.map((m) => {
        const isMe = m.user._id === currentUser?._id;
        const cardClass =
          'flex flex-col items-center gap-2 p-3 rounded-xl bg-base-100 text-center transition-colors';

        const inner = (
          <>
            <div className="avatar">
              {m.user.profile_pic_url ? (
                <div className="w-14 rounded-full">
                  <img src={m.user.profile_pic_url} alt={m.user.username} />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-full bg-neutral flex items-center justify-center">
                  <span className="text-xl font-bold text-neutral-content">
                    {m.user.username?.[0]?.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <span className="text-sm font-semibold truncate w-full text-center">
              {m.user.username}
              {isMe && (
                <span className="ml-1 text-xs font-normal text-base-content/40">(you)</span>
              )}
            </span>
            <span className="text-xs text-base-content/50">
              {m.joinedAt ? `Joined ${format(new Date(m.joinedAt), 'MMM yyyy')}` : ''}
            </span>
          </>
        );

        return isMe ? (
          <div key={m.user._id} className={`${cardClass} opacity-70 cursor-default`}>
            {inner}
          </div>
        ) : (
          <Link
            key={m.user._id}
            to={`/profile/${m.user._id}`}
            className={`${cardClass} hover:bg-base-200`}
          >
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
