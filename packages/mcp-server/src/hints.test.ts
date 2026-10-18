import { describe, expect, it } from 'vitest';
import { requestDraft, searchNext, titleFromCapability } from './hints';

describe('search hints', () => {
  it('turns capability keywords into a request title', () => {
    expect(titleFromCapability('spanish-audio-transcription')).toBe('Spanish audio transcription');
    expect(titleFromCapability('  medical_dataset   validation ')).toBe('Medical dataset validation');
    expect(titleFromCapability('')).toBeUndefined();
  });

  it('drafts a request from the search criteria, leaving unknown fields to the agent', () => {
    expect(requestDraft({ capability: 'web-scraping', maxPriceUsdc: 15, maxDeliveryDays: 2 })).toMatchObject({
      title: 'Web scraping', budgetUsdc: 15, deliveryDays: 2, category: null,
    });
  });

  it('points an empty search to post_request with a draft and the login steps', () => {
    const next = searchNext({ capability: 'ocr-review' }, 0, [], false) as Record<string, any>;
    expect(next.tool).toBe('post_request');
    expect(next.draft.title).toBe('Ocr review');
    expect(next.requires).toMatch(/prepare_login/);
    expect(next.nearMisses).toBeUndefined();
  });

  it('mentions services outside the price or delivery limits', () => {
    const next = searchNext({ capability: 'scraping', maxPriceUsdc: 5 }, 0, [
      { slug: 'a', title: 'A', priceUsdc: '12.00', deliveryDays: 3 },
      { slug: 'b', title: 'B', priceUsdc: '9.50', deliveryDays: 5 },
    ], true) as Record<string, any>;
    expect(next.why).toContain('cheapest 9.50 USDC, fastest 3 days');
    expect(next.nearMisses).toHaveLength(2);
    expect(next.requires).toBeNull();
  });

  it('keeps a short reminder when there are results', () => {
    expect(searchNext({ capability: 'x' }, 3, [], false)).toEqual({ ifNoneFit: expect.stringContaining('post_request') });
  });
});
