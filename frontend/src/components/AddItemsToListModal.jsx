import React, { useState, useEffect, useCallback, useRef } from "react";
import { FaSearch, FaFilter, FaTimes, FaCheck } from "react-icons/fa";
import API from "../api/axios";
import { listService } from "../api/listService";
import { toast } from "react-hot-toast";
import movieGenresData from "../data/movieGenres.json";
import seriesGenresData from "../data/seriesGenres.json";

const TMDB_IMG = "https://image.tmdb.org/t/p/w300";
const PLACEHOLDER = "https://placehold.co/300x450/1d232a/e0e0e0?text=No+Poster";
const RECENT_YEARS = Array.from({ length: 35 }, (_, i) => String(2025 - i));

// ── Selectable poster card ────────────────────────────────────────
function SelectableCard({ item, contentType, selected, alreadyInList, onToggle }) {
  const title = item.title || item.name;
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);

  return (
    <button
      type="button"
      onClick={() => !alreadyInList && onToggle(item)}
      className={`relative rounded-xl overflow-hidden transition-all group text-left focus:outline-none
        ${alreadyInList ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
        ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-base-200" : "ring-1 ring-base-300 hover:ring-primary/50"}
      `}
    >
      <img
        src={item.poster_path ? `${TMDB_IMG}${item.poster_path}` : PLACEHOLDER}
        alt={title}
        className="w-full aspect-[2/3] object-cover"
        onError={(e) => { e.target.src = PLACEHOLDER; }}
      />

      {/* Selection overlay */}
      {selected && (
        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
          <div className="bg-primary text-primary-content rounded-full p-1.5">
            <FaCheck size={14} />
          </div>
        </div>
      )}

      {/* Already-in-list badge */}
      {alreadyInList && (
        <div className="absolute top-1.5 left-1.5 badge badge-xs badge-success">Added</div>
      )}

      {/* Title tooltip on hover */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 translate-y-full group-hover:translate-y-0 transition-transform">
        <p className="text-white text-xs font-semibold line-clamp-2">{title}</p>
        {year && <p className="text-white/60 text-xs">{year}</p>}
      </div>
    </button>
  );
}

