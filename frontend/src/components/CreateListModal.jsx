import React, { useState } from "react";
import { listService } from "../api/listService";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";

export default function CreateListModal({ onClose, onCreated }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error(t("Name is required"));
    setSaving(true);
    try {
      const data = await listService.createList({ name, description, isPublic });
      toast.success(t("List created!"));
      onCreated(data.list);
      onClose();
    } catch (err) {
      toast.error(err.message || t("Failed to create list"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg mb-4">{t("Create New List_Title")}</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="form-control">
            <label className="label"><span className="label-text">{t("List Name *")}</span></label>
            <input
              className="input input-bordered"
              placeholder={t("List Placeholder")}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">{t("Description")}</span></label>
            <textarea
              className="textarea textarea-bordered"
              placeholder={t("Optional description…")}
              maxLength={300}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="form-control">
            <label className="label cursor-pointer">
              <span className="label-text">{t("Make this list public")}</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
            </label>
            <p className="text-xs text-base-content/50 mt-1">
              {isPublic ? t("Public list info") : t("Private list info")}
            </p>
          </div>
          <div className="modal-action mt-2">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              {t("Cancel")}
            </button>
            <button type="submit" className={`btn btn-primary ${saving ? "loading" : ""}`} disabled={saving}>
              {t("Create List")}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
