import { useState } from "react";
import toast from "react-hot-toast";
import { FiSlash } from "react-icons/fi";
import { setSuspension } from "../../api/adminService.js";
import DangerButton from "./DangerButton.jsx";
import { SUSPENSION_DURATIONS } from "./moderationMeta.js";

// Suspending someone: how long, why, and a second click to be sure.
//
// The length defaults to 24 hours rather than permanent — the shortest
// option is the safer default for a control this consequential, and a
// permanent suspension is a deliberate pick.
export default function SuspendControl({ userId, defaultReason = "", compact = false, onChanged }) {
  const [hours, setHours] = useState(24);
  const [reason, setReason] = useState(defaultReason);
  const [busy, setBusy] = useState(false);

  const suspend = async () => {
    setBusy(true);
    try {
      const result = await setSuspension(userId, true, reason.trim(), hours === "" ? null : Number(hours));
      toast.success(result.suspendedUntil ? `@${result.username} suspended until ${new Date(result.suspendedUntil).toLocaleDateString()}` : `@${result.username} suspended permanently`);
      onChanged?.(result);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Couldn't suspend that account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "w-full"}`}>
      <select
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        aria-label="Suspension length"
        className="select select-sm select-bordered bg-zinc-900"
      >
        {SUSPENSION_DURATIONS.map((option) => (
          <option key={option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {!compact && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          placeholder="Reason for suspending (required)"
          className="input input-sm input-bordered w-full max-w-xs bg-zinc-900"
        />
      )}

      <DangerButton
        label={hours === "" ? "Suspend permanently" : "Suspend"}
        confirmLabel="Suspend this account?"
        icon={<FiSlash />}
        busy={busy}
        disabled={!reason.trim()}
        onConfirm={suspend}
      />
    </div>
  );
}
