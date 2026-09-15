import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { listService } from "../api/listService";
import { contentService } from "../api/contentService";
import MovieCard from "../components/MovieCard";
import SeriesCard from "../components/SeriesCard";
import AddItemsToListModal from "../components/AddItemsToListModal";
import { toast } from "react-hot-toast";

export default function ListDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [list, setList] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [movies, setMovies] = useState([]);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddItems, setShowAddItems] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await listService.getListById(id);
        setList(data.list);
        setIsOwner(data.isOwner);

        const movieIds = data.list.items
          .filter((i) => i.itemType === "movie")
          .map((i) => i.itemId);
        const seriesIds = data.list.items
          .filter((i) => i.itemType === "series")
          .map((i) => i.itemId);

        const [moviesData, seriesData] = await Promise.all([
          contentService.getMoviesBulk(movieIds, true),
          contentService.getSeriesBulk(seriesIds, true),
        ]);

        setMovies(moviesData);
        setSeries(seriesData);
      } catch (err) {
        setError(err.message || "Failed to load list");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleRemoveMovie = async (movie) => {
    try {
      await listService.removeItem(id, movie._id, "movie");
      setMovies((prev) => prev.filter((m) => m._id !== movie._id));
      toast.success("Removed from list");
    } catch {
      toast.error("Failed to remove item");
    }
  };

  const handleRemoveSeries = async (s) => {
    try {
      await listService.removeItem(id, s._id, "series");
      setSeries((prev) => prev.filter((x) => x._id !== s._id));
      toast.success("Removed from list");
    } catch {
      toast.error("Failed to remove item");
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied!");
  };

  if (loading) return <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg" /></div>;
  if (error) return <div className="alert alert-error m-8">{error}</div>;
  if (!list) return null;

  const totalItems = movies.length + series.length;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold">{list.name}</h1>
              <span className={`badge ${list.isPublic ? "badge-success" : "badge-ghost"}`}>
                {list.isPublic ? "Public" : "Private"}
              </span>
            </div>
            {list.description && (
              <p className="text-base-content/60 mt-2 max-w-xl">{list.description}</p>
            )}
            <p className="text-sm text-base-content/40 mt-1">
              By{" "}
              <Link to={`/profile/${list.owner._id}`} className="hover:text-primary">
                {list.owner.username}
              </Link>{" "}
              · {totalItems} item{totalItems !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {list.isPublic && (
              <button className="btn btn-outline btn-sm" onClick={handleCopyLink}>
                Share Link
              </button>
            )}
            {isOwner && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddItems(true)}>
                + Add Items
              </button>
            )}
            {/* Name, description, visibility and titles are all edited in
                the list editor (/lists/:id/edit), shared with list creation. */}
            {isOwner && (
              <button className="btn btn-outline btn-sm" onClick={() => navigate(`/lists/${id}/edit`)}>
                Edit
              </button>
            )}
            {isOwner && (
              <Link to="/my-lists" className="btn btn-ghost btn-sm">
                ← My Lists
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {totalItems === 0 ? (
        <div className="text-center py-16 text-base-content/50">
          <p className="text-lg">This list is empty.</p>
          {isOwner && (
            <button className="btn btn-primary btn-sm mt-4" onClick={() => setShowAddItems(true)}>
              + Add Items
            </button>
          )}
        </div>
      ) : (
        <>
          {movies.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xl font-semibold mb-4">Movies</h2>
              <div className="grid grid-cols-6 md:grid-cols-5 lg:grid-cols-8 gap-3 justify-items-center">
                {movies.map((m) => (
                  <MovieCard
                    key={m._id}
                    movie={m}
                    showRemove={isOwner}
                    onRemove={() => handleRemoveMovie(m)}
                  />
                ))}
              </div>
            </section>
          )}
          {series.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4">Series</h2>
              <div className="grid grid-cols-6 md:grid-cols-5 lg:grid-cols-8 gap-3 justify-items-center">
                {series.map((s) => (
                  <SeriesCard
                    key={s._id}
                    series={s}
                    showRemove={isOwner}
                    onRemove={() => handleRemoveSeries(s)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
      {showAddItems && list && (
        <AddItemsToListModal
          listId={id}
          listName={list.name}
          existingItems={list.items}
          onClose={() => setShowAddItems(false)}
          onAdded={async () => {
            // Re-fetch the list so items are up to date
            try {
              const data = await listService.getListById(id);
              setList(data.list);

              const movieIds = data.list.items.filter((i) => i.itemType === "movie").map((i) => i.itemId);
              const seriesIds = data.list.items.filter((i) => i.itemType === "series").map((i) => i.itemId);

              const [moviesData, seriesData] = await Promise.all([
                contentService.getMoviesBulk(movieIds, true),
                contentService.getSeriesBulk(seriesIds, true),
              ]);

              setMovies(moviesData);
              setSeries(seriesData);
            } catch { /* silent — toast already shown */ }
          }}
        />
      )}
    </div>
  );
}
