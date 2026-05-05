import React, { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: enter email, 2: enter code + new password
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const inputsRef = useRef([]);

  const handleSendCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await API.post("/users/forgot-password", { email });
      toast.success("Code sent to your email!", {
        style: { background: "#1a1a1a", color: "#fff" },
        iconTheme: { primary: "#22c55e", secondary: "#1a1a1a" },
      });
      setStep(2);
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error("No account found with this email", { style: { background: "#1a1a1a", color: "#fff" } });
      } else {
        const msg = err.response?.data?.message || "An error occurred";
        toast.error(msg, { style: { background: "#1a1a1a", color: "#fff" } });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDigitChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < 5) inputsRef.current[index + 1]?.focus();
  };

  const handleDigitKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleDigitPaste = (e) => {
    const paste = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(paste)) {
      setDigits(paste.split(""));
      inputsRef.current[5]?.focus();
      e.preventDefault();
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match", { style: { background: "#1a1a1a", color: "#fff" } });
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters", { style: { background: "#1a1a1a", color: "#fff" } });
      return;
    }
    setLoading(true);
    try {
      await API.post("/users/reset-password", { email, code, newPassword });
      toast.success("Password has been successfully reset!", {
        style: { background: "#1a1a1a", color: "#fff" },
        iconTheme: { primary: "#22c55e", secondary: "#1a1a1a" },
      });
      navigate("/login");
    } catch (err) {
      const msg = err.response?.data?.message || "An error occurred";
      toast.error(msg, { style: { background: "#1a1a1a", color: "#fff" } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-theme="forest" className="flex items-center justify-center min-h-screen bg-base-200">
      <div className="card w-full max-w-md shadow-xl bg-base-100">
        <div className="card-body items-center text-center">
          <div className="text-5xl mb-2">{step === 1 ? "🔐" : "🔑"}</div>
          <h1 className="text-2xl font-bold text-primary">
            {step === 1 ? "Forgot Password" : "Set New Password"}
          </h1>

          {step === 1 ? (
            <>
              <p className="text-sm text-base-content/70 mt-1 mb-4">
                Enter your registered email address, and we'll send you a 6-digit code.
              </p>
              <form onSubmit={handleSendCode} className="w-full flex flex-col gap-4">
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input input-bordered w-full"
                />
                <button
                  type="submit"
                  className={`btn btn-primary w-full ${loading ? "loading" : ""}`}
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send Code"}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm text-base-content/70 mt-1 mb-4">
                Enter the code sent to
                <br />
                <span className="font-semibold text-secondary">{email}</span>
                <br />
                and your new password.
                <br />
                <span className="text-warning text-xs mt-1 inline-block">
                  Can't find it? Check your spam/junk folder.
                </span>
              </p>
              <form onSubmit={handleResetPassword} className="w-full flex flex-col gap-4">
                <div className="flex justify-center gap-2" onPaste={handleDigitPaste}>
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => (inputsRef.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(i, e)}
                      className="input input-bordered w-12 h-14 text-center text-xl font-bold focus:input-primary"
                    />
                  ))}
                </div>
                <input
                  type="password"
                  placeholder="New password (at least 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="input input-bordered w-full"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="input input-bordered w-full"
                />
                <button
                  type="submit"
                  className={`btn btn-primary w-full ${loading ? "loading" : ""}`}
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Reset Password"}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep(1); setDigits(["","","","","",""]); }}
                  className="btn btn-ghost btn-sm"
                >
                  Change email address
                </button>
              </form>
            </>
          )}

          <p className="mt-4 text-sm">
            <Link to="/login" className="text-secondary font-semibold">
              &larr; Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
