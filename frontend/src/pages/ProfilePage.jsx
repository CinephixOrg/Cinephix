import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import API from '../api/axios';
import MovieCard from '../components/MovieCard';
import SeriesCard from '../components/SeriesCard';

export default function ProfilePage() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const tab = params.get('tab') || 'overview';

  const [movies, setMovies] = useState([]);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchWatchlist = async () => {
      try {
        setLoading(true);
        const res = await API.get('/users/me');
        const watchlist = res.data.watchlist || [];

        if (tab === 'movies') {
          const movieData = await Promise.all(
            watchlist
              .filter(item => item.itemType === 'movie')
              .map(item => API.get(`/movies/${item.itemId}`).then(r => r.data))
          );
          setMovies(movieData);
        } else if (tab === 'series') {
          const seriesData = await Promise.all(
            watchlist
              .filter(item => item.itemType === 'series')
              .map(item => API.get(`/series/${item.itemId}`).then(r => r.data))
          );
          setSeries(seriesData);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchWatchlist();
  }, [tab]);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Profile: {user?.username}</h1>
      <div className="mt-4">
        <div className="tabs">
          <a className={`tab ${tab === 'overview' ? 'tab-active' : ''}`} href="/profile">Overview</a>
          <a className={`tab ${tab === 'movies' ? 'tab-active' : ''}`} href="/profile?tab=movies">Movies</a>
          <a className={`tab ${tab === 'series' ? 'tab-active' : ''}`} href="/profile?tab=series">Series</a>
        </div>

        {tab === 'overview' && (
          <div className="mt-6">This place will soon be filled with your taste in movies!</div>
        )}

        {tab === 'movies' && (
          <div className="mt-6">
            {loading ? <div>Loading...</div> : (
              movies.length ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {movies.map(m => <MovieCard key={m._id} movie={m} showRemove />)}
                </div>
              ) : <p>No movies in your list.</p>
            )}
          </div>
        )}

        {tab === 'series' && (
          <div className="mt-6">
            {loading ? <div>Loading...</div> : (
              series.length ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {series.map(s => <SeriesCard key={s._id} series={s} showRemove />)}
                </div>
              ) : <p>No series in your list.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
