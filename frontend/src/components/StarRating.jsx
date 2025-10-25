// frontend/src/components/StarRating.jsx (YENİ DOSYA)
import React from 'react';

// Props:
// - rating: (0-10) arası mevcut puan
// - onRatingChange: (newValue) => void - Puan değiştiğinde çağrılacak fonksiyon
export default function StarRating({ rating = 0, onRatingChange }) {
    
    // 1'den 10'a kadar (yarım yıldızlar için) bir dizi oluştur
    const stars = [...Array(10).keys()].map(i => i + 1);

    return (
        <div className="rating rating-lg rating-half">
            {/* 0 puan (temizle) butonu */}
            <input 
                type="radio" 
                name="rating-10" 
                className="rating-hidden" 
                checked={rating === 0}
                onChange={() => onRatingChange(0)}
                readOnly
            />

            {stars.map(value => (
                <input
                    key={value}
                    type="radio"
                    name="rating-10"
                    // 'mask-half-1' tek sayılar (sol yarım), 'mask-half-2' çift sayılar (sağ yarım)
                    className={`mask mask-star-2 ${ (value % 2 !== 0) ? 'mask-half-1' : 'mask-half-2' } bg-green-500`}
                    checked={rating === value}
                    onChange={() => onRatingChange(value)}
                    readOnly
                />
            ))}
        </div>
    );
}