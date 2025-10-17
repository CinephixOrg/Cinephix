import React, { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export default function HomePage() {
  const { user, logout } = useContext(AuthContext);

  return (
    <div
      data-theme="forest"
      className="min-h-screen bg-base-200 flex flex-col items-center justify-center text-center"
    >
      <div className="card w-96 bg-base-100 shadow-xl">
        <div className="card-body">
          <h1 className="card-title justify-center text-3xl text-primary">
            🎬 Welcome, {user?.username || "Guest"}!
          </h1>
          <p className="text-base-content/70">
            This is your Cinephix dashboard.
          </p>
          {user && (
            <div className="card-actions justify-center mt-4">
              <button onClick={logout} className="btn btn-secondary w-full">
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
