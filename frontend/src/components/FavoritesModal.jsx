// frontend/src/components/FavoritesModal.jsx (GÜNCELLENMİŞ TAM DOSYA)
import React, { useState, useEffect } from 'react';
import API from '../api/axios';
import MovieCard from './MovieCard';
import SeriesCard from './SeriesCard';

export default function FavoritesModal({
  type,          // 'movie' or 'series'
  initialList,   // Mevcut favori listesi (ID'ler: ["id1", "id2"])
  newItem,       // Eklenen yeni film/dizi objesi (tam obje)
  onClose,       // Modalı kapatma fonksiyonu
  onSaveSuccess  // Başarılı kayıttan sonra çağrılacak fonksiyon
}) {
  const [items, setItems] = useState([]); // Tam objeleri tutacak state
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);

  // 1. Modal açıldığında, ID listesindeki tüm içeriklerin detaylarını çek
  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);

      // 1. Benzersiz bir ID listesi oluştur
      // 'initialList' -> ["id_A", "id_B"]
      // 'newItem._id' -> "id_C"
      // allIds -> Set( "id_A", "id_B", "id_C" )
      const allIds = new Set([...initialList, newItem._id]);

      // 2. Bu benzersiz listedeki HER BİR ID için API isteği oluştur
      const detailRequests = Array.from(allIds).map(id => {
        
        // Optimizasyon: Eğer ID, şu anki sayfanın ID'si (newItem) ise,
        // API isteği atma, elimizdeki hazır objeyi kullan.
        if (id === newItem._id) {
          return Promise.resolve({ data: newItem });
        }
        
        // Listede zaten var olan diğer filmler/diziler için API isteği at
        const endpoint = type === 'movie' ? `/movies/${id}` : `/series/${id}`;
        return API.get(endpoint);
      });

      try {
        // 3. Tüm isteklerin tamamlanmasını bekle
        const responses = await Promise.all(detailRequests);
        
        // 4. Gelen verilerden (res.data) tam objeleri oluştur ve state'e kaydet
        const detailedItems = responses.map(res => res.data);
        setItems(detailedItems);

      } catch (error) {
        console.error("Favori detayları çekilemedi:", error);
        setItems([]); // Hata durumunda listeyi boşalt
      } finally {
        setLoading(false);
      }
    };
    
    // newItem (content) yüklendiğinden emin olduktan sonra başlat
    if (newItem) {
        fetchDetails();
    } else {
        setLoading(false); // Yeni eklenecek bir şey yoksa (teorik)
    }
  }, [initialList, newItem, type]); // Bağımlılıklar değişmedi

  // 2. Karttaki (X) butonuna basıldığında (Değişiklik yok)
  const handleRemove = (itemId) => {
    setItems(prevList => prevList.filter(item => item._id !== itemId));
  };

  // 3. Save butonuna basıldığında (Değişiklik yok)
  const handleSave = async () => {
    setSaveLoading(true);
    const idList = items.map(item => item._id); 
    
    try {
      const res = await API.put("/users/me/favorites", {
        type: type,
        list: idList
      });
      
      onSaveSuccess(res.data); // Ana sayfadaki state'i (ID listesi) güncelle
      onClose();
      
    } catch (error) {
      console.error("Favoriler kaydedilemedi:", error);
      alert(error.response?.data?.message || "Bir hata oluştu.");
    } finally {
      setSaveLoading(false);
    }
  };

  // 4. Limit kontrolü (Değişiklik yok)
  const isOverLimit = items.length > 5;

  return (
    <dialog open className="modal modal-open bg-black/60">
      <div className="modal-box w-11/12 max-w-5xl">
        <h3 className="font-bold text-lg">
          {type === 'movie' ? 'Favorite Movies' : 'Favorite Series'} ({items.length}/5)
        </h3>
        
        {/* Kartların Listesi */}
        {loading ? (
            <div className="text-center p-10 min-h-[150px] flex items-center justify-center">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        ) : (
          <div className="py-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 min-h-[150px]">
            {items.map(item => (
              // -- HATA AYIKLAMA: 'item'in varlığını kontrol et --
              item ? (
                type === 'movie' ? (
                  <MovieCard 
                    key={item._id} 
                    movie={item} 
                    showRemove={true} 
                    onRemove={handleRemove} 
                  />
                ) : (
                  <SeriesCard 
                    key={item._id} 
                    series={item} 
                    showRemove={true} 
                    onRemove={handleRemove} 
                  />
                )
              ) : null // Eğer item 'undefined' ise render etme
            ))}
          </div>
        )}
        
        {/* Modal Alt Kısım (Butonlar ve Uyarı) */}
        <div className="modal-action flex items-center justify-end gap-4">
          {isOverLimit && (
            <span className="text-error text-sm">
              En fazla 5 favori {type === 'movie' ? 'film' : 'dizi'} bulunmalı.
            </span>
          )}
          <button className="btn" onClick={onClose} disabled={loading}>Cancel</button>
          <button 
            className={`btn btn-primary ${saveLoading ? 'loading' : ''}`}
            onClick={handleSave}
            disabled={isOverLimit || saveLoading || loading}
          >
            Save
          </button>
        </div>
      </div>
    </dialog>
  );
}