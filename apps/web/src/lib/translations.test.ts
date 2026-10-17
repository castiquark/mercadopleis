import { describe, expect, it } from 'vitest';
import { translations } from './translations';
import { TERMS } from './legalContent';

const values = (lang: 'es' | 'en' | 'pt') => Object.values(translations[lang]).join('\n');

describe('interface texts', () => {
  it.each(['en', 'pt'] as const)('%s defines the same keys as Spanish', (lang) => {
    expect(Object.keys(translations[lang]).sort()).toEqual(Object.keys(translations.es).sort());
  });

  it.each(['en', 'pt'] as const)('%s placeholders match the Spanish ones', (lang) => {
    for (const [key, text] of Object.entries(translations.es)) {
      const placeholders = (s: string) => (s.match(/\{\w+\}/g) || []).sort();
      expect(placeholders((translations[lang] as Record<string, string>)[key]), key).toEqual(placeholders(text));
    }
  });

  it.each(['es', 'en', 'pt'] as const)('%s makes no claims the contract does not back', (lang) => {
    const text = values(lang);
    expect(text).not.toMatch(/4 (días|days|dias)/i); // the review window is 5 days
    expect(text).not.toMatch(/neutral|neutro/i); // the arbiter is the operator during this stage
    expect(text).not.toMatch(/instant/i); // escrow settlement is not instant
    expect(text).not.toMatch(/se liberarán automáticamente|auto-release to your wallet|liberados automaticamente/i); // the seller must claim it
  });
});

describe('terms disclose the operator powers', () => {
  it.each(['es', 'en', 'pt'] as const)('%s mentions renouncing ownership, deadlines during a pause and who arbitrates', (lang) => {
    const text = TERMS[lang].sections.flatMap((s) => s.paragraphs).join('\n');
    expect(text).toMatch({ es: /renunciar a la propiedad/, en: /renounce ownership/, pt: /renunciar à propriedade/ }[lang]);
    expect(text).toMatch({ es: /siguen corriendo durante la pausa/, en: /keep running during a pause/, pt: /continuam correndo durante a pausa/ }[lang]);
    expect(text).toMatch({ es: /el árbitro es el propio operador/, en: /the arbitrator is the Mercadopleis operator/, pt: /o árbitro é o próprio operador/ }[lang]);
  });
});
