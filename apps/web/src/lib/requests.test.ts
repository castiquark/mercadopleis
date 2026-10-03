import { describe, expect, it } from 'vitest';
import { servicesFromProposal, slugify, visibleProposals } from './requests';
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

describe('validateProposalInput with milestones', () => {
  const two = [
    { title: 'Sample', amountUsdc: '10', deliveryDays: 1 },
    { title: 'Rest', amountUsdc: '40.50', deliveryDays: 4 },
  ];

  it('derives the total price and days from the milestones', () => {
    const r = validateProposalInput({ message: 'Two phases', milestones: two, priceUsdc: '999', deliveryDays: 1 });
    expect(r).toEqual({
      ok: true,
      value: { priceUsdc: '50.50', deliveryDays: 5, message: 'Two phases', milestones: [
        { title: 'Sample', amountUsdc: '10.00', deliveryDays: 1 },
        { title: 'Rest', amountUsdc: '40.50', deliveryDays: 4 },
      ] },
    });
  });

  it('adds cents exactly', () => {
    const r = validateProposalInput({ message: 'x', milestones: [
      { title: 'a', amountUsdc: '0.10', deliveryDays: 1 },
      { title: 'b', amountUsdc: '0.20', deliveryDays: 1 },
    ] });
    // Each phase must still be at least 1 USDC.
    expect(r.ok).toBe(false);
    const ok = validateProposalInput({ message: 'x', milestones: [
      { title: 'a', amountUsdc: '1.10', deliveryDays: 1 },
      { title: 'b', amountUsdc: '1.20', deliveryDays: 1 },
    ] });
    expect(ok.ok && ok.value.priceUsdc).toBe('2.30');
  });

  it.each([
    [[two[0]], 'milestones'],
    [Array(11).fill(two[0]), 'milestones'],
    [[two[0], { ...two[1], title: '' }], 'milestone 2: title'],
    [[two[0], { ...two[1], deliveryDays: 0 }], 'milestone 2'],
    [[{ ...two[0], deliveryDays: 300 }, { ...two[1], deliveryDays: 100 }], '365 days'],
  ])('rejects invalid milestones (%#)', (milestones, error) => {
    const r = validateProposalInput({ message: 'x', milestones });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(error);
  });
});

describe('validateProposalInput', () => {
  it('requires a price, a delivery time and a message', () => {
    expect(validateProposalInput({ priceUsdc: 35, deliveryDays: 2, message: 'I can do it with two reviewers.' })).toEqual({
      ok: true,
      value: { priceUsdc: '35.00', deliveryDays: 2, message: 'I can do it with two reviewers.', milestones: null },
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

describe('servicesFromProposal', () => {
  const request = { title: 'Clean a dataset', description: 'JSONL, 2k rows', category: 'ai_data', slug: 'clean-a-dataset-k1' };
  const id = '0b5c1e8a-0000-0000-0000-000000000000';

  it('creates one unlisted service with the accepted price and delivery time', () => {
    const [s] = servicesFromProposal(request, { id, priceUsdc: '35.00', deliveryDays: 2, message: 'Done in 2 days' }, 'seller-1');
    expect(s).toMatchObject({ sellerId: 'seller-1', priceUsdc: '35.00', deliveryDays: 2, isListed: false, isActive: true, proposalId: id, milestoneIndex: null });
    expect(s.slug).toBe('clean-a-dataset-k1-p0b5c1e8a');
    expect(s.description).toContain('Done in 2 days');
  });

  it('creates one service per milestone, numbered, with each phase price and days', () => {
    const list = servicesFromProposal(
      request,
      {
        id,
        priceUsdc: '50.00',
        deliveryDays: 5,
        message: 'Two phases',
        milestones: [
          { title: 'Sample of 100 rows', amountUsdc: '10.00', deliveryDays: 1 },
          { title: 'Remaining rows', amountUsdc: '40.00', deliveryDays: 4 },
        ],
      },
      'seller-1'
    );
    expect(list).toHaveLength(2);
    expect(list.map((s) => [s.milestoneIndex, s.milestoneCount, s.priceUsdc, s.deliveryDays])).toEqual([
      [1, 2, '10.00', 1],
      [2, 2, '40.00', 4],
    ]);
    expect(list[1].slug).toBe('clean-a-dataset-k1-p0b5c1e8a-m2');
    expect(list[0].title).toContain('1/2: Sample of 100 rows');
    expect(new Set(list.map((s) => s.proposalId))).toEqual(new Set([id]));
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
