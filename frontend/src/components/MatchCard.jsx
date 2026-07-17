import React, { useState } from "react";
import { Link } from "react-router-dom";
import { matchService } from "../api/matchService.js";
import AnalyzeModal from "./AnalyzeModal";

/**
 * MatchCard Component
 * Premium profile card for displaying a single match
 * Includes avatar, bio, percentage, action buttons, and optional rank badge
 */
export default function MatchCard({ match, rank, animationDelay }) {
  const isTopThree = rank !== undefined && rank <= 3;
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div
      className="group animate-card-entrance"
      style={{
        animationDelay: animationDelay ? `${animationDelay}ms` : "0ms",
      }}
    >
      <div
        className={`
        relative h-full bg-gradient-to-br from-base-100 to-base-200 
        rounded-2xl border border-primary/20 overflow-hidden
        transition-all duration-300
        hover:shadow-2xl hover:shadow-primary/30
        hover:-translate-y-2
        ${isTopThree ? "ring-2 ring-primary ring-opacity-50" : ""}
        `}
      >
        {/* Rank Badge - Top Left */}
        {isTopThree && (
          <div className="absolute top-3 left-3 z-10">
            <div className="flex items-center justify-center w-10 h-10 bg-primary text-white font-bold rounded-full shadow-lg">
              {rank}
            </div>
          </div>
        )}

        {/* Background Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

        {/* Card Content */}
        <div className="relative h-full flex flex-col p-6 pb-4">
          {/* Profile Section */}
          <div className="flex-1 flex flex-col items-center mb-6">
            {/* Avatar Circle */}
            <div className="relative mb-6">
              <Link
                to={`/users/${match.user._id}`}
                className={`
                rounded-full overflow-hidden border-4 border-primary block
                transition-transform duration-300 group-hover:scale-105
                ${isTopThree ? "w-28 h-28" : "w-24 h-24"}
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

              {/* Crown for Top 3 - Top Right of Avatar */}
              {isTopThree && rank === 1 && (
                <div className="absolute -top-1 -right-1 text-2xl animate-bounce">
                  👑
                </div>
              )}

              {/* Glow Effect */}
              <div
                className={`
                absolute inset-0 rounded-full border-2 border-primary 
                opacity-30 group-hover:opacity-50 transition-opacity
                ${isTopThree ? "w-28 h-28" : "w-24 h-24"}
                `}
              />
            </div>

            {/* Username */}
            <Link to={`/users/${match.user._id}`}>
              <h3 className="text-xl font-bold text-white text-center mb-2 line-clamp-2 hover:text-primary hover:underline transition-all">
                {match.user.username}
              </h3>
            </Link>

            {/* Bio */}
            {match.user.bio && (
              <p className="text-sm text-base-content/60 text-center line-clamp-2 mb-4">
                {match.user.bio}
              </p>
            )}

            {/* Spacer */}
            <div className="flex-1" />
          </div>

          {/* Stats Section */}
          <div className="flex justify-center mb-6">
            <div className="flex items-center justify-center">
              <div
                className="radial-progress text-primary font-bold text-lg"
                style={{
                  "--value": match.matchPercentage,
                  "--size": "5rem",
                }}
              >
                {match.matchPercentage}%
              </div>
            </div>
          </div>

          {/* Buttons Section */}
          <div className="flex flex-col gap-3">
            <Link
              to={`/users/${match.user._id}`}
              className="btn btn-primary btn-sm text-white font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-primary/40"
            >
                View Profile
            </Link>

            <button
              className="btn btn-outline btn-sm text-primary hover:bg-primary/10"
              onClick={async () => {
                try {
                  setIsAnalyzing(true);
                  const res = await matchService.analyzeMatchWithUser(match.user._id, 'movie', false);
                  setAnalysisData(res);
                  setIsModalOpen(true);
                } catch (e) {
                  console.error(e);
                  // TODO: show toast
                } finally {
                  setIsAnalyzing(false);
                }
              }}
              title="Analyze with LLM (mock)"
              disabled={isAnalyzing}
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze'}
            </button>
            <AnalyzeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} data={analysisData} />
          </div>
        </div>
      </div>
    </div>
  );
}
