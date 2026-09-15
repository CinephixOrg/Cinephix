import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listService } from "../api/listService";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";

export default function AddToListModal({ itemId, itemType, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(null); // listId being added

  useEffect(() => {
    listService
      .getMyLists()
      .then((data) => setLists(data.lists || []))
      .catch(() => toast.error(t("Failed to load lists")))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (list) => {
    setAdding(list._id);
    try {
      await listService.addItem(list._id, itemId, itemType);
      toast.success(t("Added to list name", { name: list.name }));
      onClose();
    } catch (err) {
      toast.error(err.message || t("Failed to add to list"));
    } finally {
      setAdding(null);
    }
  };

  // A new list opens in the list editor with this title already on it.
  const handleCreateNew = () => {
    onClose();
    navigate(`/lists/new?add=${itemType}:${itemId}`);
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-sm">
        <h3 className="font-bold text-lg mb-4">{t("Add to a List_Title")}</h3>

        {loading ? (
          <div className="flex justify-center py-6">
            <span className="loading loading-spinner" />
          </div>
        ) : lists.length === 0 ? (
          <p className="text-base-content/60 text-sm mb-4">{t("You have no lists yet.")}</p>
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
                    {list.isPublic ? t("Public") : t("Private")} · {list.items?.length ?? 0} {t("items")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button className="btn btn-primary btn-sm w-full mb-2" onClick={handleCreateNew}>
          {t("+ Create New List")}
        </button>

        <div className="modal-action mt-0">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            {t("Cancel")}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
