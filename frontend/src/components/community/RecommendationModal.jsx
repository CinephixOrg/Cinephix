import { useState, useEffect } from 'react';
import { FiSearch, FiX, FiArrowRight } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import MovieSearchBar from '../MovieSearchBar';
import SeriesSearchBar from '../SeriesSearchBar';
import contentService from '../../api/contentService';
import API from '../../api/axios';
import toast from 'react-hot-toast';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w154';

const resolvePosterUrl = (url) => {
  if (!url) return null;
  return url.startsWith('/') ? `${TMDB_IMAGE_BASE}${url}` : url;
};

export default function RecommendationModal({ isOpen, onClose, onSelectContent }) {
  const { t } = useTranslation();
  const [searchResults, setSearchResults] = useState([]);
  const [selectedContent, setSelectedContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [contentType, setContentType] = useState('movie'); // 'movie' or 'series'
  const [hasSearched, setHasSearched] = useState(false);

  const performSearch = async (paramsObj) => {
    setLoading(true);
    setHasSearched(true);
    try {
      const endpoint = contentType === 'movie' ? '/movies' : '/series';
      // paramsObj has query, years, hasPoster, genres
      const reqObject = {
        title: paramsObj.query || '',
        years: paramsObj.years ? (Array.isArray(paramsObj.years) ? paramsObj.years.join(",") : paramsObj.years) : '',
        hasPoster: paramsObj.hasPoster || '',
        genres: paramsObj.genres ? (Array.isArray(paramsObj.genres) ? paramsObj.genres.join(",") : paramsObj.genres) : '',
        limit: 15,
      };

      const res = await API.get(endpoint, { params: reqObject });
      setSearchResults(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectContent = (content) => {
    const title = content.title || content.name;
    const posterUrl = content.posterUrl || content.poster_path;
    const releaseDate = content.releaseYear || content.release_date || content.first_air_date;
    const releaseYear = releaseDate ? releaseDate.toString().substring(0, 4) : '';

    setSelectedContent({
      ...content,
      title,
      posterUrl,
      releaseYear,
      type: contentType
    });
  };

  const handleConfirm = () => {
    if (!selectedContent) {
      toast.error(t('Please select at least one chat')); // Actually we need a new translation: please select content
      return;
    }
    onSelectContent(selectedContent);
    handleClose();
  };

  const handleClose = () => {
    setSearchResults([]);
    setSelectedContent(null);
    setHasSearched(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-200">
          <h2 className="text-xl font-bold">{t("Recommend Movie/Series")}</h2>
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
                setSearchResults([]);
                setSelectedContent(null);
                setHasSearched(false);
              }}
              className={`join-item flex-1 btn btn-sm ${
                contentType === 'movie' ? 'btn-active' : ''
              }`}
            >
              {t("movie_acc")}
            </button>
            <button
              onClick={() => {
                setContentType('series');
                setSearchResults([]);
                setSelectedContent(null);
                setHasSearched(false);
              }}
              className={`join-item flex-1 btn btn-sm ${
                contentType === 'series' ? 'btn-active' : ''
              }`}
            >
              {t("series_acc")}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-base-200">
          {contentType === 'movie' ? (
            <MovieSearchBar onSearch={performSearch} useURLParams={false} />
          ) : (
            <SeriesSearchBar onSearch={performSearch} useURLParams={false} />
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!hasSearched ? (
            <div className="text-center text-base-content/50 py-8">
              {t("Search movies...")}
            </div>
          ) : loading ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-md" />
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center text-base-content/50 py-8">
              {t("No users found")} {/* Fallback to no results found */}
            </div>
          ) : (
            <div className="space-y-3">
              {searchResults.map((content) => {
                const title = content.title || content.name;
                const posterUrl = content.posterUrl || content.poster_path;
                const releaseDate = content.releaseYear || content.release_date || content.first_air_date;
                const releaseYear = releaseDate ? releaseDate.toString().substring(0, 4) : '';
                return (
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
                    {resolvePosterUrl(posterUrl) && (
                      <img
                        src={resolvePosterUrl(posterUrl)}
                        alt={title}
                        className="w-12 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {title}
                      </p>
                      <p className="text-xs text-base-content/60">
                        {releaseYear}
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
              )})}
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
            {t("Continue")}
          </button>
        </div>
      </div>
    </div>
  );
}
