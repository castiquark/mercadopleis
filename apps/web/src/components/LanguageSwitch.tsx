'use client';

import React from 'react';
import { useLanguage, LANGUAGES, type Language } from '@/lib/languageContext';
import { Globe } from 'lucide-react';

const TITLES: Record<Language, string> = { es: 'Cambiar a Español', en: 'Switch to English', pt: 'Mudar para Português' };

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-surface p-1 text-xs font-semibold">
      <Globe className="mr-1 ml-1.5 hidden h-3.5 w-3.5 text-slate-400 sm:block" />
      {LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setLanguage(lang)}
          aria-pressed={language === lang}
          className={`rounded-md px-2.5 py-2.5 transition sm:px-2 sm:py-1 ${
            language === lang ? 'bg-primary text-white shadow-sm font-bold' : 'text-slate-400 hover:text-white'
          }`}
          title={TITLES[lang]}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
