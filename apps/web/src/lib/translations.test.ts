import { describe, expect, it } from 'vitest';
import { translations } from './translations';
import { TERMS } from './legalContent';

const values = (lang: 'es' | 'en') => Object.values(translations[lang]).join('\n');

describe('interface texts', () => {
  it('Spanish and English define the same keys', () => {
    expect(Object.keys(translations.en).sort()).toEqual(Object.keys(translations.es).sort());
  });

  it.each(['es', 'en'] as const)('%s placeholders match between languages', (lang) => {
    const other = lang === 'es' ? 'en' : 'es';
    for (const [key, text] of Object.entries(translations[lang])) {
      const placeholders = (s: string) => (s.match(/\{\w+\}/g) || []).sort();
      expect(placeholders(text), key).toEqual(placeholders((translations[other] as Record<string, string>)[key]));
    }
  });

  it.each(['es', 'en'] as const)('%s makes no claims the contract does not back', (lang) => {
    const text = values(lang);
    expect(text).not.toMatch(/4 (días|days)/i); // the review window is 5 days
    expect(text).not.toMatch(/neutral/i); // the arbiter is the operator during this stage
    expect(text).not.toMatch(/instant/i); // escrow settlement is not instant
    expect(text).not.toMatch(/se liberarán automáticamente|auto-release to your wallet/i); // the seller must claim it
  });
});

describe('terms disclose the operator powers', () => {
  it.each(['es', 'en'] as const)('%s mentions renouncing ownership, deadlines during a pause and who arbitrates', (lang) => {
    const text = TERMS[lang].sections.flatMap((s) => s.paragraphs).join('\n');
    expect(text).toMatch(lang === 'es' ? /renunciar a la propiedad/ : /renounce ownership/);
    expect(text).toMatch(lang === 'es' ? /siguen corriendo durante la pausa/ : /keep running during a pause/);
    expect(text).toMatch(lang === 'es' ? /el árbitro es el propio operador/ : /the arbiter is the Mercadopleis operator/);
  });
});
