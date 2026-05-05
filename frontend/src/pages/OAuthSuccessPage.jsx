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
      toast.error("Google login failed", {
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
      const { isNewOAuthUser, ...storedData } = userData;
      
      localStorage.setItem("user", JSON.stringify(storedData));
      setUser(storedData);
      
      if (isNewOAuthUser) {
        toast.success("Account created successfully with Google! 🎬", {
          style: { background: "#1a1a1a", color: "#fff" },
          iconTheme: { primary: "#22c55e", secondary: "#1a1a1a" },
        });
        navigate("/setup-profile");
      } else {
        toast.success("Successfully logged in with Google! 🎬", {
          style: { background: "#1a1a1a", color: "#fff" },
          iconTheme: { primary: "#22c55e", secondary: "#1a1a1a" },
        });
        navigate("/home");
      }
    } catch {
      toast.error("An error occurred, please try again", {
        style: { background: "#1a1a1a", color: "#fff" },
      });
      navigate("/login");
    }
  }, []);

  return (
    <div data-theme="forest" className="flex items-center justify-center min-h-screen bg-base-200">
      <div className="flex flex-col items-center gap-4">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="text-base-content/70">Connecting with Google...</p>
      </div>
    </div>
  );
}
