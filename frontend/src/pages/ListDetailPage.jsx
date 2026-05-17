import React, { useEffect, useState, useContext } from "react";
import { useParams, Link } from "react-router-dom";
import { listService } from "../api/listService";
import { contentService } from "../api/contentService";
import { AuthContext } from "../context/AuthContext";
import MovieCard from "../components/MovieCard";
import SeriesCard from "../components/SeriesCard";
import AddItemsToListModal from "../components/AddItemsToListModal";
import { toast } from "react-hot-toast";

export default function ListDetailPage() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);

  const [list, setList] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [movies, setMovies] = useState([]);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // edit state
  const [showAddItems, setShowAddItems] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPublic, setEditPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await listService.getListById(id);
        setList(data.list);
        setIsOwner(data.isOwner);
        setEditName(data.list.name);
        setEditDesc(data.list.description || "");
        setEditPublic(data.list.isPublic);

        const movieIds = data.list.items
          .filter((i) => i.itemType === "movie")
          .map((i) => i.itemId);
        const seriesIds = data.list.items
          .filter((i) => i.itemType === "series")
          .map((i) => i.itemId);

        const [movieResults, seriesResults] = await Promise.all([
          Promise.allSettled(movieIds.map((iid) => contentService.getMovieById(iid).then((r) => r.data || r))),
          Promise.allSettled(seriesIds.map((iid) => contentService.getSeriesById(iid).then((r) => r.data || r))),
        ]);

        setMovies(movieResults.filter((r) => r.status === "fulfilled").map((r) => r.value));
        setSeries(seriesResults.filter((r) => r.status === "fulfilled").map((r) => r.value));
      } catch (err) {
        setError(err.message || "Failed to load list");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleSaveEdit = async () => {
    if (!editName.trim()) return toast.error("Name is required");
    setSaving(true);
    try {
      const data = await listService.updateList(id, {
        name: editName,
        description: editDesc,
        isPublic: editPublic,
      });
      setList(data.list);
      setEditing(false);
      toast.success("List updated");
    } catch {
      toast.error("Failed to update list");
    } finally {
      setSaving(false);
    }
  };

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
        {editing ? (
          <div className="card bg-base-100 shadow p-6 max-w-lg">
            <h2 className="font-bold text-lg mb-4">Edit List</h2>
            <div className="flex flex-col gap-3">
              <input
                className="input input-bordered"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={80}
                placeholder="List name"
              />
              <textarea
                className="textarea textarea-bordered"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                maxLength={300}
                rows={3}
                placeholder="Description (optional)"
              />
              <label className="label cursor-pointer justify-start gap-4">
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={editPublic}
                  onChange={(e) => setEditPublic(e.target.checked)}
                />
                <span className="label-text">{editPublic ? "Public — anyone can discover and view this" : "Private — only you can see this"}</span>
              </label>
              <div className="flex gap-2 mt-2">
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
                <button className={`btn btn-primary btn-sm ${saving ? "loading" : ""}`} onClick={handleSaveEdit} disabled={saving}>Save</button>
              </div>
            </div>
          </div>
        ) : (
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
                <Link to={`/users/${list.owner._id}`} className="hover:text-primary">
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
              {isOwner && (
                <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>
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
        )}
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

              const [mr, sr] = await Promise.all([
                Promise.allSettled(movieIds.map((iid) => contentService.getMovieById(iid).then((r) => r.data || r))),
                Promise.allSettled(seriesIds.map((iid) => contentService.getSeriesById(iid).then((r) => r.data || r))),
              ]);

              setMovies(mr.filter((r) => r.status === "fulfilled").map((r) => r.value));
              setSeries(sr.filter((r) => r.status === "fulfilled").map((r) => r.value));
            } catch { /* silent — toast already shown */ }
          }}
        />
      )}
    </div>
  );
}
