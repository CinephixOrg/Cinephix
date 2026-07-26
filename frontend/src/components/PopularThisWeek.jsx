import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import feedService from "../api/feedService.js";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w300";
const POSTER_PLACEHOLDER = "https://placehold.co/300x450/1d232a/e0e0e0?text=No+Poster";

function PopularCard({ item }) {
  const { t } = useTranslation();
  const { content, addCount } = item;
  return (
    <Link to={`/content/${content.type}/${content.id}`} className="flex-shrink-0 w-32 group">
      <div className="relative rounded-xl overflow-hidden ring-1 ring-base-300 group-hover:ring-primary transition-all">
        <img
          src={content.poster_path ? `${TMDB_IMAGE_BASE}${content.poster_path}` : POSTER_PLACEHOLDER}
          alt={content.title}
          className="w-full aspect-[2/3] object-cover"
          onError={(e) => { e.target.src = POSTER_PLACEHOLDER; }}
        />
        <div className="absolute top-1.5 left-1.5 bg-black/70 text-white text-xs font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
          <span className="text-primary">↑</span>
          {addCount}
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 bg-black/50">
          <span className="text-xs text-white/70 capitalize">{content.type}</span>
        </div>
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-xs font-semibold text-base-content line-clamp-2 leading-tight">
          {content.title}
        </p>
        <p className="text-xs text-base-content/50 mt-0.5">
          {addCount === 1 ? t("add_this_week", { count: 1 }) : t("add_this_week_plural", { count: addCount })}
        </p>
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

export default function PopularThisWeek() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    feedService
      .getPopularThisWeek(20)
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const scroll = (dir) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 300, behavior: "smooth" });
    }
  };

  if (!loading && items.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-base-content">{t("Popular this week")}</h2>
        <div className="flex gap-1">
          <button
            onClick={() => scroll(-1)}
            className="btn btn-ghost btn-xs text-base-content/50"
            aria-label="Scroll left"
          >
            ←
          </button>
          <button
            onClick={() => scroll(1)}
            className="btn btn-ghost btn-xs text-base-content/50"
            aria-label="Scroll right"
          >
            →
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : items.map((item, i) => <PopularCard key={`${item.content.id}-${i}`} item={item} />)}
      </div>
    </section>
  );
}
