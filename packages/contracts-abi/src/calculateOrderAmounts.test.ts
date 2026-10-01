import { describe, expect, it } from 'vitest';
import { calculateOrderAmounts } from './index';

// Escrow arithmetic from MarketplaceEscrow.sol, in 6-decimal USDC units:
//   fee = amount * feeBps / 10_000 (integer division); sellerPayout = amount - fee
const contractSplit = (usdc: number, feeBps: number) => {
  const amount = BigInt(Math.round(usdc * 1e6));
  const fee = (amount * BigInt(feeBps)) / 10_000n;
  return { fee: Number(fee) / 1e6, seller: Number(amount - fee) / 1e6 };
};

describe('calculateOrderAmounts', () => {
  it('splits 100 USDC into 97 for the seller and 3 for the protocol at the default 3% fee', () => {
    expect(calculateOrderAmounts(100)).toMatchObject({ grossAmountUsdc: 100, platformFeeUsdc: 3, sellerAmountUsdc: 97, feeBps: 300 });
  });

  it('matches the live catalog prices exactly', () => {
    for (const price of [10, 15, 20, 25, 35]) {
      const r = calculateOrderAmounts(price);
      const c = contractSplit(price, 300);
      expect(r.platformFeeUsdc).toBeCloseTo(c.fee, 6);
      expect(r.sellerAmountUsdc).toBeCloseTo(c.seller, 6);
    }
  });

  it('never leaks funds: seller + fee equals gross for whole-dollar prices and any supported fee', () => {
    for (let usdc = 1; usdc <= 500; usdc++) {
      for (const bps of [0, 100, 300, 500, 1000]) {
        const r = calculateOrderAmounts(usdc, bps);
        expect(r.sellerAmountUsdc + r.platformFeeUsdc).toBeCloseTo(usdc, 6);
        expect(r.platformFeeUsdc).toBeGreaterThanOrEqual(0);
        expect(r.sellerAmountUsdc).toBeGreaterThan(0);
      }
    }
  });

  it('takes no fee at 0 bps and 10% at the 1000 bps hard cap', () => {
    expect(calculateOrderAmounts(50, 0)).toMatchObject({ platformFeeUsdc: 0, sellerAmountUsdc: 50 });
    expect(calculateOrderAmounts(50, 1000)).toMatchObject({ platformFeeUsdc: 5, sellerAmountUsdc: 45 });
  });

  it('keeps cent-level results consistent with the contract to within one cent', () => {
    // Orders are stored with 2 decimals while the contract floors at 6 decimals,
    // so sub-cent fees can differ by at most half a cent.
    for (const price of [0.35, 12.5, 19.99, 99.99]) {
      const r = calculateOrderAmounts(price);
      expect(Math.abs(r.platformFeeUsdc - contractSplit(price, 300).fee)).toBeLessThan(0.006);
    }
  });
});
