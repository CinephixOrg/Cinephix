// src/components/DisplayRating.jsx
import React from 'react';

// Bu component, 1-5 arası bir puan (örn: 3.5) alır ve 
// bunu DaisyUI'nin salt okunur yarım yıldızlarıyla gösterir.
// 'contentId' prop'u, sayfadaki her bir rating grubunun
// birbirinden bağımsız çalışması için GEREKLİDİR.
export default function DisplayRating({ rating, contentId }) {
  
  // Puanı en yakın 0.5'e yuvarla (örn: 3.7 -> 3.5, 3.8 -> 4.0)
  const roundedRating = Math.round(rating * 2) / 2;
  
  // Her bir rating grubunun 'name' prop'u benzersiz olmalı
  const uniqueName = `rating-display-${contentId}`;

  return (
    // 'rating-sm' (küçük), 'rating-half' (yarım yıldızları etkinleştir)
    <div className="rating rating-sm rating-half" style={{ cursor: 'default' }}>
      
      {/* 0 puan için gizli input */}
      <input 
        type="radio" 
        name={uniqueName} 
        className="rating-hidden" 
        checked={roundedRating === 0} 
        disabled 
        readOnly
      />
      
      {/* DaisyUI'nin 10 adımlı (yarım yıldız) sistemi */}
      <input type="radio" name={uniqueName} className="mask mask-star-2 mask-half-1" disabled readOnly checked={roundedRating === 0.5} />
      <input type="radio" name={uniqueName} className="mask mask-star-2 mask-half-2" disabled readOnly checked={roundedRating === 1.0} />
      <input type="radio" name={uniqueName} className="mask mask-star-2 mask-half-1" disabled readOnly checked={roundedRating === 1.5} />
      <input type="radio" name={uniqueName} className="mask mask-star-2 mask-half-2" disabled readOnly checked={roundedRating === 2.0} />
      <input type="radio" name={uniqueName} className="mask mask-star-2 mask-half-1" disabled readOnly checked={roundedRating === 2.5} />
      <input type="radio" name={uniqueName} className="mask mask-star-2 mask-half-2" disabled readOnly checked={roundedRating === 3.0} />
      <input type="radio" name={uniqueName} className="mask mask-star-2 mask-half-1" disabled readOnly checked={roundedRating === 3.5} />
      <input type="radio" name={uniqueName} className="mask mask-star-2 mask-half-2" disabled readOnly checked={roundedRating === 4.0} />
      <input type="radio" name={uniqueName} className="mask mask-star-2 mask-half-1" disabled readOnly checked={roundedRating === 4.5} />
      <input type="radio" name={uniqueName} className="mask mask-star-2 mask-half-2" disabled readOnly checked={roundedRating === 5.0} />
    </div>
  );
}