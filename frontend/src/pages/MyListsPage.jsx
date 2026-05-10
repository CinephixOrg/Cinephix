import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listService } from "../api/listService";
import { toast } from "react-hot-toast";
import CreateListModal from "../components/CreateListModal";

export default function MyListsPage() {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    listService
      .getMyLists()
      .then((data) => setLists(data.lists || []))
      .catch(() => toast.error("Failed to load lists"))
      .finally(() => setLoading(false));
  }, []);

  const handleListCreated = (newList) => {
    setLists((prev) => [newList, ...prev]);
  };

  const handleDelete = async (list) => {
    if (!window.confirm(`Delete "${list.name}"?`)) return;
    try {
      await listService.deleteList(list._id);
      setLists((prev) => prev.filter((l) => l._id !== list._id));
      toast.success("List deleted");
    } catch {
      toast.error("Failed to delete list");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Lists</h1>
          <p className="text-base-content/60 mt-1">Curated collections you can share with others.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + New List
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : lists.length === 0 ? (
        <div className="text-center py-20 text-base-content/50">
          <p className="text-xl mb-4">No lists yet.</p>
          <p>Create your first list — like "90s Movies" or "French Series".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((list) => (
            <div key={list._id} className="card bg-base-100 shadow hover:shadow-md transition">
              <div className="card-body">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/lists/${list._id}`}
                    className="card-title text-lg hover:text-primary transition line-clamp-2"
                  >
                    {list.name}
                  </Link>
                  <span className={`badge badge-sm shrink-0 ${list.isPublic ? "badge-success" : "badge-ghost"}`}>
                    {list.isPublic ? "Public" : "Private"}
                  </span>
                </div>
                {list.description && (
                  <p className="text-sm text-base-content/60 line-clamp-2">{list.description}</p>
                )}
                <p className="text-xs text-base-content/40">{list.items?.length ?? 0} items</p>
                <div className="card-actions justify-end mt-2 gap-2">
                  <Link to={`/lists/${list._id}`} className="btn btn-sm btn-outline">
                    Open
                  </Link>
                  <button
                    className="btn btn-sm btn-error btn-outline"
                    onClick={() => handleDelete(list)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateListModal
          onClose={() => setShowCreate(false)}
          onCreated={handleListCreated}
        />
      )}
    </div>
  );
}
