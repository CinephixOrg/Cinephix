import React from "react";
import { Link } from "react-router-dom";

/**
 * MatchLeaderboard Component
 * Displays top 3 matches in a classic leaderboard layout (2, 1, 3)
 * with premium styling, crowns, and smooth animations
 */
export default function MatchLeaderboard({ matches }) {
  if (!matches || matches.length === 0) return null;

  const top3 = matches.slice(0, 3);

  // Arrange as: 2, 1, 3 (left, center, right)
  const arranged = [top3[1], top3[0], top3[2]].filter(Boolean);
  const positions = ["left", "center", "right"];

  const getLeaderboardItem = (match, position, rank) => {
    if (!match) return null;

    const isCenterRank1 = rank === 1;

    return (
      <div
        key={match.user._id}
        className="flex flex-col items-center animate-leaderboard-entrance"
      >
        {/* Position Label */}
        <span className="text-sm font-bold text-primary opacity-70 mb-2">
          Rank #{rank}
        </span>

        {/* Avatar Container */}
        <div className="relative mb-4">
          {/* Crown Icon for Rank 1 */}
          {isCenterRank1 && (
            <div className="absolute -top-3 -right-2 text-3xl animate-crown-bounce">
              👑
            </div>
          )}

          {/* Avatar Circle with Border */}
          <Link
            to={`/profile/${match.user._id}`}
            className={`relative rounded-full border-4 border-primary overflow-hidden block
            transition-all duration-300 hover:scale-105 cursor-pointer
            ${
              isCenterRank1
                ? "w-32 h-32 shadow-2xl shadow-primary/40"
                : "w-24 h-24 shadow-lg shadow-primary/20"
            }
            `}
          >
            <img
              src={
                match.user.profile_pic_url ||
                `https://ui-avatars.com/api/?name=${match.user.username}`
              }
              alt={match.user.username}
              className="w-full h-full object-cover"
            />
          </Link>

          {/* Glow Effect */}
          <div
            className={`absolute inset-0 rounded-full border-2 border-primary opacity-40 
            ${
              isCenterRank1
                ? "w-32 h-32 animate-pulse"
                : "w-24 h-24 animate-pulse opacity-20"
            }
            `}
          />
        </div>

        {/* Username */}
        <Link to={`/profile/${match.user._id}`}>
          <h3 className="text-lg font-bold text-white mb-1 text-center max-w-xs truncate hover:text-primary hover:underline transition-all">
            {match.user.username}
          </h3>
        </Link>

        {/* Match Percentage */}
        <div className="flex items-center justify-center mb-4">
          <span className="text-2xl font-bold text-primary">
            {match.matchPercentage}%
          </span>
        </div>

        {/* Bio if available */}
        {match.user.bio && (
          <p className="text-xs text-base-content/60 text-center max-w-xs line-clamp-2 mb-4">
            {match.user.bio}
          </p>
        )}

        {/* Action Buttons */}
        <Link
          to={`/profile/${match.user._id}`}
          className="btn btn-sm btn-primary text-white"
        >
          View Profile
        </Link>
      </div>
    );
  };

  return (
    <div className="mb-16 animate-fade-in-scale">
      {/* Header */}
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
          🏆 Top Matches
        </h2>
        <p className="text-base-content/60">
          Your highest CineMatch connections
        </p>
      </div>

      {/* Leaderboard Container */}
      <div className="flex justify-center items-end gap-12 lg:gap-16 mb-12 px-4">
        {/* Left (2nd Place) */}
        <div className="flex-1 max-w-xs">
          {getLeaderboardItem(arranged[0], positions[0], 2)}
        </div>

        {/* Center (1st Place) - Slightly elevated */}
        <div className="flex-1 max-w-xs transform lg:scale-110 origin-bottom">
          {getLeaderboardItem(arranged[1], positions[1], 1)}
        </div>

        {/* Right (3rd Place) */}
        <div className="flex-1 max-w-xs">
          {getLeaderboardItem(arranged[2], positions[2], 3)}
        </div>
      </div>

      {/* Decorative Divider */}
      <div className="flex justify-center mb-12">
        <div className="h-1 w-24 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full opacity-50" />
      </div>
    </div>
  );
}
