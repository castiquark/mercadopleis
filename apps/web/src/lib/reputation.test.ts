import { describe, expect, it } from 'vitest';
import { EMPTY_STATS, computeStats } from './reputation';

const ME = 'user-me';
const OTHER = 'user-other';

const order = (o: Record<string, unknown>) => ({
  id: Math.random().toString(36).slice(2),
  sellerId: ME,
  buyerId: OTHER,
  chainId: 8453,
  status: 'RELEASED',
  grossAmountUsdc: '20.00',
  ...o,
});

describe('computeStats', () => {
  it('returns zeros and no averages for a user with no orders (no invented numbers)', () => {
    expect(computeStats([], ME)).toEqual(EMPTY_STATS);
    expect(EMPTY_STATS.avgRating).toBeNull();
    expect(EMPTY_STATS.successRate).toBeNull();
  });

  it('counts only released orders where the user is the seller', () => {
    const stats = computeStats(
      [order({}), order({}), order({ status: 'FUNDED' }), order({ sellerId: OTHER, buyerId: ME })],
      ME
    );
    expect(stats.completed).toBe(2);
  });

  it('ignores Base Sepolia (testnet) orders entirely', () => {
    const stats = computeStats([order({ chainId: 84532 }), order({ chainId: 84532, review: { rating: 5 } })], ME);
    expect(stats).toEqual(EMPTY_STATS);
  });

  it('treats an order without chainId as Base Mainnet', () => {
    expect(computeStats([order({ chainId: undefined })], ME).completed).toBe(1);
  });

  it('averages only real review ratings of the seller', () => {
    const stats = computeStats(
      [order({ review: { rating: 5 } }), order({ review: { rating: 4 } }), order({}), order({ review: {} })],
      ME
    );
    expect(stats.reviewCount).toBe(2);
    expect(stats.avgRating).toBe(4.5);
  });

  it('computes the success rate over finished orders (released, refunded, resolved)', () => {
    const stats = computeStats(
      [order({}), order({}), order({}), order({ status: 'REFUNDED' }), order({ status: 'FUNDED' })],
      ME
    );
    expect(stats.successRate).toBe(75);
  });

  it('counts open disputes from either role', () => {
    const stats = computeStats(
      [
        order({ status: 'DISPUTED' }),
        order({ sellerId: OTHER, buyerId: ME, status: 'DISPUTED' }),
        order({ dispute: { status: 'OPEN' } }),
        order({ dispute: { status: 'RESOLVED' } }),
      ],
      ME
    );
    expect(stats.openDisputes).toBe(3);
  });

  it('sums the gross volume of released and resolved orders only', () => {
    const stats = computeStats(
      [
        order({ grossAmountUsdc: '20.00' }),
        order({ status: 'RESOLVED', grossAmountUsdc: '15.50' }),
        order({ status: 'FUNDED', grossAmountUsdc: '99.00' }),
        order({ status: 'REFUNDED', grossAmountUsdc: '50.00' }),
      ],
      ME
    );
    expect(stats.volumeUsdc).toBeCloseTo(35.5, 2);
  });

  it('survives malformed amounts', () => {
    expect(computeStats([order({ grossAmountUsdc: 'abc' })], ME).volumeUsdc).toBe(0);
  });
});
