import React, { useContext, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import FeedItem from "../components/FeedItem.jsx";
import SuggestedUsers from "../components/SuggestedUsers.jsx";
import TopPicks from "../components/TopPicks.jsx";
import PopularThisWeek from "../components/PopularThisWeek.jsx";
import PopularReviews from "../components/PopularReviews.jsx";
import RecommendationsRow from "../components/RecommendationsRow.jsx";
import PublicListCard from "../components/PublicListCard.jsx";
import feedService from "../api/feedService.js";
import { listService } from "../api/listService.js";

const TABS = ["Activity", "Lists", "For You"];

// ── Skeletons / Empty states ──────────────────────────────────────
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
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <span className="text-5xl">🎬</span>
      <h3 className="text-lg font-semibold text-base-content">{t("Your feed is empty")}</h3>
      <p className="text-sm text-base-content/50 max-w-xs">
        {t("Follow other cinephiles to see their ratings, reviews, and watchlist updates here.")}
      </p>
      <Link to="/network" className="btn btn-primary btn-sm mt-2">
        {t("Find people to follow")}
      </Link>
    </div>
  );
}

function ListsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card bg-base-100 p-4 h-28 animate-pulse">
          <div className="h-3 bg-base-300 rounded w-1/3 mb-3" />
          <div className="h-4 bg-base-300 rounded w-2/3 mb-2" />
          <div className="h-3 bg-base-300 rounded w-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyLists() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
      <span className="text-5xl">📋</span>
      <h3 className="text-lg font-semibold">{t("No public lists yet")}</h3>
      <p className="text-sm text-base-content/50 max-w-xs">
        {t("Follow more people or be the first to create and share a public list.")}
      </p>
      <Link to="/my-lists" className="btn btn-primary btn-sm mt-2">
        {t("Create a list")}
      </Link>
    </div>
  );
}

// ── Tab panels ────────────────────────────────────────────────────
function ActivityTab() {
  const { t } = useTranslation();
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

  useEffect(() => { fetchFeed(1); }, [fetchFeed]);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-base-content">{t("Activity Feed")}</h2>
        <button
          onClick={() => fetchFeed(1)}
          className="btn btn-ghost btn-sm text-base-content/50"
          disabled={loading}
        >
          ↻ {t("Refresh")}
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
                {loadingMore ? t("Loading") : t("Load more")}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function ListsTab() {
  const { t } = useTranslation();
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listService
      .discoverLists(24)
      .then((data) => setLists(data.lists || []))
      .catch(() => setLists([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">{t("Discover Lists")}</h2>
          <p className="text-sm text-base-content/50 mt-0.5">
            {t("Public lists from people you follow and the community")}
          </p>
        </div>
        <Link to="/my-lists" className="btn btn-outline btn-sm">
          {t("My Lists")}
        </Link>
      </div>

      {loading ? (
        <ListsSkeleton />
      ) : lists.length === 0 ? (
        <EmptyLists />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {lists.map((list) => (
            <PublicListCard key={list._id} list={list} />
          ))}
        </div>
      )}
    </>
  );
}

function ForYouTab() {
  return (
    <div className="py-2">
      <RecommendationsRow />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function HomePage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("Activity");

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      <div className="flex gap-6 items-start">
        {/* Main column */}
        <div className="flex-1 min-w-0">
          <TopPicks />
          <PopularThisWeek />
          <PopularReviews />

          {/* Tab bar */}
          <div className="flex gap-1 mb-6 border-b border-base-300">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-base-content/50 hover:text-base-content"
                }`}
              >
                {t(tab)}
              </button>
            ))}
          </div>

          {activeTab === "Activity" && <ActivityTab />}
          {activeTab === "Lists" && <ListsTab />}
          {activeTab === "For You" && <ForYouTab />}
        </div>

        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 hidden lg:block">
          <SuggestedUsers />
        </div>
      </div>
    </div>
  );
}
