// Per-language URLs: English at the root (x-default), Spanish under /es and Portuguese under /pt.
// Pure helpers, shared by server pages, the language provider, links and the sitemap.
import type { Language } from './translations';

export const LANGS: Language[] = ['en', 'es', 'pt'];
export const DEFAULT_LANG: Language = 'en';
export const isLang = (v: unknown): v is Language => v === 'en' || v === 'es' || v === 'pt';

/** "/requests" in the given language: "/requests", "/es/requests", "/pt/requests" ("/" → "/es"; hashes and queries kept). */
export function localePath(path: string, lang: Language): string {
  if (lang === DEFAULT_LANG || !path.startsWith('/') || path.startsWith('//')) return path;
  if (path === '/') return `/${lang}`;
  if (path.startsWith('/#') || path.startsWith('/?')) return `/${lang}${path.slice(1)}`;
  return `/${lang}${path}`;
}

/** The language of a browser path and the same path without its prefix ("/es/requests" → es, "/requests"). */
export function splitLocale(pathname: string): { lang: Language; path: string } {
  const m = pathname.match(/^\/(es|pt|en)(?=\/|$)(.*)$/);
  if (!m) return { lang: DEFAULT_LANG, path: pathname || '/' };
  return { lang: m[1] as Language, path: m[2] || '/' };
}

/** canonical (this language) plus hreflang alternates for every language and x-default (English). */
export function languageAlternates(path: string, lang: Language) {
  return {
    canonical: localePath(path, lang),
    languages: { en: path, es: localePath(path, 'es'), pt: localePath(path, 'pt'), 'x-default': path } as Record<string, string>,
  };
}
