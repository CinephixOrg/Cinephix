import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import feedService from "../api/feedService";

const TMDB_IMG = "https://image.tmdb.org/t/p/w300";
const PLACEHOLDER = "https://placehold.co/300x450/1d232a/e0e0e0?text=No+Poster";

function RecommendationCard({ item }) {
  const title = item.title || item.name;
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  const score = item.vote_average ? Math.round(item.vote_average * 10) / 10 : null;

  return (
    <Link
      to={`/content/${item.contentType}/${item._id}`}
      className="flex-shrink-0 w-32 group"
    >
      <div className="relative rounded-xl overflow-hidden ring-1 ring-base-300 group-hover:ring-primary transition-all">
        <img
          src={item.poster_path ? `${TMDB_IMG}${item.poster_path}` : PLACEHOLDER}
          alt={title}
          className="w-full aspect-[2/3] object-cover"
          onError={(e) => { e.target.src = PLACEHOLDER; }}
        />
        {score && (
          <div className="absolute top-1.5 right-1.5 bg-black/70 text-white text-xs font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
            <span className="text-warning">★</span>
            {score}
          </div>
        )}
        <div className="absolute bottom-1.5 left-1.5">
          <span className="badge badge-xs bg-black/60 text-white border-0 capitalize">
            {item.contentType}
          </span>
        </div>
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-xs font-semibold text-base-content line-clamp-2 leading-tight">{title}</p>
        {year && <p className="text-xs text-base-content/40 mt-0.5">{year}</p>}
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-32">
      <div className="w-full aspect-[2/3] rounded-xl bg-base-300 animate-pulse" />
      <div className="mt-2 space-y-1.5">
        <div className="h-3 bg-base-300 rounded animate-pulse w-full" />
        <div className="h-3 bg-base-300 rounded animate-pulse w-2/3" />
      </div>
    </div>
  );
}

export default function RecommendationsRow() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasPersonalization, setHasPersonalization] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    feedService
      .getRecommendations(20)
      .then((data) => {
        setItems(data.recommendations || []);
        setHasPersonalization(data.hasPersonalization || false);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const scroll = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
  };

  if (!loading && items.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-base-content">
            {hasPersonalization ? t("Picked for you") : t("Popular right now")}
          </h2>
          {hasPersonalization && (
            <p className="text-xs text-base-content/40 mt-0.5">{t("Based on your genre preferences")}</p>
          )}
        </div>
        <div className="flex gap-1">
          <button onClick={() => scroll(-1)} className="btn btn-ghost btn-xs text-base-content/50">←</button>
          <button onClick={() => scroll(1)} className="btn btn-ghost btn-xs text-base-content/50">→</button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : items.map((item) => <RecommendationCard key={`${item.contentType}-${item._id}`} item={item} />)}
      </div>
    </section>
  );
}
