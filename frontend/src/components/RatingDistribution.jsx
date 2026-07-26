import React, { useState, useMemo } from 'react';

const RatingDistribution = ({ ratings = [] }) => {
    const [hoveredBar, setHoveredBar] = useState(null);

    // Rating değerleri (0.5'ten 5'e)
    const ratingValues = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

    // Ortalama rating ve dağılım hesapla
    const { averageRating, distribution, maxCount } = useMemo(() => {
        if (!ratings || ratings.length === 0) {
            return {
                averageRating: 0,
                distribution: ratingValues.reduce((acc, val) => ({ ...acc, [val]: 0 }), {}),
                maxCount: 1
            };
        }

        // Rating dağılımını hesapla
        const dist = {};
        ratingValues.forEach(val => {
            dist[val] = ratings.filter(r => r === val).length;
        });

        // Ortalama ratingi hesapla
        const totalRating = ratings.reduce((sum, r) => sum + r, 0);
        const avg = (totalRating / ratings.length).toFixed(1);

        // Max count'u bul (scaling için)
        const max = Math.max(...Object.values(dist), 1);

        return {
            averageRating: parseFloat(avg),
            distribution: dist,
            maxCount: max
        };
    }, [ratings]);

    // (Removed the early return to always display the chart structure, even when empty)

    return (
        <div className="mt-6 pt-4 border-t border-base-300/30">
            {/* Başlık */}
            <div className="text-xs font-semibold uppercase tracking-widest text-base-content/70 mb-3">
                Ratings
            </div>

            {/* Rating Distribution Container */}
            <div className="flex items-end gap-4">
                {/* Bar Chart */}
                <div className="flex-1 flex items-end gap-1 h-32">
                    {ratingValues.map((value) => {
                        const count = distribution[value];
                        const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                        const isHovered = hoveredBar === value;

                        return (
                            <div
                                key={value}
                                className="flex-1 relative group flex flex-col items-center justify-end h-full pointer-events-none"
                            >
                                {/* Bar */}
                                <div
                                    className={`w-full transition-all duration-200 rounded-sm cursor-pointer pointer-events-auto ${
                                        isHovered
                                            ? 'bg-primary/90 shadow-lg'
                                            : 'bg-primary/40'
                                    }`}
                                    style={{ height: `${Math.max(height, 3)}%` }}
                                    onMouseEnter={() => setHoveredBar(value)}
                                    onMouseLeave={() => setHoveredBar(null)}
                                />

                                {/* Tooltip */}
                                {isHovered && (
                                    <div className="absolute top-full mt-2 bg-white text-black text-xs py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none shadow-lg">
                                        {value} ★: {count} {count === 1 ? 'user' : 'users'}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Ortalama Rating */}
                <div className="flex flex-col items-center gap-1">
                    <div className="text-3xl font-bold text-primary">
                        {averageRating.toFixed(1)}
                    </div>
                    <div className="text-lg text-primary">★</div>
                    <div className="text-xs text-base-content/60">
                        {ratings.length} {ratings.length === 1 ? 'rating' : 'ratings'}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RatingDistribution;
