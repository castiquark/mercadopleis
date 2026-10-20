'use client';

import React from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage, LANGUAGES, type Language } from '@/lib/languageContext';
import { localePath, splitLocale } from '@/lib/i18nRoutes';
import { Globe } from 'lucide-react';

const TITLES: Record<Language, string> = { es: 'Ver en español', en: 'View in English', pt: 'Ver em português' };

/** Real links to the same page in each language (crawlable, with hreflang); the provider saves the choice. */
export function LanguageSwitch() {
  const { language } = useLanguage();
  const { path } = splitLocale(usePathname() || '/');

  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-surface p-1 text-xs font-semibold">
      <Globe className="mr-1 ml-1.5 hidden h-3.5 w-3.5 text-slate-400 sm:block" />
      {LANGUAGES.map((lang) => (
        <NextLink
          key={lang}
          href={localePath(path, lang)}
          hrefLang={lang}
          aria-current={language === lang ? 'true' : undefined}
          className={`rounded-md px-2.5 py-2.5 transition sm:px-2 sm:py-1 ${
            language === lang ? 'bg-primary text-white shadow-sm font-bold' : 'text-slate-400 hover:text-white'
          }`}
          title={TITLES[lang]}
        >
          {lang.toUpperCase()}
        </NextLink>
      ))}
    </div>
  );
}
