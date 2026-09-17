import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiArrowRight, FiCheck } from "react-icons/fi";
import { waitlistService } from "../../api/waitlistService";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The landing page's "notify me at launch" capture — the only real backend
// call this whole page makes (POST /api/waitlist). Client-side validates
// the email shape before ever hitting the network; the backend re-validates
// regardless (never trusts client input alone). `alreadyJoined` in the
// response drives a distinct message rather than treating a repeat signup
// as an error — the visitor did fill the form out correctly.
export default function WaitlistForm({ className = "" }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === "loading") return;
    if (!EMAIL_RE.test(email.trim())) {
      setStatus("error");
      setMessage(t("Please enter a valid email address."));
      return;
    }
    setStatus("loading");
    try {
      const res = await waitlistService.join(email.trim());
      setStatus("done");
      setMessage(res.data?.alreadyJoined ? t("You're already on the list!") : t("You're on the list! We'll email you the moment we launch."));
    } catch {
      setStatus("error");
      setMessage(t("Something went wrong. Please try again."));
    }
  };

  if (status === "done") {
    return (
      <div className={`flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-medium text-amber-200 ${className}`}>
        <FiCheck className="h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-2 sm:flex-row sm:gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("Enter your email")}
          className="w-full flex-1 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm text-white placeholder-white/40 outline-none transition-colors focus:border-amber-300/60"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-6 py-3 text-sm font-bold text-zinc-900 transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {t("Notify Me")}
          <FiArrowRight className="h-4 w-4" />
        </button>
      </form>
      {status === "error" && <p className="mt-2 text-sm text-rose-300">{message}</p>}
    </div>
  );
}
