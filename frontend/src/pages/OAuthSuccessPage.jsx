import React, { useEffect, useContext } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function OAuthSuccessPage() {
  const [searchParams] = useSearchParams();
  const { setUser } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    const raw = searchParams.get("data");
    const error = searchParams.get("error");

    if (error) {
      toast.error("Google ile giriş başarısız oldu", {
        style: { background: "#1a1a1a", color: "#fff" },
      });
      navigate("/login");
      return;
    }

    if (!raw) {
      navigate("/login");
      return;
    }

    try {
      const userData = JSON.parse(decodeURIComponent(raw));
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
      toast.success("Google ile giriş yapıldı! 🎬", {
        style: { background: "#1a1a1a", color: "#fff" },
        iconTheme: { primary: "#22c55e", secondary: "#1a1a1a" },
      });
      navigate("/home");
    } catch {
      toast.error("Bir hata oluştu, tekrar dene", {
        style: { background: "#1a1a1a", color: "#fff" },
      });
      navigate("/login");
    }
  }, []);

  return (
    <div data-theme="forest" className="flex items-center justify-center min-h-screen bg-base-200">
      <div className="flex flex-col items-center gap-4">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="text-base-content/70">Google ile giriş yapılıyor...</p>
      </div>
    </div>
  );
}
