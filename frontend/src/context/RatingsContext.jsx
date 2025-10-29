// src/context/RatingsContext.jsx (DÜZELTİLMİŞ TAM DOSYA)

import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import API from '../api/axios.js';
import { AuthContext } from './AuthContext.jsx';

export const RatingsContext = createContext(null);

export const RatingsProvider = ({ children }) => {
  const { user } = useContext(AuthContext); 
  const [ratings, setRatings] = useState([]); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("[RatingsContext] useEffect çalıştı. User:", user?.username);

    if (!user?._id) {
      console.log("[RatingsContext] Kullanıcı ID'si yok, oylar temizleniyor.");
      setRatings([]); 
      setLoading(false);
      return;
    }

    const fetchRatings = async () => {
      setLoading(true);
      console.log(`[RatingsContext] Oylar çekiliyor... API isteği: /users/ratings/${user._id}`);
      try {
        const response = await API.get(`/users/ratings/${user._id}`);
        
        // Gelen veride artık 'contentId' ve 'value' olmalı
        console.log("[RatingsContext] Oylar BAŞARIYLA ÇEKİLDİ. Gelen veri:", response.data);

        setRatings(response.data);
      } catch (error) {
        console.error("[RatingsContext] OYLAR ÇEKİLİRKEN HATA:", error);
        setRatings([]); 
      } finally {
        setLoading(false);
      }
    };

    fetchRatings();
  }, [user]);

  // --- useMemo DÜZELTMESİ BURADA ---
  const ratingsMap = useMemo(() => {
    const map = new Map();
    ratings.forEach(rating => {
      // 'rating.content' yerine 'rating.contentId' kullan
      // 'rating.rating' yerine 'rating.value' kullan
      // VE 10'luk puanı 5'liğe çevirmek için 2'ye böl
      map.set(rating.contentId, rating.value / 2); 
    });
    
    console.log("[RatingsContext] ratingsMap oluşturuldu. Harita boyutu:", map.size);
    return map;
  }, [ratings]);

  // --- updateRating DÜZELTMESİ BURADA ---
  // (Bu fonksiyonu oylama component'in (Rating.jsx?) çağıracak)
  const updateRating = (contentId, newRatingValue) => {
    // newRatingValue'nun 1-10 arası olduğunu varsayıyoruz (schema'ya göre)
    
    // Yeni oy objesi (doğru alan adlarıyla)
    const newRatingObj = { contentId: contentId, value: newRatingValue };
    
    setRatings(prevRatings => [
      // Eski oyu (varsa) 'contentId'ye göre filtrele
      ...prevRatings.filter(r => r.contentId !== contentId),
      newRatingObj
    ]);

    console.log(`[RatingsContext] Oy güncellendi: ${contentId} -> ${newRatingValue} (1-10)`);
  };

  const value = {
    ratingsMap,   
    updateRating, 
    loadingRatings: loading
  };

  return (
    <RatingsContext.Provider value={value}>
      {children}
    </RatingsContext.Provider>
  );
};