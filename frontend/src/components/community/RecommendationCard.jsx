import { useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

const resolvePosterUrl = (url) => {
  if (!url) return '/placeholder.jpg';
  return url.startsWith('/') ? `${TMDB_IMAGE_BASE}${url}` : url;
};

export default function RecommendationCard({ message }) {
  const navigate = useNavigate();
  
  if (!message.contentId || !message.contentType) {
    return null;
  }

  const handleNavigate = () => {
    navigate(`/content/${message.contentType}/${message.contentId}`);
  };

  // Extract content data from message
  const contentData = message.contentData || {};
  const title = contentData.title || 'Unknown Title';
  const posterUrl = resolvePosterUrl(contentData.posterUrl);
  const genres = contentData.genres || [];
  const releaseYear = contentData.releaseYear || '';

  return (
    <div className="flex gap-3 mt-2 mb-3">
      <div className="flex-1 max-w-sm">
        <div
          onClick={handleNavigate}
          className="bg-base-100 rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-all border border-base-300 hover:border-primary hover:scale-105"
        >
          {/* Poster Image */}
          {posterUrl && (
            <div 
              onClick={handleNavigate}
              className="relative h-40 w-full overflow-hidden bg-base-200 cursor-pointer"
            >
              <img
                src={posterUrl}
                alt={title}
                className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
              />
            </div>
          )}

          {/* Content Info */}
          <div className="p-4 space-y-3">
            {/* Title */}
            <div>
              <p className="text-sm font-bold text-base-content line-clamp-2">
                {title}
              </p>
              {releaseYear && (
                <p className="text-xs text-base-content/60 mt-0.5">
                  {releaseYear}
                </p>
              )}
            </div>

            {/* Genres */}
            {genres.length > 0 && (
              <p className="text-xs text-base-content/60 line-clamp-1">
                {Array.isArray(genres) ? genres.slice(0, 3).join(', ') : genres}
              </p>
            )}

            {/* Recommendation Text */}
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-2.5">
              <p className="text-xs text-primary font-semibold">
                🎁 {message.sender?.username || 'User'} size bu {message.contentType === 'movie' ? 'filmi' : 'diziyi'} öneriyor
              </p>
            </div>

            {/* View button */}
            <button
              onClick={handleNavigate}
              className="w-full btn btn-sm btn-primary gap-2"
            >
              <span>Detayları Gör</span>
              <FiArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
