import React from "react";
import { Link } from "react-router-dom";

// Bu component, giriş yapmamış kullanıcıların göreceği ana sayfadır.
export default function WelcomePage() {
  return (
    <div className="w-full">
      {/* Hero Alanı (Ekranı kaplayan ana karşılama) */}
      <div
        className="hero min-h-[calc(100vh-80px)]" // Navbar yüksekliğini hesaptan düşüyoruz
        style={{
          minHeight: '100vh', // Ekran yüksekliği kadar minimum yükseklik ver
          backgroundSize: 'cover', // Arkaplanı tüm alanı kaplayacak şekilde ayarla
          backgroundPosition: 'center', // Resmi ortala
          backgroundRepeat: 'no-repeat', // Resmin tekrar etmesini engelle (isteğe bağlı ama iyi bir pratik)
          // Forest temasına uygun, sinematik bir arkaplan
          backgroundImage:
            "url(https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2000&q=80)",
        }}
      >
        {/* Resmin üzerine metnin okunabilirliğini artırmak için yarı saydam bir katman */}
        <div className="hero-overlay bg-base-300/60"></div>

        {/* Ortalanmış içerik alanı */}
        <div className="hero-content text-center text-base-content">
          <div className="max-w-md animate-fade-in-up">
            {/* Geçici emoji logo */}
            <span className="text-7xl mb-4 inline-block">🎬</span>
            {/* Büyük Cinephix başlığı */}
            <h1 className="mb-5 text-6xl font-bold tracking-tight">Cinephix</h1>
            {/* Uygulamayı anlatan paragraf */}
            <p className="mb-5 text-lg leading-relaxed">
              Meet new people who share your taste in movies and series.
              Share your interests and find your next binge-watching buddy.
            </p>
            {/* Button that redirects to the register page */}
            <Link to="/register" className="btn btn-primary">
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
