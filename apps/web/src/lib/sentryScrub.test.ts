import { describe, expect, it } from 'vitest';
import { IGNORE_ERRORS, redact, scrubEvent, sentryOptions } from './sentryScrub';

const W = '0x5642984a118D7251A7eE8b31D8cBc60E0bF5e2Bb';

describe('sentry scrubbing', () => {
  it('redacts wallets and signatures', () => {
    expect(redact(`order of ${W}`)).toBe('order of 0x[wallet]');
    expect(redact('sig 0x' + 'ab'.repeat(65))).toBe('sig 0x[signature]');
  });
  it('drops request bodies, cookies, headers, query and user', () => {
    const e: any = scrubEvent({ type: undefined, message: `fail ${W}`, user: { id: '1' }, request: { url: `https://x/orders/${W}`, data: '{"sig":1}', cookies: { a: 'b' }, headers: { authorization: 'Bearer t' }, query_string: 'a=1' }, exception: { values: [{ value: `boom ${W}` }] } } as any);
    expect(e.request).toEqual({ url: 'https://x/orders/0x[wallet]', query_string: '[removed]' });
    expect(e.user).toBeUndefined();
    expect(e.message).toBe('fail 0x[wallet]');
    expect(e.exception.values[0].value).toBe('boom 0x[wallet]');
  });
  it('sends nothing without a DSN and never traces', () => {
    expect(sentryOptions(undefined).enabled).toBe(false);
    expect(sentryOptions('https://k@o.ingest.sentry.io/1').tracesSampleRate).toBe(0);
  });
  it('ignores wallet rejections and expected escrow reverts', () => {
    const hit = (m: string) => IGNORE_ERRORS.some((p) => (typeof p === 'string' ? m.includes(p) : p.test(m)));
    expect(hit('User rejected the request.')).toBe(true);
    expect(hit('The contract function "submitDelivery" reverted. Error: InvalidStatus(4, 1)')).toBe(true);
    expect(hit('TypeError: cannot read properties of undefined')).toBe(false);
  });
});
