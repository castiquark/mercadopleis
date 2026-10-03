'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

import { translations, type Language, type TranslationKey } from './translations';

export { translations };
export type { Language, TranslationKey };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'es',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => translations.es[key] || key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('es');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('mercadopleis_lang') as Language | null;
      if (saved && (saved === 'es' || saved === 'en')) {
        setLanguageState(saved);
      } else {
        const browserLang = navigator.language?.toLowerCase();
        if (browserLang && browserLang.startsWith('en')) {
          setLanguageState('en');
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('mercadopleis_lang', lang);
    } catch {
      // Ignore
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'es' ? 'en' : 'es');
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.es[key] || (key as string);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
