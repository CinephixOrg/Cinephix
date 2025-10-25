// components/SearchBar.jsx (GÜNCELLENMİŞ TAM DOSYA)

import React, { useState, useContext } from "react";
import API from "../api/axios.js";
// AuthContext import yolunuzun bu olduğunu varsayıyorum (App.jsx'teki gibi)
import { AuthContext } from "../context/AuthContext.jsx"; 

export default function SearchBar({ onResults }) {
  // 1. DEĞİŞİKLİK: 'token' yerine 'user' objesini çekiyoruz
  const { user } = useContext(AuthContext); 
  const [category, setCategory] = useState("movies");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    // 2. DEĞİŞİKLİK: Token'ı 'user' objesinin içinden alıyoruz
    const token = user?.token; 

    if (!token && category === "users") {
      onResults({
        category,
        query: trimmed,
        results: [],
        error: "Kullanıcı aramak için giriş yapmalısınız.",
      });
      return;
    }

    setLoading(true);
    try {
      let endpoint = "";
      let paramKey = "";
      
      if (category === "movies") {
        endpoint = "/movies";
        paramKey = "title";
      } else if (category === "series") {
        endpoint = "/series";
        paramKey = "name";
      } else if (category === "users") {
        endpoint = "/users/search"; 
        paramKey = "q";
      }

      const headers = {
        Authorization: `Bearer ${token}` // Token artık burada doğru şekilde kullanılacak
      };

      const params = new URLSearchParams({ [paramKey]: trimmed, limit: 18 });
      
      const res = await API.get(`${endpoint}?${params.toString()}`, { headers });

      const results = category === 'users' ? res.data : (res.data.results || []);
      const total = category === 'users' ? res.data.length : (res.data.total);

      onResults({
        category,
        query: trimmed,
        results: results,
        total: total,
      });

    } catch (err) {
      console.error("Search error:", err);
      const errorMsg = err.response?.data?.message || "Something went wrong. Try again later.";
      onResults({
        category,
        query: trimmed,
        results: [],
        error: errorMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSearch}
      className="flex flex-col sm:flex-row gap-3 items-center w-full max-w-2xl mx-auto"
    >
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="select select-bordered w-full sm:w-1/3"
      >
        <option value="movies">Movies</option>
        <option value="series">Series</option>
        <option value="users">Users</option>
      </select>

      <input
        type="text"
        placeholder={`Search ${category}...`}
        className="input input-bordered w-full sm:w-2/3"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? (
          <span className="loading loading-spinner loading-sm" />
        ) : (
          "Search"
        )}
      </button>
    </form>
  );
}