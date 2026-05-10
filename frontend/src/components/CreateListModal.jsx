import React, { useState } from "react";
import { listService } from "../api/listService";
import { toast } from "react-hot-toast";

export default function CreateListModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required");
    setSaving(true);
    try {
      const data = await listService.createList({ name, description, isPublic });
      toast.success("List created!");
      onCreated(data.list);
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to create list");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg mb-4">Create New List</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="form-control">
            <label className="label"><span className="label-text">List Name *</span></label>
            <input
              className="input input-bordered"
              placeholder="e.g. French Series, 90s Movies…"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Description</span></label>
            <textarea
              className="textarea textarea-bordered"
              placeholder="Optional description…"
              maxLength={300}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="form-control">
            <label className="label cursor-pointer">
              <span className="label-text">Make this list public</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
            </label>
            <p className="text-xs text-base-content/50 mt-1">
              {isPublic ? "Anyone can discover and view this list." : "Only you can see this list."}
            </p>
          </div>
          <div className="modal-action mt-2">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={`btn btn-primary ${saving ? "loading" : ""}`} disabled={saving}>
              Create List
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
