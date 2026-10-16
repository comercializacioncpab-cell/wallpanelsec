import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './translations';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    return localStorage.getItem('decorwall_lang') || 'es';
  });

  const setLang = (newLang) => {
    setLangState(newLang);
    localStorage.setItem('decorwall_lang', newLang);
  };

  // Helper de traducción con soporte para rutas anidadas e.g. t('header.aiBadge')
  const t = (path, fallback = '') => {
    const keys = path.split('.');
    let current = translations[lang] || translations.es;
    for (const key of keys) {
      if (current && current[key] !== undefined) {
        current = current[key];
      } else {
        // Fallback a español si falta en inglés
        let fallbackVal = translations.es;
        for (const fbKey of keys) {
          if (fallbackVal && fallbackVal[fbKey] !== undefined) {
            fallbackVal = fallbackVal[fbKey];
          } else {
            return fallback || path;
          }
        }
        return fallbackVal;
      }
    }
    return current;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
