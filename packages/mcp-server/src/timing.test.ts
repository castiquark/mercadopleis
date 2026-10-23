import { describe, expect, it } from 'vitest';
import { nextCheck, orderTiming, type OrderClock } from './timing';

const H = 3600n;
const NOW = 1_800_000_000n;
const iso = (t: bigint) => new Date(Number(t) * 1000).toISOString();
const clock = (c: Partial<OrderClock>): OrderClock => ({
  status: 1, version: 3, now: NOW, deadline: NOW + 48n * H, autoRelease: 0n, disputeTimeout: 0n, delivered: false, ...c,
});

describe('nextCheck', () => {
  it('waits a tenth of the time left, between 5 minutes and 6 hours', () => {
    expect(nextCheck(NOW, NOW + 10n * H)).toBe(NOW + H);
    expect(nextCheck(NOW, NOW + 100n * H)).toBe(NOW + 6n * H);
    expect(nextCheck(NOW, NOW + 20n * 60n)).toBe(NOW + 300n);
  });

  it('never points past the due time', () => {
    expect(nextCheck(NOW, NOW + 60n)).toBe(NOW + 60n);
  });
});

describe('orderTiming', () => {
  it('Funded: expects the delivery by the deadline and spaces the checks', () => {
    const t = orderTiming(clock({}));
    expect(t.expectedBy).toBe(iso(NOW + 48n * H));
    expect(t.nextCheckAfter).toBe(iso(NOW + 4n * H + 48n * 60n));
    expect(t.actionRequired).toBeNull();
    expect(t.polling).toMatch(/No need to check again before/);
  });

  it('Funded past the deadline: the refund is the buyer\'s move, nothing to wait for', () => {
    const t = orderTiming(clock({ deadline: NOW - 1n }));
    expect(t.nextCheckAfter).toBeNull();
    expect(t.actionRequired).toMatch(/claim_timeout_refund/);
  });

  it('Delivered: the review is the buyer\'s move, due before auto-release', () => {
    const t = orderTiming(clock({ status: 2, autoRelease: NOW + 72n * H, delivered: true }));
    expect(t.expectedBy).toBe(iso(NOW + 72n * H));
    expect(t.nextCheckAfter).toBeNull();
    expect(t.actionRequired).toMatch(/approve_delivery or open_dispute/);
  });

  it('Disputed on v3: due at the dispute timeout, or at the deadline when nothing was delivered and it is later', () => {
    const delivered = orderTiming(clock({ status: 5, disputeTimeout: NOW + 100n * H, delivered: true }));
    expect(delivered.expectedBy).toBe(iso(NOW + 100n * H));
    expect(delivered.nextCheckAfter).toBe(iso(NOW + 6n * H));
    const late = orderTiming(clock({ status: 5, disputeTimeout: NOW + H, deadline: NOW + 10n * H }));
    expect(late.expectedBy).toBe(iso(NOW + 10n * H));
  });

  it('Disputed on v3 after the timeout: anyone can close it', () => {
    const t = orderTiming(clock({ status: 5, disputeTimeout: NOW - 1n, deadline: NOW - 1n }));
    expect(t.nextCheckAfter).toBeNull();
    expect(t.actionRequired).toMatch(/claim_dispute_timeout \(the buyer is refunded\)/);
  });

  it('Disputed on v2: no timeout, checks every 6 hours', () => {
    const t = orderTiming(clock({ status: 5, version: 2 }));
    expect(t.expectedBy).toBeNull();
    expect(t.nextCheckAfter).toBe(iso(NOW + 6n * H));
  });

  it('final states need no more checks; v3 points to the withdrawal', () => {
    for (const status of [3, 4, 6]) {
      const t = orderTiming(clock({ status }));
      expect([t.expectedBy, t.nextCheckAfter, t.actionRequired]).toEqual([null, null, null]);
      expect(t.polling).toMatch(/get_withdrawable/);
    }
    expect(orderTiming(clock({ status: 3, version: 2 })).polling).not.toMatch(/withdraw/);
  });
});
