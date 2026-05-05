import React, { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import toast from "react-hot-toast";

const BACKEND_URL = import.meta.env.VITE_API_BASE_URL?.replace("/api", "") || "http://localhost:5000";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success("Başarıyla giriş yapıldı! ✅", {
        style: { background: "#1a1a1a", color: "#fff" },
        iconTheme: { primary: "#22c55e", secondary: "#1a1a1a" },
      });
      navigate("/home");
    } catch (err) {
      if (err.response?.data?.message === "EMAIL_NOT_VERIFIED") {
        toast.error("Email adresin doğrulanmamış. Lütfen emailini kontrol et.", {
          style: { background: "#1a1a1a", color: "#fff" },
          duration: 5000,
        });
        navigate("/verify-email", { state: { email } });
        return;
      }
      const msg = err.response?.data?.message || err.message || "Geçersiz email veya şifre!";
      toast.error(msg, { style: { background: "#1a1a1a", color: "#fff" } });
    }
  };

  const handleAdminLogin = async () => {
    try {
      await login("admin@email.com", "admin123");
      toast.success("Admin olarak giriş yapıldı! ☠️", {
        style: { background: "#1a1a1a", color: "#fff" },
        iconTheme: { primary: "#22c55e", secondary: "#1a1a1a" },
      });
      navigate("/home");
    } catch (error) {
      toast.error("Admin girişi başarısız!");
      console.error(error);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${BACKEND_URL}/api/users/auth/google`;
  };

  return (
    <div
      data-theme="forest"
      className="flex items-center justify-center min-h-screen bg-base-200"
    >
      <div className="card w-full max-w-md shadow-xl bg-base-100">
        <div className="card-body items-center text-center">
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
            <span>Cinephix</span>
          </h1>
          <h2 className="text-lg text-base-content mt-2">Tekrar hoş geldin</h2>
          <p className="text-sm text-base-content/70 mb-4">
            Film eşleşmeni bul!
          </p>

          {/* Google OAuth Button */}
          <button
            onClick={handleGoogleLogin}
            className="btn btn-outline w-full gap-2 mb-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            Google ile Giriş Yap
          </button>

          <div className="divider text-xs text-base-content/40">veya email ile</div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input input-bordered w-full"
            />
            <input
              type="password"
              placeholder="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input input-bordered w-full"
            />
            <div className="text-right -mt-2">
              <Link to="/forgot-password" className="text-xs text-secondary hover:underline">
                Şifremi unuttum
              </Link>
            </div>
            <button className="btn btn-primary w-full">Giriş Yap</button>
          </form>

          <button
            onClick={handleAdminLogin}
            className="btn btn-outline btn-warning mt-2"
          >
            I'm an Admin
          </button>

          <p className="mt-4 text-sm">
            Hesabın yok mu?{" "}
            <Link to="/register" className="text-secondary font-semibold">
              Kayıt ol
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
