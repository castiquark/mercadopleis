'use client';

import React, { createContext, useCallback, useContext, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { translations, type Language, type TranslationKey } from './translations';
import { DEFAULT_LANG, LANGS as ROUTE_LANGS, localePath, splitLocale } from './i18nRoutes';

export { translations };
export type { Language, TranslationKey };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
  /** Inline text in the three languages: L(es, en, pt). */
  L: <T = string>(es: T, en: T, pt: T) => T;
  /** An internal path in the current language ("/requests" → "/es/requests"). */
  lp: (path: string) => string;
}

// Display order of the switcher.
export const LANGUAGES: Language[] = ['es', 'en', 'pt'];
const STORAGE_KEY = 'mercadopleis_lang';

const LanguageContext = createContext<LanguageContextType>({
  language: DEFAULT_LANG,
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => translations[DEFAULT_LANG][key] || key,
  L: (_es, en) => en,
  lp: (path) => path,
});

/**
 * The language comes from the URL (/ English, /es, /pt), so the server HTML is already in the right language.
 * Switching navigates to the same page in the other language; the choice is saved for API calls (notifications)
 * but never used to redirect: crawlers and shared links always get the language of the URL.
 */
export function LanguageProvider({ children, language }: { children: React.ReactNode; language: Language }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Ignore storage errors
    }
  }, [language]);

  const setLanguage = (lang: Language) => {
    if (lang === language) return;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore
    }
    const { path } = splitLocale(pathname || '/');
    const query = typeof window !== 'undefined' ? window.location.search + window.location.hash : '';
    router.push(localePath(path, lang) + query);
  };

  const toggleLanguage = () => {
    setLanguage(ROUTE_LANGS[(ROUTE_LANGS.indexOf(language) + 1) % ROUTE_LANGS.length]);
  };

  const t = (key: TranslationKey): string => translations[language][key] || translations.en[key] || (key as string);

  // Stable between renders (only changes with the language), so it is safe in hook dependency lists.
  const L = useCallback(<T,>(es: T, en: T, pt: T): T => (language === 'pt' ? pt : language === 'en' ? en : es), [language]);
  const lp = useCallback((path: string) => localePath(path, language), [language]);

  return <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t, L, lp }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
