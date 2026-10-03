import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('@mercadopleis/database', () => ({ db: { execute: mocks.execute } }));

import { checkRateLimit, enforceRateLimit, getClientIp } from './rateLimit';

const rule = { name: 'test:bucket', id: 'user-1', limit: 3, windowSeconds: 60 };

// postgres-js returns an array of rows; PGlite returns { rows }. Both shapes must work.
const pgRows = (count: number, retry = 42) => [{ count, retry_after: retry }];
const pgliteRows = (count: number, retry = 42) => ({ rows: [{ count, retry_after: retry }] });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('checkRateLimit', () => {
  it('allows requests up to the limit and rejects the next one', async () => {
    for (const n of [1, 2, 3]) {
      mocks.execute.mockResolvedValueOnce(pgRows(n));
      expect((await checkRateLimit(rule)).allowed).toBe(true);
    }
    mocks.execute.mockResolvedValueOnce(pgRows(4));
    const blocked = await checkRateLimit(rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(42);
  });

  it('understands both postgres-js and PGlite result shapes', async () => {
    mocks.execute.mockResolvedValueOnce(pgliteRows(9));
    expect((await checkRateLimit(rule)).allowed).toBe(false);
  });

  it('never reports a retry time below one second', async () => {
    mocks.execute.mockResolvedValueOnce(pgRows(10, 0.2));
    expect((await checkRateLimit(rule)).retryAfter).toBe(1);
  });

  it('fails open when the database is unavailable', async () => {
    mocks.execute.mockRejectedValueOnce(new Error('relation "rate_limits" does not exist'));
    const r = await checkRateLimit(rule);
    expect(r.allowed).toBe(true);
    expect(console.error).toHaveBeenCalled();
  });

  it('truncates very long keys instead of failing', async () => {
    mocks.execute.mockResolvedValueOnce(pgRows(1));
    await expect(checkRateLimit({ ...rule, id: 'x'.repeat(500) })).resolves.toMatchObject({ allowed: true });
  });
});

describe('enforceRateLimit', () => {
  it('returns null when every rule passes', async () => {
    mocks.execute.mockResolvedValue(pgRows(1));
    expect(await enforceRateLimit([rule, { ...rule, name: 'other' }])).toBeNull();
    expect(mocks.execute).toHaveBeenCalledTimes(2);
  });

  it('returns a 429 with Retry-After for the first rule exceeded and skips the rest', async () => {
    mocks.execute.mockResolvedValueOnce(pgRows(50, 17));
    const res = await enforceRateLimit([rule, { ...rule, name: 'second' }]);
    expect(res?.status).toBe(429);
    expect(res?.headers.get('Retry-After')).toBe('17');
    expect(await res?.json()).toMatchObject({ retryAfterSeconds: 17 });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });
});

describe('getClientIp', () => {
  const req = (headers: Record<string, string>) => new Request('https://x.test', { headers });

  it('prefers the Netlify connection IP', () => {
    expect(getClientIp(req({ 'x-nf-client-connection-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' }))).toBe('1.2.3.4');
  });

  it('falls back to the first x-forwarded-for entry', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '5.6.7.8, 10.0.0.1' }))).toBe('5.6.7.8');
  });

  it('returns "unknown" without proxy headers', () => {
    expect(getClientIp(req({}))).toBe('unknown');
  });
});
