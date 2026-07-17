import React, { useState, useRef, useContext } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import API from "../api/axios";
import toast from "react-hot-toast";

export default function VerifyEmailPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);
  const email = state?.email || "";

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputsRef = useRef([]);

  const handleChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const paste = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(paste)) {
      setDigits(paste.split(""));
      inputsRef.current[5]?.focus();
      e.preventDefault();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }
    setLoading(true);
    try {
      const res = await API.post("/users/verify-email", { email, code });
      const userData = res.data;
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
      toast.success("Email verified! Welcome 🎬", {
        style: { background: "#1a1a1a", color: "#fff" },
        iconTheme: { primary: "#22c55e", secondary: "#1a1a1a" },
      });
      // Redirect to welcome/setup page where user can pick username and profile pic
      navigate("/setup-profile");
    } catch (err) {
      const msg = err.response?.data?.message || "Invalid or expired code";
      toast.error(msg, { style: { background: "#1a1a1a", color: "#fff" } });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      await API.post("/users/send-verification", { email });
      toast.success("New code sent!", {
        style: { background: "#1a1a1a", color: "#fff" },
      });
      setDigits(["", "", "", "", "", ""]);
      inputsRef.current[0]?.focus();
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to send code";
      toast.error(msg, { style: { background: "#1a1a1a", color: "#fff" } });
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-200">
        <div className="text-center">
          <p className="text-base-content/70 mb-4">Email address not found.</p>
          <Link to="/register" className="btn btn-primary">Register</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-base-200">
      <div className="card w-full max-w-md shadow-xl bg-base-100">
        <div className="card-body items-center text-center">
          <div className="text-5xl mb-2">📧</div>
          <h1 className="text-2xl font-bold text-primary">Email Verification</h1>
          <p className="text-sm text-base-content/70 mt-1">
            Enter the 6-digit code sent to
            <br />
            <span className="font-semibold text-secondary">{email}</span>
          </p>

          <form onSubmit={handleSubmit} className="w-full mt-6">
            <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => (inputsRef.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="input input-bordered w-12 h-14 text-center text-xl font-bold focus:input-primary"
                />
              ))}
            </div>
            <button
              type="submit"
              className={`btn btn-primary w-full ${loading ? "loading" : ""}`}
              disabled={loading}
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
          </form>

          <div className="mt-4 flex flex-col items-center gap-2">
            <button
              onClick={handleResend}
              disabled={resending}
              className="btn btn-ghost btn-sm text-secondary"
            >
              {resending ? "Sending..." : "Resend code"}
            </button>
            <Link to="/login" className="text-xs text-base-content/50 hover:text-base-content">
              Already have an account? Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
