import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ESCROW_ADDRESSES } from '@mercadopleis/contracts-abi';
import { CONTRACT_CONFIG } from '@mercadopleis/types';
import { LEGAL, PRIVACY, TERMS } from './legalContent';
import { CONSENT_EVENT, CONSENT_KEY, readConsent, saveConsent } from './consent';

const allText = (doc: { intro: string; sections: { title: string; paragraphs: string[] }[] }) =>
  [doc.intro, ...doc.sections.flatMap((s) => [s.title, ...s.paragraphs])].join('\n');

describe('legal content', () => {
  it.each([
    ['terms', TERMS],
    ['privacy', PRIVACY],
  ])('%s exists in both languages with the same structure and no empty text', (_name, content) => {
    expect(content.es.sections).toHaveLength(content.en.sections.length);
    for (const lang of ['es', 'en'] as const) {
      expect(content[lang].title.length).toBeGreaterThan(3);
      for (const s of content[lang].sections) {
        expect(s.title.trim()).not.toBe('');
        expect(s.paragraphs.length).toBeGreaterThan(0);
        for (const p of s.paragraphs) expect(p.trim()).not.toBe('');
      }
    }
  });

  it('the terms quote the real escrow address, fee, review window and contact addresses', () => {
    expect(LEGAL.escrowAddress.toLowerCase()).toBe(ESCROW_ADDRESSES[8453].toLowerCase());
    for (const lang of ['es', 'en'] as const) {
      const text = allText(TERMS[lang]);
      expect(text).toContain(LEGAL.escrowAddress);
      expect(text).toContain(`${CONTRACT_CONFIG.FEE_BPS / 100}%`);
      expect(text).not.toMatch(/10%|máximo/i); // the fee is fixed; no cap language
      expect(text).toMatch(/nadie|nobody/i);
      expect(text).toContain('5 ');
      expect(text).toContain(LEGAL.contactEmail);
      expect(text).toContain(LEGAL.securityEmail);
    }
  });

  it('the privacy policy discloses analytics, storage providers and on-chain permanence', () => {
    for (const lang of ['es', 'en'] as const) {
      const text = allText(PRIVACY[lang]);
      for (const word of ['Google Analytics', 'Netlify', 'Neon', LEGAL.contactEmail]) expect(text).toContain(word);
    }
  });

  it('only includes a jurisdiction clause when one is configured', () => {
    if (LEGAL.jurisdiction === null) {
      expect(allText(TERMS.es)).not.toContain('null');
    }
  });
});

describe('cookie consent', () => {
  const store = new Map<string, string>();
  const events: string[] = [];

  beforeEach(() => {
    store.clear();
    events.length = 0;
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    vi.stubGlobal('window', {
      dispatchEvent: (e: Event) => void events.push(e.type + ':' + ((e as CustomEvent).detail ?? '')),
    });
  });

  it('has no choice until the visitor decides (analytics must stay off)', () => {
    expect(readConsent()).toBeNull();
  });

  it('stores and broadcasts the choice', () => {
    saveConsent('granted');
    expect(store.get(CONSENT_KEY)).toBe('granted');
    expect(readConsent()).toBe('granted');
    expect(events).toContain(`${CONSENT_EVENT}:granted`);
    saveConsent('denied');
    expect(readConsent()).toBe('denied');
  });

  it('ignores corrupted stored values', () => {
    store.set(CONSENT_KEY, 'maybe');
    expect(readConsent()).toBeNull();
  });

  it('survives unavailable storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readConsent()).toBeNull();
    expect(() => saveConsent('denied')).not.toThrow();
  });
});
