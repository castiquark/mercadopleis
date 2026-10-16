import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

// A minimal chainable fake of the drizzle calls used by serverAuth.
const mocks = vi.hoisted(() => {
  const returning = vi.fn();
  const deleteWhere = vi.fn(() => Object.assign(Promise.resolve(undefined), { returning }));
  const del = vi.fn(() => ({ where: deleteWhere }));
  const onConflictDoUpdate = vi.fn(async () => undefined);
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));
  return { returning, deleteWhere, del, onConflictDoUpdate, values, insert };
});

vi.mock('@mercadopleis/database', () => ({
  db: { insert: mocks.insert, delete: mocks.del },
  authNonces: {},
}));

import {
  generateNonceForAddress,
  getAuthUserFromRequest,
  getJwtSecret,
  signUserToken,
  validateAndConsumeNonce,
} from './serverAuth';

const ADDRESS = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01';
const STRONG_SECRET = 'a'.repeat(40);
const payload = { id: 'user-1', walletAddress: ADDRESS.toLowerCase(), role: 'USER' };
const requestWith = (authorization?: string) => new Request('https://x.test', { headers: authorization ? { authorization } : {} });

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getJwtSecret', () => {
  it('requires a real secret in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', '');
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it('rejects short secrets in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'too-short');
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it.each([
    'mercadopleis_super_secret_jwt_key_change_in_production',
    'mercadopleis_development_jwt_secret_key_123',
  ])('rejects the known public placeholder %s in production', (placeholder) => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', placeholder);
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it('accepts a strong secret in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', STRONG_SECRET);
    expect(getJwtSecret()).toBe(STRONG_SECRET);
  });

  it('falls back to a dev-only secret outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('JWT_SECRET', '');
    expect(getJwtSecret()).toMatch(/dev-only/);
  });
});

describe('JWT sign and verify', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', STRONG_SECRET);
  });

  it('round-trips a signed token through a Bearer header', () => {
    const token = signUserToken(payload);
    expect(getAuthUserFromRequest(requestWith(`Bearer ${token}`))).toMatchObject(payload);
  });

  it('returns null without an Authorization header or with a non-Bearer scheme', () => {
    expect(getAuthUserFromRequest(requestWith())).toBeNull();
    expect(getAuthUserFromRequest(requestWith('Basic abc'))).toBeNull();
  });

  it('rejects garbage tokens', () => {
    expect(getAuthUserFromRequest(requestWith('Bearer not.a.jwt'))).toBeNull();
  });

  it('rejects a token forged with the old public default secret', () => {
    const forged = jwt.sign({ ...payload, role: 'ADMIN' }, 'mercadopleis_super_secret_jwt_key_change_in_production');
    expect(getAuthUserFromRequest(requestWith(`Bearer ${forged}`))).toBeNull();
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign(payload, STRONG_SECRET, { expiresIn: -10 });
    expect(getAuthUserFromRequest(requestWith(`Bearer ${expired}`))).toBeNull();
  });

  it('fails closed (no session, no throw) when the production secret is misconfigured', () => {
    const token = signUserToken(payload);
    vi.stubEnv('JWT_SECRET', 'short');
    expect(getAuthUserFromRequest(requestWith(`Bearer ${token}`))).toBeNull();
    expect(() => signUserToken(payload)).toThrow(/JWT_SECRET/);
  });
});

describe('generateNonceForAddress', () => {
  it('creates a nonce that expires in about 5 minutes and upserts it in auth_nonces', async () => {
    const before = Date.now();
    const nonce = await generateNonceForAddress(ADDRESS);
    const [raw, expires] = nonce.split('_');
    expect(raw).toMatch(/^[0-9a-f]{32}$/);
    expect(Number(expires)).toBeGreaterThanOrEqual(before + 5 * 60_000 - 1000);
    expect(Number(expires)).toBeLessThanOrEqual(Date.now() + 5 * 60_000 + 1000);
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ walletAddress: ADDRESS.toLowerCase(), nonce }));
    expect(mocks.onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });

  it('never creates a user (only the nonce table is written)', async () => {
    await generateNonceForAddress(ADDRESS);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });

  it('generates a different nonce each time', async () => {
    const [a, b] = [await generateNonceForAddress(ADDRESS), await generateNonceForAddress(ADDRESS)];
    expect(a).not.toBe(b);
  });
});

describe('validateAndConsumeNonce', () => {
  const future = () => `abc_${Date.now() + 60_000}`;

  it('rejects an empty nonce without touching the database', async () => {
    const res = await validateAndConsumeNonce(ADDRESS, '');
    expect(res.isValid).toBe(false);
    expect(mocks.del).not.toHaveBeenCalled();
  });

  it('rejects an expired nonce and clears it', async () => {
    const res = await validateAndConsumeNonce(ADDRESS, `abc_${Date.now() - 1000}`);
    expect(res).toMatchObject({ isValid: false, error: expect.stringContaining('expired') });
    expect(mocks.del).toHaveBeenCalledTimes(1);
  });

  it('accepts and consumes a fresh nonce exactly once', async () => {
    mocks.returning.mockResolvedValueOnce([{ walletAddress: ADDRESS.toLowerCase() }]);
    expect(await validateAndConsumeNonce(ADDRESS, future())).toEqual({ isValid: true });
  });

  it('rejects a nonce that was already consumed (no matching row)', async () => {
    mocks.returning.mockResolvedValueOnce([]);
    const res = await validateAndConsumeNonce(ADDRESS, future());
    expect(res).toMatchObject({ isValid: false, error: expect.stringContaining('already consumed') });
  });

  it('replay: the second use of the same nonce is rejected', async () => {
    mocks.returning.mockResolvedValueOnce([{ walletAddress: 'x' }]).mockResolvedValueOnce([]);
    const nonce = future();
    expect((await validateAndConsumeNonce(ADDRESS, nonce)).isValid).toBe(true);
    expect((await validateAndConsumeNonce(ADDRESS, nonce)).isValid).toBe(false);
  });
});
