'use client';

import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';

import { translations, type Language, type TranslationKey } from './translations';

export { translations };
export type { Language, TranslationKey };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
  /** Inline text in the three languages: L(es, en, pt). */
  L: <T = string>(es: T, en: T, pt: T) => T;
}

export const LANGUAGES: Language[] = ['es', 'en', 'pt'];
const isLanguage = (v: unknown): v is Language => v === 'es' || v === 'en' || v === 'pt';

const LanguageContext = createContext<LanguageContextType>({
  language: 'es',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => translations.es[key] || key,
  L: (es) => es,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('es');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('mercadopleis_lang') as Language | null;
      if (isLanguage(saved)) {
        setLanguageState(saved);
      } else {
        const browserLang = navigator.language?.toLowerCase();
        if (browserLang?.startsWith('en')) setLanguageState('en');
        else if (browserLang?.startsWith('pt')) setLanguageState('pt');
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
    setLanguage(LANGUAGES[(LANGUAGES.indexOf(language) + 1) % LANGUAGES.length]);
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.es[key] || (key as string);
  };

  // Stable between renders (only changes with the language), so it is safe in hook dependency lists.
  const L = useCallback(<T,>(es: T, en: T, pt: T): T => (language === 'pt' ? pt : language === 'en' ? en : es), [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t, L }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
