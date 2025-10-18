import React, { useState, useEffect, useCallback } from 'react';
import API from '../api/axios.js'; // Your central API configuration
import MovieCard from '../components/MovieCard.jsx'; // Your movie card component

// Yükleniyor... animasyonu
const LoadingSpinner = () => (
  <div className="flex justify-center items-center p-10 col-span-full">
    <span className="loading loading-spinner loading-lg text-primary"></span>
  </div>
);

export default function MoviesPage() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Arama ve filtreleme durumlarını tek bir state'de yönetelim
  // Bu, neye göre sayfalama yapacağımızı bilmemizi sağlar
  const [activeFilters, setActiveFilters] = useState({ title: '', year: 2025 });
  const [searchTerm, setSearchTerm] = useState(''); // Sadece input'u kontrol etmek için
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Veri Çekme Fonksiyonu
  const fetchMovies = useCallback(async (page, filters) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: page,
        limit: 18,
      });
      // Aktif filtrelere göre parametreleri ekle
      if (filters.title) {
        params.append('title', filters.title);
      }
      if (filters.year) {
        params.append('year', filters.year);
      }

      const response = await API.get(`/movies?${params.toString()}`);

      setMovies(response.data.results);
      setCurrentPage(response.data.page);
      setTotalPages(Math.ceil(response.data.total / response.data.limit));

    } catch (err) {
      console.error("Error fetching movies:", err);
      setError("Could not load movies. Please try again later.");
      setMovies([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sadece ilk yüklemede çalışır
  useEffect(() => {
    fetchMovies(1, activeFilters);
  }, [fetchMovies]); // activeFilters'ı buradan kaldırdık ki arama yapınca tekrar tetiklenmesin

  // Arama İşlemi
  const handleSearch = (event) => {
    event.preventDefault();
    const newFilters = { title: searchTerm, year: null }; // Arama yapınca yıl filtresini kaldır
    setActiveFilters(newFilters); // Aktif filtreyi güncelle
    setCurrentPage(1);
    fetchMovies(1, newFilters);
  };

  // Sayfa Değiştirme
  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= totalPages) {
      // --- İŞTE DÜZELTME BURADA ---
      // Sayfa değiştirirken, arama terimiyle değil,
      // o anki AKTİF FİLTRELER ile istek atıyoruz.
      fetchMovies(newPage, activeFilters);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 animate-fade-in">
      {/* Arama Çubuğu */}
      <div className="mb-8 p-6 bg-base-100 rounded-lg shadow-lg">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search for a movie..."
            className="input input-bordered w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="loading loading-spinner loading-xs"></span> : 'Search'}
          </button>
        </form>
      </div>

      {/* Film Grid'i ve Sonuçlar */}
      <section>
        <h2 className="text-2xl font-bold mb-4">
          {activeFilters.title ? `Results for "${activeFilters.title}"` : `Movies from ${activeFilters.year}`}
        </h2>
        
        {error && <div className="alert alert-error mb-4">{error}</div>}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {loading ? (
            <LoadingSpinner />
          ) : movies.length === 0 ? (
             <p className="col-span-full text-center text-lg text-base-content/70">No results found.</p>
          ) : (
            movies.map((movie) => (
              <MovieCard key={movie._id} movie={movie} />
            ))
          )}
        </div>

        {/* Sayfalama Butonları */}
        {!loading && movies.length > 0 && totalPages > 1 && (
          <div className="join flex justify-center mt-8">
            <button 
              className="join-item btn" 
              onClick={() => handlePageChange(currentPage - 1)} 
              disabled={currentPage === 1}
            >
              « Previous
            </button>
            <button className="join-item btn">
              Page {currentPage} of {totalPages}
            </button>
            <button 
              className="join-item btn" 
              onClick={() => handlePageChange(currentPage + 1)} 
              disabled={currentPage === totalPages}
            >
              Next »
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

//Autocomplete version
//--------------------
// import React, { useState, useEffect, useCallback } from 'react';
// import API from '../api/axios.js';
// import MovieCard from '../components/MovieCard.jsx';

// const LoadingSpinner = () => (
//   <div className="flex justify-center items-center p-10 col-span-full">
//     <span className="loading loading-spinner loading-lg text-primary"></span>
//   </div>
// );

// export default function MoviesPage() {
//   const [movies, setMovies] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);
//   const [activeFilters, setActiveFilters] = useState({ title: '', year: 2025 });
//   const [searchTerm, setSearchTerm] = useState('');
//   const [currentPage, setCurrentPage] = useState(1);
//   const [totalPages, setTotalPages] = useState(1);

//   const fetchMovies = useCallback(async (page, filters) => {
//     try {
//       setLoading(true);
//       setError(null);
//       const params = new URLSearchParams({
//         page: page,
//         limit: 18,
//       });
//       if (filters.title) params.append('title', filters.title);
//       if (filters.year) params.append('year', filters.year);
//       const response = await API.get(`/movies?${params.toString()}`);
//       setMovies(response.data.results);
//       setCurrentPage(response.data.page);
//       setTotalPages(Math.ceil(response.data.total / response.data.limit));
//     } catch (err) {
//       console.error("Error fetching movies:", err);
//       setError("Could not load movies. Please try again later.");
//       setMovies([]);
//       setTotalPages(1);
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   // İlk yüklemede yıl 2025 filmlerini çek
//   useEffect(() => {
//     fetchMovies(1, activeFilters);
//   }, [fetchMovies]);

//   // ✨ Debounce ile canlı arama
//   useEffect(() => {
//     const delayDebounce = setTimeout(() => {
//       // Boşsa tekrar varsayılan yıla dön
//       const newFilters = searchTerm
//         ? { title: searchTerm, year: null }
//         : { title: '', year: 2025 };
//       setActiveFilters(newFilters);
//       fetchMovies(1, newFilters);
//     }, 400); // 0.4 saniye bekleme

//     return () => clearTimeout(delayDebounce);
//   }, [searchTerm, fetchMovies]);

//   const handlePageChange = (newPage) => {
//     if (newPage > 0 && newPage <= totalPages) {
//       fetchMovies(newPage, activeFilters);
//     }
//   };

//   return (
//     <div className="w-full max-w-7xl mx-auto p-4 md:p-8 animate-fade-in">
//       {/* Arama Çubuğu */}
//       <div className="mb-8 p-6 bg-base-100 rounded-lg shadow-lg">
//         <div className="flex flex-col sm:flex-row gap-4">
//           <input
//             type="text"
//             placeholder="Search for a movie..."
//             className="input input-bordered w-full"
//             value={searchTerm}
//             onChange={(e) => setSearchTerm(e.target.value)}
//           />
//         </div>
//       </div>

//       {/* Film Grid'i */}
//       <section>
//         <h2 className="text-2xl font-bold mb-4">
//           {activeFilters.title
//             ? `Results for "${activeFilters.title}"`
//             : `Movies from ${activeFilters.year}`}
//         </h2>

//         {error && <div className="alert alert-error mb-4">{error}</div>}

//         <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
//           {loading ? (
//             <LoadingSpinner />
//           ) : movies.length === 0 ? (
//             <p className="col-span-full text-center text-lg text-base-content/70">
//               No results found.
//             </p>
//           ) : (
//             movies.map((movie) => <MovieCard key={movie._id} movie={movie} />)
//           )}
//         </div>

//         {!loading && movies.length > 0 && totalPages > 1 && (
//           <div className="join flex justify-center mt-8">
//             <button
//               className="join-item btn"
//               onClick={() => handlePageChange(currentPage - 1)}
//               disabled={currentPage === 1}
//             >
//               « Previous
//             </button>
//             <button className="join-item btn">
//               Page {currentPage} of {totalPages}
//             </button>
//             <button
//               className="join-item btn"
//               onClick={() => handlePageChange(currentPage + 1)}
//               disabled={currentPage === totalPages}
//             >
//               Next »
//             </button>
//           </div>
//         )}
//       </section>
//     </div>
//   );
// }


