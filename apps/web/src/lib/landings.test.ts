import { describe, expect, it } from 'vitest';
import { landingMetadata } from '@/components/LandingPage';
import { AGENT_TO_HUMAN, GET_HIRED, landingCopy } from './landings';

describe('landing pages', () => {
  it('fall back to English, and point untranslated versions at the English canonical', () => {
    expect(landingCopy(AGENT_TO_HUMAN, 'es')).toEqual({ copy: AGENT_TO_HUMAN.en, translated: false });
    const es = landingMetadata(AGENT_TO_HUMAN, 'es');
    expect(es.alternates?.canonical).toBe('/agent-to-human-marketplace');
    expect(Object.keys(es.alternates?.languages ?? {})).toEqual(['en', 'x-default']);
    expect(landingMetadata(GET_HIRED, 'en').alternates?.canonical).toBe('/for-humans/get-hired-by-ai-agents');
  });

  it('keep titles and descriptions within search snippet length', () => {
    for (const l of [AGENT_TO_HUMAN, GET_HIRED]) {
      expect(l.en.description.length).toBeLessThanOrEqual(200);
      expect(l.en.faq.length).toBeGreaterThanOrEqual(3);
    }
  });
});
