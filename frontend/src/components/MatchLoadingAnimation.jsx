import React from "react";

/**
 * LoadingAnimation Component
 * Shows skeleton cards with staggered fade-in animation
 * Provides visual feedback while match results are being loaded
 */
export default function LoadingAnimation({ cardCount = 6 }) {
  return (
    <div className="space-y-6">
      {/* Leaderboard Skeleton */}
      <div className="flex justify-center items-end gap-12 lg:gap-16 mb-12 px-4 animate-pulse">
        {/* Left Position */}
        <div className="flex-1 max-w-xs flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-base-300 mb-4" />
          <div className="w-32 h-4 bg-base-300 rounded mb-2" />
          <div className="w-20 h-4 bg-base-300 rounded" />
        </div>

        {/* Center Position */}
        <div className="flex-1 max-w-xs flex flex-col items-center">
          <div className="w-32 h-32 rounded-full bg-base-300 mb-4" />
          <div className="w-40 h-4 bg-base-300 rounded mb-2" />
          <div className="w-24 h-4 bg-base-300 rounded" />
        </div>

        {/* Right Position */}
        <div className="flex-1 max-w-xs flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-base-300 mb-4" />
          <div className="w-32 h-4 bg-base-300 rounded mb-2" />
          <div className="w-20 h-4 bg-base-300 rounded" />
        </div>
      </div>

      {/* Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {Array.from({ length: cardCount }).map((_, index) => (
          <div
            key={index}
            className="animate-pulse"
            style={{
              animationDelay: `${index * 100}ms`,
            }}
          >
            <div className="h-full bg-gradient-to-br from-base-100 to-base-200 rounded-2xl border border-primary/20 p-6 flex flex-col">
              {/* Avatar Skeleton */}
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 rounded-full bg-base-300" />
              </div>

              {/* Username Skeleton */}
              <div className="w-32 h-4 bg-base-300 rounded mx-auto mb-4" />

              {/* Bio Skeleton */}
              <div className="space-y-2 mb-6">
                <div className="w-full h-3 bg-base-300 rounded" />
                <div className="w-4/5 h-3 bg-base-300 rounded" />
              </div>

              {/* Percentage Skeleton */}
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-base-300" />
              </div>

              {/* Buttons Skeleton */}
              <div className="space-y-2">
                <div className="h-10 bg-base-300 rounded-lg" />
                <div className="h-10 bg-base-300 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
