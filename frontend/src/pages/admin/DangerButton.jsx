import { useEffect, useState } from "react";

// A red action that asks before it fires.
//
// Deleting content and suspending an account are both irreversible from the
// dashboard, so the button turns into "Sure?" for a few seconds instead of
// acting on the first click. No modal: the queue is a fast-moving surface
// and a dialog per row would be worse than the mistake it prevents.
export default function DangerButton({ label, confirmLabel = "Sure?", onConfirm, busy, disabled, icon, className = "" }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  const click = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    onConfirm();
  };

  return (
    <button
      type="button"
      disabled={busy || disabled}
      onClick={click}
      className={`btn btn-sm gap-1.5 border-0 ${
        armed ? "bg-red-600 text-white hover:bg-red-500" : "bg-red-500/10 text-red-300 hover:bg-red-500/20"
      } ${className}`}
    >
      {busy ? <span className="loading loading-spinner loading-xs" /> : icon}
      {armed ? confirmLabel : label}
    </button>
  );
}
