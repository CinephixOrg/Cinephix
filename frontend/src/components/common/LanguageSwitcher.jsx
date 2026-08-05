import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import ReactCountryFlag from "react-country-flag";

const languages = [
  { code: 'en', name: 'English', countryCode: 'GB' },
  { code: 'tr', name: 'Türkçe', countryCode: 'TR' },
  { code: 'ru', name: 'Русский', countryCode: 'RU' },
  { code: 'ja', name: '日本語', countryCode: 'JP' },
  { code: 'zh', name: '中文', countryCode: 'CN' },
  { code: 'fr', name: 'Français', countryCode: 'FR' },
  { code: 'ko', name: '한국어', countryCode: 'KR' },
  { code: 'ar', name: 'العربية', countryCode: 'SA' },
  { code: 'it', name: 'Italiano', countryCode: 'IT' },
  { code: 'es', name: 'Español', countryCode: 'ES' },
  { code: 'de', name: 'Deutsch', countryCode: 'DE' },
  { code: 'pt', name: 'Português', countryCode: 'PT' }
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Default to 'en' if the detected language is not in our list
  const currentLangCode = i18n.language ? (i18n.language.split('-')[0]) : 'en';
  const currentLang = languages.find(l => l.code === currentLangCode) || languages[0];

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLanguageChange = (code) => {
    i18n.changeLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-ghost btn-sm btn-circle text-lg"
        title={currentLang.name}
      >
        <ReactCountryFlag countryCode={currentLang.countryCode} svg style={{ width: '1.2em', height: '1.2em', borderRadius: '2px' }} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 origin-top-right rounded-md bg-base-100 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-[100] max-h-60 overflow-y-auto">
          <div className="py-1">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-sm hover:bg-base-200 transition-colors ${
                  currentLang.code === lang.code ? 'font-bold bg-base-200/50' : ''
                }`}
              >
                <ReactCountryFlag countryCode={lang.countryCode} svg style={{ width: '1.5em', height: '1.5em', borderRadius: '2px' }} />
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