// ── Main modal ────────────────────────────────────────────────────
export default function AddItemsToListModal({ listId, listName, existingItems = [], onClose, onAdded }) {
  const [contentType, setContentType] = useState("movie");
  const [query, setQuery] = useState("");
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  // Map<id, { item, contentType }> — persists across pages, filters, and searches
  const [selectedItems, setSelectedItems] = useState(new Map());
  const [adding, setAdding] = useState(false);
  const searchInputRef = useRef(null);

  const genres = contentType === "movie" ? movieGenresData.genres : seriesGenresData.genres;

  // IDs already in the list for this content type
  const alreadyInListIds = new Set(
    existingItems.filter((i) => i.itemType === contentType).map((i) => i.itemId.toString())
  );

  const fetchResults = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, limit: 18 });
      if (query.trim()) params.set("title", query.trim());
      if (selectedGenres.length) params.set("genres", selectedGenres.join(","));
      if (selectedYears.length) params.set("years", selectedYears.join(","));

      const endpoint = contentType === "movie" ? "/movies" : "/series";
      const res = await API.get(`${endpoint}?${params}`);

      setResults(res.data || []);
      setTotalPages(res.pagination?.pages || 1);
      setPage(pg);
    } catch {
      toast.error("Failed to load results");
    } finally {
      setLoading(false);
    }
  }, [contentType, query, selectedGenres, selectedYears]);

  // Re-fetch when content type changes; only reset results/page, never selection
  useEffect(() => {
    setResults([]);
    setPage(1);
    setTotalPages(1);
    fetchResults(1);
  }, [contentType]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e) => {
    e?.preventDefault();
    fetchResults(1);
  };

  const handlePageChange = (pg) => {
    fetchResults(pg);
  };

  const toggleGenre = (id) => {
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const toggleYear = (y) => {
    setSelectedYears((prev) =>
      prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y]
    );
  };

  const toggleItem = (item) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      const id = item._id.toString();
      next.has(id) ? next.delete(id) : next.set(id, { item, contentType });
      return next;
    });
  };

  const handleAddSelected = async () => {
    if (selectedItems.size === 0) return;
    setAdding(true);
    let added = 0;
    let skipped = 0;

    await Promise.allSettled(
      Array.from(selectedItems.values()).map(async ({ item, contentType: ct }) => {
        try {
          await listService.addItem(listId, item._id, ct);
          added++;
        } catch (err) {
          if (err.message === "Already in list") skipped++;
        }
      })
    );

    setAdding(false);
    setSelectedItems(new Map());

    if (added > 0) toast.success(`Added ${added} item${added !== 1 ? "s" : ""} to "${listName}"`);
    if (skipped > 0) toast(`${skipped} item${skipped !== 1 ? "s were" : " was"} already in the list`);

    onAdded?.();
  };

  const selectedCount = selectedItems.size;

  return (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 flex-shrink-0">
          <div>
            <h3 className="font-bold text-lg">Add Items to List</h3>
            <p className="text-sm text-base-content/50">{listName}</p>
          </div>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        {/* ── Type switcher ── */}
        <div className="flex gap-2 px-6 pt-4 flex-shrink-0">
          {["movie", "series"].map((t) => (
            <button
              key={t}
              className={`btn btn-sm capitalize ${contentType === t ? "btn-primary" : "btn-outline"}`}
              onClick={() => setContentType(t)}
            >
              {t === "movie" ? "Movies" : "Series"}
            </button>
          ))}
        </div>

        {/* ── Search bar ── */}
        <form onSubmit={handleSearch} className="px-6 pt-3 pb-2 flex gap-2 flex-shrink-0">
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              type="text"
              className="input input-bordered w-full pr-10"
              placeholder={contentType === "movie" ? "Search movies…" : "Search series…"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                onClick={() => { setQuery(""); searchInputRef.current?.focus(); }}
              >
                <FaTimes size={12} />
              </button>
            )}
          </div>
          <button type="submit" className="btn btn-primary">
            <FaSearch />
          </button>
          <button
            type="button"
            className={`btn ${filtersOpen ? "btn-secondary" : "btn-outline"}`}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <FaFilter />
            {(selectedGenres.length > 0 || selectedYears.length > 0) && (
              <span className="badge badge-xs badge-primary ml-1">
                {selectedGenres.length + selectedYears.length}
              </span>
            )}
          </button>
        </form>

        {/* ── Filters panel ── */}
        {filtersOpen && (
          <div className="px-6 pb-3 flex-shrink-0 border-b border-base-300 space-y-3">
            {/* Genres */}
            <div>
              <p className="text-xs font-semibold text-base-content/50 mb-1.5 uppercase tracking-wide">Genres</p>
              <div className="flex flex-wrap gap-1.5">
                {genres.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={`badge badge-md cursor-pointer transition-colors ${
                      selectedGenres.includes(String(g.id))
                        ? "badge-primary"
                        : "badge-outline hover:badge-primary/40"
                    }`}
                    onClick={() => toggleGenre(String(g.id))}
                  >
                    {g.name}
                  </button>
                ))}
                {selectedGenres.length > 0 && (
                  <button
                    type="button"
                    className="badge badge-md badge-ghost cursor-pointer"
                    onClick={() => setSelectedGenres([])}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Years */}
            <div>
              <p className="text-xs font-semibold text-base-content/50 mb-1.5 uppercase tracking-wide">Years</p>
              <div className="flex flex-wrap gap-1.5">
                {RECENT_YEARS.map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={`badge badge-md cursor-pointer transition-colors ${
                      selectedYears.includes(y)
                        ? "badge-primary"
                        : "badge-outline hover:badge-primary/40"
                    }`}
                    onClick={() => toggleYear(y)}
                  >
                    {y}
                  </button>
                ))}
                {selectedYears.length > 0 && (
                  <button
                    type="button"
                    className="badge badge-md badge-ghost cursor-pointer"
                    onClick={() => setSelectedYears([])}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Results grid ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-xl bg-base-300 animate-pulse" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-base-content/40">
              <p className="text-lg">No results found.</p>
              <p className="text-sm mt-1">Try different search terms or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {results.map((item) => (
                <SelectableCard
                  key={item._id}
                  item={item}
                  contentType={contentType}
                  selected={selectedItems.has(item._id.toString())}
                  alreadyInList={alreadyInListIds.has(item._id.toString())}
                  onToggle={toggleItem}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Pagination ── */}
        {!loading && totalPages > 1 && (
          <div className="flex justify-center gap-2 px-6 py-2 border-t border-base-300 flex-shrink-0">
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
            >
              ← Prev
            </button>
            <span className="btn btn-sm btn-ghost no-animation cursor-default">
              {page} / {totalPages}
            </span>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
            >
              Next →
            </button>
          </div>
        )}

        {/* ── Footer: selection + add ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-base-300 bg-base-200 flex-shrink-0">
          <span className="text-sm text-base-content/60">
            {selectedCount === 0
              ? "Click posters to select"
              : `${selectedCount} item${selectedCount !== 1 ? "s" : ""} selected`}
          </span>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              className={`btn btn-primary btn-sm ${adding ? "loading" : ""}`}
              onClick={handleAddSelected}
              disabled={selectedCount === 0 || adding}
            >
              {adding ? "Adding…" : `Add ${selectedCount > 0 ? selectedCount : ""} item${selectedCount !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
