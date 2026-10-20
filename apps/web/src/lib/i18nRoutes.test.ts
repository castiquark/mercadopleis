import { describe, expect, it } from 'vitest';
import { languageAlternates, localePath, splitLocale } from './i18nRoutes';

describe('per-language URLs', () => {
  it('keeps English at the root and prefixes Spanish and Portuguese', () => {
    expect(localePath('/requests', 'en')).toBe('/requests');
    expect(localePath('/requests', 'es')).toBe('/es/requests');
    expect(localePath('/', 'pt')).toBe('/pt');
    expect(localePath('/#services', 'es')).toBe('/es#services');
    expect(localePath('https://x.com/Mercadopleis', 'es')).toBe('https://x.com/Mercadopleis');
  });

  it('splits the language prefix off a browser path', () => {
    expect(splitLocale('/es/services/abc')).toEqual({ lang: 'es', path: '/services/abc' });
    expect(splitLocale('/pt')).toEqual({ lang: 'pt', path: '/' });
    expect(splitLocale('/services/abc')).toEqual({ lang: 'en', path: '/services/abc' });
    expect(splitLocale('/espresso')).toEqual({ lang: 'en', path: '/espresso' });
  });

  it('gives a self canonical and hreflang alternates with x-default = English', () => {
    expect(languageAlternates('/stats', 'es')).toEqual({
      canonical: '/es/stats',
      languages: { en: '/stats', es: '/es/stats', pt: '/pt/stats', 'x-default': '/stats' },
    });
  });
});
