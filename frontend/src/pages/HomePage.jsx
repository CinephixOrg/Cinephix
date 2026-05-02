// pages/HomePage.jsx
import React, { useContext, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import FeedItem from "../components/FeedItem.jsx";
import SuggestedUsers from "../components/SuggestedUsers.jsx";
import TopPicks from "../components/TopPicks.jsx";
import feedService from "../api/feedService.js";

function FeedSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3">
          <div className="w-9 h-9 rounded-full bg-base-300 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-base-300 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-base-300 rounded animate-pulse w-1/2" />
          </div>
          <div className="w-10 h-14 rounded bg-base-300 animate-pulse flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

function EmptyFeed() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <span className="text-5xl">🎬</span>
      <h3 className="text-lg font-semibold text-base-content">Your feed is empty</h3>
      <p className="text-sm text-base-content/50 max-w-xs">
        Follow other cinephiles to see their ratings, reviews, and watchlist updates here.
      </p>
      <Link to="/network" className="btn btn-primary btn-sm mt-2">
        Find people to follow
      </Link>
    </div>
  );
}

export default function HomePage() {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const fetchFeed = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const res = await feedService.getFeed(pageNum);
      const newItems = res?.items || [];

      setItems((prev) => (append ? [...prev, ...newItems] : newItems));
      setHasMore(res?.hasMore || false);
      setPage(pageNum);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load feed");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed(1);
  }, [fetchFeed]);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      <div className="flex gap-6 items-start">
        {/* Main feed column */}
        <div className="flex-1 min-w-0">
          <TopPicks />

          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-base-content">Activity Feed</h1>
            <button
              onClick={() => fetchFeed(1)}
              className="btn btn-ghost btn-sm text-base-content/50"
              disabled={loading}
            >
              ↻ Refresh
            </button>
          </div>

          {loading ? (
            <FeedSkeleton />
          ) : error ? (
            <div className="text-center py-10 text-error text-sm">{error}</div>
          ) : items.length === 0 ? (
            <EmptyFeed />
          ) : (
            <>
              <div className="bg-base-100 rounded-2xl shadow divide-y divide-base-200">
                {items.map((item, i) => (
                  <FeedItem key={`${item.type}-${item.createdAt}-${i}`} item={item} />
                ))}
              </div>

              {hasMore && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => fetchFeed(page + 1, true)}
                    disabled={loadingMore}
                    className="btn btn-outline btn-sm"
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 hidden lg:block">
          <SuggestedUsers />
        </div>
      </div>
    </div>
  );
}
