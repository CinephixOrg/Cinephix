import { useState, useEffect } from 'react';
import { FiSearch, FiX, FiArrowRight } from 'react-icons/fi';
import contentService from '../../api/contentService';
import toast from 'react-hot-toast';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w154';

const resolvePosterUrl = (url) => {
  if (!url) return null;
  return url.startsWith('/') ? `${TMDB_IMAGE_BASE}${url}` : url;
};

export default function RecommendationModal({ isOpen, onClose, onSelectContent }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedContent, setSelectedContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [contentType, setContentType] = useState('movie'); // 'movie' or 'series'

  // Search for movies/series
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const delaySearch = setTimeout(async () => {
      setLoading(true);
      try {
        let data = [];
        if (contentType === 'movie') {
          data = await contentService.searchMovies(searchQuery);
        } else {
          data = await contentService.searchSeries(searchQuery);
        }
        setResults(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Search error:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [searchQuery, contentType]);

  const handleSelectContent = (content) => {
    setSelectedContent({
      ...content,
      type: contentType
    });
  };

  const handleConfirm = () => {
    if (!selectedContent) {
      toast.error('Lütfen bir film veya dizi seçin');
      return;
    }
    onSelectContent(selectedContent);
    handleClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    setResults([]);
    setSelectedContent(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-200">
          <h2 className="text-xl font-bold">Film veya Dizi Öner</h2>
          <button
            onClick={handleClose}
            className="btn btn-ghost btn-sm btn-circle"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Type toggle */}
        <div className="px-6 py-3 border-b border-base-200">
          <div className="join join-bordered w-full">
            <button
              onClick={() => {
                setContentType('movie');
                setResults([]);
                setSelectedContent(null);
              }}
              className={`join-item flex-1 btn btn-sm ${
                contentType === 'movie' ? 'btn-active' : ''
              }`}
            >
              Film
            </button>
            <button
              onClick={() => {
                setContentType('series');
                setResults([]);
                setSelectedContent(null);
              }}
              className={`join-item flex-1 btn btn-sm ${
                contentType === 'series' ? 'btn-active' : ''
              }`}
            >
              Dizi
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-base-200">
          <label className="input input-bordered flex items-center gap-2">
            <FiSearch size={16} className="text-base-content/40" />
            <input
              autoFocus
              type="text"
              placeholder="Ara..."
              className="grow bg-transparent outline-none text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {loading && <span className="loading loading-spinner loading-xs" />}
          </label>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {searchQuery.trim() === '' ? (
            <div className="text-center text-base-content/50 py-8">
              {contentType === 'movie' ? 'Film' : 'Dizi'} adını yazarak ara
            </div>
          ) : loading ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-md" />
            </div>
          ) : results.length === 0 ? (
            <div className="text-center text-base-content/50 py-8">
              Sonuç bulunamadı
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((content) => (
                <div
                  key={content._id}
                  onClick={() => handleSelectContent(content)}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedContent?._id === content._id
                      ? 'border-primary bg-primary/10'
                      : 'border-base-200 hover:border-primary/50'
                  }`}
                >
                  <div className="flex gap-3">
                    {resolvePosterUrl(content.posterUrl) && (
                      <img
                        src={resolvePosterUrl(content.posterUrl)}
                        alt={content.title}
                        className="w-12 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {content.title}
                      </p>
                      <p className="text-xs text-base-content/60">
                        {content.releaseYear}
                      </p>
                      {content.genres && (
                        <p className="text-xs text-base-content/50 truncate mt-1">
                          {Array.isArray(content.genres)
                            ? content.genres.slice(0, 2).join(', ')
                            : content.genres}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer - Selected content and confirm button */}
        <div className="px-6 py-4 border-t border-base-200 bg-base-50">
          {selectedContent && (
            <div className="mb-3 p-2 bg-primary/10 border border-primary/30 rounded-lg">
              <p className="text-sm font-semibold text-primary">
                ✓ {selectedContent.title}
              </p>
            </div>
          )}
          <button
            onClick={handleConfirm}
            disabled={!selectedContent}
            className="btn btn-primary w-full btn-sm"
          >
            <FiArrowRight size={16} />
            Devam Et
          </button>
        </div>
      </div>
    </div>
  );
}
