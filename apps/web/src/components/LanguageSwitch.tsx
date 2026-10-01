'use client';

import React from 'react';
import { useLanguage } from '@/lib/languageContext';
import { Globe } from 'lucide-react';

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-surface p-1 text-xs font-semibold">
      <Globe className="mr-1 ml-1.5 hidden h-3.5 w-3.5 text-slate-400 sm:block" />
      <button
        type="button"
        onClick={() => setLanguage('es')}
        className={`rounded-md px-3 py-2.5 transition sm:px-2 sm:py-1 ${
          language === 'es'
            ? 'bg-primary text-white shadow-sm font-bold'
            : 'text-slate-400 hover:text-white'
        }`}
        title="Cambiar a Español"
      >
        ES
      </button>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`rounded-md px-3 py-2.5 transition sm:px-2 sm:py-1 ${
          language === 'en'
            ? 'bg-primary text-white shadow-sm font-bold'
            : 'text-slate-400 hover:text-white'
        }`}
        title="Switch to English"
      >
        EN
      </button>
    </div>
  );
}
