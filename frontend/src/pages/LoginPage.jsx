import React, { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate("/home");
    } catch (err) {
      alert("Login failed! Check your credentials.");
      console.error(err);
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
