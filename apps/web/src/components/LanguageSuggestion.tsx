'use client';

import React, { useEffect, useState } from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { useLanguage, type Language } from '@/lib/languageContext';
import { localePath, splitLocale } from '@/lib/i18nRoutes';
import { readLanguageChoice, rememberLanguageChoice } from '@/lib/langChoice';

const DISMISS_KEY = 'mercadopleis_lang_hint_dismissed';

const TEXT: Record<Language, { ask: string; go: string; close: string }> = {
  es: { ask: 'Esta página también está en español.', go: 'Ver en español', close: 'Cerrar' },
  en: { ask: 'This page is also available in English.', go: 'View in English', close: 'Close' },
  pt: { ask: 'Esta página também está em português.', go: 'Ver em português', close: 'Fechar' },
};

function preferredLanguage(): Language | null {
  const chosen = readLanguageChoice();
  if (chosen) return chosen;
  const nav = typeof navigator !== 'undefined' ? navigator.language?.toLowerCase() : '';
  if (nav?.startsWith('es')) return 'es';
  if (nav?.startsWith('pt')) return 'pt';
  if (nav?.startsWith('en')) return 'en';
  return null;
}

/**
 * A small bar offering the visitor's language (their last choice, else the browser's) when the page is in another
 * one. It never redirects: crawlers and shared links keep the language of the URL. Dismissed for the session.
 */
export function LanguageSuggestion() {
  const { language } = useLanguage();
  const { path } = splitLocale(usePathname() || '/');
  const [target, setTarget] = useState<Language | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      // Ignore
    }
    const preferred = preferredLanguage();
    // Pages that exist in fewer languages say so (data-page-langs); do not offer one they are not written in.
    const pageLangs = document.querySelector('[data-page-langs]')?.getAttribute('data-page-langs')?.split(',');
    const available = !pageLangs || (preferred !== null && pageLangs.includes(preferred));
    setTarget(!dismissed && available && preferred && preferred !== language ? preferred : null);
  }, [language, path]);

  if (!target) return null;
  const copy = TEXT[target];
  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Ignore
    }
    setTarget(null);
  };

  return (
    <div className="border-b border-border bg-surface/90" lang={target} role="region" aria-label={copy.ask}>
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-4 py-2 text-sm text-slate-300 sm:px-6 lg:px-8">
        <span>{copy.ask}</span>
        <NextLink
          href={localePath(path, target)}
          hrefLang={target}
          onClick={() => rememberLanguageChoice(target)}
          className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-hover"
        >
          {copy.go}
        </NextLink>
        <button type="button" onClick={dismiss} aria-label={copy.close} className="rounded p-1 text-slate-400 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
