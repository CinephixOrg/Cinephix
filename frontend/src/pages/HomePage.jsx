import React, { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export default function HomePage() {
  const { user, logout } = useContext(AuthContext);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user?.username || "Guest"} 🎬</h1>
            <p className="mt-1 text-sm text-gray-600">Here’s what's happening with your Cinephix account.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={logout} className="inline-flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg">Logout</button>
          </div>
        </div>
      </header>

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">Movies in DB</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">12,345</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">Series in DB</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">4,321</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">Your Contributions</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">23</p>
            </div>
          </div>

          {/* Content grid */}
          <section>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Movies</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Example cards; replace with real data */}
              {[1,2,3,4,5,6].map((i) => (
                <article key={i} className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="h-40 bg-gray-200 flex items-center justify-center text-gray-500">Poster {i}</div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900">Movie Title {i}</h3>
                    <p className="text-sm text-gray-500 mt-1">Short description or genres...</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-pink-500">View</span>
                      <span className="text-sm text-gray-400">2025</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

