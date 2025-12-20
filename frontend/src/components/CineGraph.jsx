// src/components/CineGraph.jsx

import React from 'react';
// 1. Gerekli Chart.js bileşenlerini import et
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

// 2. Chart.js'e bu bileşenleri kullanacağını söyle (ÇOK ÖNEMLİ)
ChartJS.register(ArcElement, Tooltip, Legend);

// Bu component'e { "Horror": 2, "Thriller": 2, "Comedy": 1 } gibi bir veri vereceğiz
export default function CineGraph({ data, title }) {
    if (!data || typeof data !== "object") {
    return (
      <div className="text-center p-6 bg-base-100 rounded-lg shadow-inner">
        <p className="text-base-content/70">No data for {title}.</p>
      </div>
    );
  }

  // 3. Backend verisini Chart.js'in anlayacağı formata dönüştür
  const labels = Object.keys(data);  // ["Horror", "Thriller", "Comedy"]
  const counts = Object.values(data); // [2, 2, 1]

  // Renk paleti (istersen DaisyUI renk kodlarını (örn: 'hsl(...)') buraya ekleyebilirsin)
  const colors = [
    '#34d399', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#a855f7', // Purple
    '#ec4899', // Pink
    '#6b7280', // Gray
    '#14b8a6', // Teal
  ];

  // 4. Chart.js için veri seti
  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'Items',
        data: counts,
        backgroundColor: colors.slice(0, labels.length), // Her türe bir renk ata
        borderColor: '#1f2937', // (Grafik dilimleri arasındaki çizgi - temanızın arka planı)
        borderWidth: 2,
      },
    ],
  };

  // 5. Chart.js için ayarlar
  const options = {
    responsive: true,
    maintainAspectRatio: true,
    
    // --- İSTEKLERİNİ KARŞILAYAN KISIM ---
    
    // 1. Üzerine gelince büyüme
    hoverOffset: 16, // Dilimin 16px dışarı çıkmasını sağlar

    plugins: {
      legend: {
        position: 'top', // Tür isimlerini üstte göster
        labels: {
          color: '#d1d5db', // (Metin rengi - Gri-300)
          font: { size: 14 }
        }
      },
      // 2. İpucu (Tooltip) ayarı
      tooltip: {
        callbacks: {
          // "Bu türde kaç film izlenmiş" yazısını ekleme
          label: (context) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            // "Comedy: 1 items" gibi bir yazı döndürür
            return ` ${label}: ${value} items`; 
          },
          // Yüzdelik dilimi gösterme
          footer: (tooltipItems) => {
            const sum = tooltipItems[0].dataset.data.reduce((a, b) => a + b, 0);
            const value = tooltipItems[0].parsed;
            const percentage = ((value / sum) * 100).toFixed(1);
            return `Percentage: ${percentage}%`;
          },
        },
      },
    },
  };

  // Eğer veri yoksa bir mesaj göster
  if (labels.length === 0) {
    return (
      <div className="text-center p-6 bg-base-100 rounded-lg shadow-inner">
        <p className="text-base-content/70">No data for {title} yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-base-100 p-4 rounded-lg shadow-xl">
      <h3 className="text-lg font-bold text-center mb-4">{title}</h3>
      {/* 400px'lik bir alanda grafiği çiz */}
      <div style={{ position: 'relative', height: '400px', width: '100%' }}>
        <Doughnut data={chartData} options={options} />
      </div>
    </div>
  );
}