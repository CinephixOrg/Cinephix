import React, { useEffect, useState } from "react";
import { listService } from "../api/listService";
import { toast } from "react-hot-toast";
import CreateListModal from "./CreateListModal";

export default function AddToListModal({ itemId, itemType, onClose }) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(null); // listId being added
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    listService
      .getMyLists()
      .then((data) => setLists(data.lists || []))
      .catch(() => toast.error("Failed to load lists"))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (list) => {
    setAdding(list._id);
    try {
      await listService.addItem(list._id, itemId, itemType);
      toast.success(`Added to "${list.name}"`);
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to add to list");
    } finally {
      setAdding(null);
    }
  };

  const handleListCreated = (newList) => {
    setLists((prev) => [newList, ...prev]);
  };

  if (showCreate) {
    return (
      <CreateListModal
        onClose={() => setShowCreate(false)}
        onCreated={handleListCreated}
      />
    );
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-sm">
        <h3 className="font-bold text-lg mb-4">Add to a List</h3>

        {loading ? (
          <div className="flex justify-center py-6">
            <span className="loading loading-spinner" />
          </div>
        ) : lists.length === 0 ? (
          <p className="text-base-content/60 text-sm mb-4">You have no lists yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 mb-4 max-h-72 overflow-y-auto">
            {lists.map((list) => (
              <li key={list._id}>
                <button
                  className="btn btn-outline w-full justify-between"
                  onClick={() => handleAdd(list)}
                  disabled={adding === list._id}
                >
                  <span className="truncate">{list.name}</span>
                  <span className="badge badge-ghost text-xs ml-2">
                    {list.isPublic ? "Public" : "Private"} · {list.items?.length ?? 0} items
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          className="btn btn-primary btn-sm w-full mb-2"
          onClick={() => setShowCreate(true)}
        >
          + Create New List
        </button>

        <div className="modal-action mt-0">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
