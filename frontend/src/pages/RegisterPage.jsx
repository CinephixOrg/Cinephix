import React, { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });

  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await register(formData.username, formData.email, formData.password);
      navigate("/home");
    } catch (err) {
      alert("Registration failed!");
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
          <h2 className="text-lg text-base-content mt-2">Create Account</h2>
          <p className="text-sm text-base-content/70 mb-6">
            Join the cinephile community!
          </p>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              required
              className="input input-bordered w-full"
            />
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
              className="input input-bordered w-full"
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
              className="input input-bordered w-full"
            />
            <button type="submit" className="btn btn-primary w-full">
              Sign Up
            </button>
          </form>

          <p className="mt-6 text-sm">
            Already have an account?{" "}
            <Link to="/login" className="text-secondary font-semibold">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}