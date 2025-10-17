import React, { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import toast from "react-hot-toast";
import axios from "axios";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);

      toast.success("Successfully logged in! ✅", {
        style: { background: "#1a1a1a", color: "#fff" },
        iconTheme: { primary: "#22c55e", secondary: "#1a1a1a" },
      });

      navigate("/home");
    } catch (err) {
      toast.error("Invalid email or password!", {
        style: { background: "#1a1a1a", color: "#fff" },
      });
    }
  };

  const handleAdminLogin = async () => {
    try {
      await login('admin@email.com', 'admin123');
      toast.success("Logged in as Admin! ☠️", {
        style: { background: "#1a1a1a", color: "#fff" },
        iconTheme: { primary: "#22c55e", secondary: "#1a1a1a" },
      });
      navigate("/home");
    } catch (error) {
      toast.error("Admin login failed!");
      console.error(error);
    }
  };


  return (
    <div
      data-theme="forest"
      className="flex items-center justify-center min-h-screen bg-base-200"
    >
      <div className="card w-full max-w-md shadow-xl bg-base-100">
        <div className="card-body items-center text-center">
          <h1 className="text-3xl font-bold text-primary">Cinephix 🎬</h1>
          <h2 className="text-lg text-base-content mt-2">Welcome Back</h2>
          <p className="text-sm text-base-content/70 mb-6">
            Find your movie match again!
          </p>

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
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input input-bordered w-full"
            />
            <button className="btn btn-primary w-full">Login</button>
          </form>

          <button
            onClick={handleAdminLogin}
            className="btn btn-outline btn-warning mt-2"
          >
            I'm an Admin
          </button>

          <p className="mt-6 text-sm">
            Don’t have an account?{" "}
            <Link to="/register" className="text-secondary font-semibold">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
