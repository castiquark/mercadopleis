import { describe, expect, it } from 'vitest';
import { serviceFromProposal, slugify, visibleProposals } from './requests';
import { validateProposalInput, validateRequestInput } from './validation';

describe('validateRequestInput', () => {
  const ok = { title: 'Label 500 support tickets', description: 'Positive, negative or neutral.', category: 'ai_data', budgetUsdc: '40', deliveryDays: 3 };

  it('accepts a valid request and normalizes the budget', () => {
    expect(validateRequestInput(ok)).toEqual({ ok: true, value: { ...ok, budgetUsdc: '40.00' } });
  });

  it.each([
    [{ title: '' }, 'title'],
    [{ description: '   ' }, 'description'],
    [{ category: 'crypto-pumps' }, 'category'],
    [{ budgetUsdc: '0.5' }, 'budgetUsdc'],
    [{ budgetUsdc: '10.123' }, '2 decimals'],
    [{ deliveryDays: 400 }, 'deliveryDays'],
    [{ deliveryDays: 1.5 }, 'deliveryDays'],
  ])('rejects %j', (patch, error) => {
    const r = validateRequestInput({ ...ok, ...patch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(error);
  });
});

describe('validateProposalInput', () => {
  it('requires a price, a delivery time and a message', () => {
    expect(validateProposalInput({ priceUsdc: 35, deliveryDays: 2, message: 'I can do it with two reviewers.' })).toEqual({
      ok: true,
      value: { priceUsdc: '35.00', deliveryDays: 2, message: 'I can do it with two reviewers.' },
    });
    expect(validateProposalInput({ priceUsdc: 35, deliveryDays: 2, message: '' }).ok).toBe(false);
    expect(validateProposalInput({ priceUsdc: 20000, deliveryDays: 2, message: 'x' }).ok).toBe(false);
  });
});

describe('slugify', () => {
  it('strips accents and symbols and keeps a unique suffix', () => {
    expect(slugify('Transcripción de 2 h de audio (español)!', 'abc')).toBe('transcripcion-de-2-h-de-audio-espanol-abc');
    expect(slugify('¡¡!!', 'x')).toBe('request-x');
  });
});

describe('serviceFromProposal', () => {
  it('copies the accepted price and delivery time into an unlisted service of the seller', () => {
    const s = serviceFromProposal(
      { title: 'Clean a dataset', description: 'JSONL, 2k rows', category: 'ai_data', slug: 'clean-a-dataset-k1' },
      { id: '0b5c1e8a-0000-0000-0000-000000000000', priceUsdc: '35.00', deliveryDays: 2, message: 'Done in 2 days' },
      'seller-1'
    );
    expect(s).toMatchObject({ sellerId: 'seller-1', priceUsdc: '35.00', deliveryDays: 2, isListed: false, isActive: true, category: 'ai_data' });
    expect(s.slug).toBe('clean-a-dataset-k1-p0b5c1e8a');
    expect(s.description).toContain('Done in 2 days');
  });
});

describe('visibleProposals', () => {
  const request = { buyerId: 'buyer' };
  const proposals = [{ sellerId: 'a' }, { sellerId: 'b' }];

  it('shows every proposal to the buyer and to admins', () => {
    expect(visibleProposals(request, proposals, { id: 'buyer', role: 'USER' })).toHaveLength(2);
    expect(visibleProposals(request, proposals, { id: 'x', role: 'ADMIN' })).toHaveLength(2);
  });

  it('shows a seller only their own proposal and anonymous visitors none', () => {
    expect(visibleProposals(request, proposals, { id: 'a', role: 'USER' })).toEqual([{ sellerId: 'a' }]);
    expect(visibleProposals(request, proposals, { id: 'z', role: 'USER' })).toEqual([]);
    expect(visibleProposals(request, proposals, null)).toEqual([]);
  });
});
