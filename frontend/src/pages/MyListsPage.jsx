import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listService } from "../api/listService";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";

export default function MyListsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listToDelete, setListToDelete] = useState(null);

  useEffect(() => {
    listService
      .getMyLists()
      .then((data) => setLists(data.lists || []))
      .catch(() => toast.error(t("Failed to load lists")))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = (list) => {
    setListToDelete(list);
  };

  const handleExecuteDelete = async () => {
    if (!listToDelete) return;
    try {
      await listService.deleteList(listToDelete._id);
      setLists((prev) => prev.filter((l) => l._id !== listToDelete._id));
      toast.success(t("List deleted"));
    } catch {
      toast.error(t("Failed to delete list"));
    } finally {
      setListToDelete(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t("My Lists")}</h1>
          <p className="text-base-content/60 mt-1">{t("Curated collections")}</p>
        </div>
        {/* The list editor: name, search and add titles, suggestions — one page. */}
        <button className="btn btn-primary" onClick={() => navigate("/lists/new")}>
          {t("+ New List")}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : lists.length === 0 ? (
        <div className="text-center py-20 text-base-content/50">
          <p className="text-xl mb-4">{t("No lists yet.")}</p>
          <p>{t("Create your first list")}</p>
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
                    {list.isPublic ? t("Public") : t("Private")}
                  </span>
                </div>
                {list.description && (
                  <p className="text-sm text-base-content/60 line-clamp-2">{list.description}</p>
                )}
                <p className="text-xs text-base-content/40">{list.items?.length ?? 0} {t("items")}</p>
                <div className="card-actions justify-end mt-2 gap-2">
                  <Link to={`/lists/${list._id}`} className="btn btn-sm btn-outline">
                    {t("Open")}
                  </Link>
                  <button
                    className="btn btn-sm btn-error btn-outline"
                    onClick={() => handleDelete(list)}
                  >
                    {t("Delete")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {listToDelete && (
        <dialog open className="modal modal-open bg-black/60 animate-fade-in">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-error">{t("Delete List")}</h3>
            <p className="py-4">
              {t("Are you sure you want to delete the list")} <strong>"{listToDelete.name}"</strong>{t("This action cannot be undone.")}
            </p>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setListToDelete(null)}>
                {t("Cancel")}
              </button>
              <button className="btn btn-error" onClick={handleExecuteDelete}>
                {t("Delete")}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
