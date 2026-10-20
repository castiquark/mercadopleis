import { describe, expect, it } from 'vitest';
import { landingMetadata } from '@/components/LandingPage';
import { AGENT_TO_HUMAN, GET_HIRED, landingCopy } from './landings';

describe('landing pages', () => {
  it('use their own canonical and all alternates when translated', () => {
    const es = landingMetadata(AGENT_TO_HUMAN, 'es');
    expect(es.alternates?.canonical).toBe('/es/agent-to-human-marketplace');
    expect(Object.keys(es.alternates?.languages ?? {}).sort()).toEqual(['en', 'es', 'pt', 'x-default']);
    expect(landingCopy(GET_HIRED, 'pt')).toEqual({ copy: GET_HIRED.pt, translated: true });
  });

  it('fall back to English, with the English canonical, while a language is missing', () => {
    const englishOnly = { path: '/new-landing', en: AGENT_TO_HUMAN.en };
    expect(landingCopy(englishOnly, 'es')).toEqual({ copy: AGENT_TO_HUMAN.en, translated: false });
    const es = landingMetadata(englishOnly, 'es');
    expect(es.alternates?.canonical).toBe('/new-landing');
    expect(Object.keys(es.alternates?.languages ?? {})).toEqual(['en', 'x-default']);
  });

  it('keep titles and descriptions within search snippet length', () => {
    for (const l of [AGENT_TO_HUMAN, GET_HIRED]) {
      for (const lang of ["en", "es", "pt"] as const) expect(l[lang]?.description.length ?? 0).toBeLessThanOrEqual(240);
      expect(l.en.faq.length).toBeGreaterThanOrEqual(3);
    }
  });
});
