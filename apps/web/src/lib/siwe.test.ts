import { describe, expect, it } from 'vitest';
import { parseSiweMessage, validateSiweMessage } from './siwe';

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
const NOW = Date.parse('2026-10-14T12:00:00.000Z');

function message(overrides: Partial<Record<'domain' | 'uri' | 'version' | 'chainId' | 'issuedAt' | 'nonce' | 'expiration', string>> = {}) {
  const o = {
    domain: 'mercadopleis.club',
    uri: 'https://mercadopleis.club',
    version: '1',
    chainId: '8453',
    issuedAt: new Date(NOW - 5_000).toISOString(),
    nonce: 'abc123_1790000000000',
    ...overrides,
  };
  return (
    `${o.domain} wants you to sign in with your Ethereum account:\n${ADDRESS}\n\nIniciar sesión.\n\n` +
    `URI: ${o.uri}\nVersion: ${o.version}\nChain ID: ${o.chainId}\nNonce: ${o.nonce}\nIssued At: ${o.issuedAt}` +
    (o.expiration ? `\nExpiration Time: ${o.expiration}` : '')
  );
}

const validate = (msg: string, opts: { reqHost?: string; isProduction?: boolean; now?: number } = {}) => {
  const parsed = parseSiweMessage(msg);
  if (!parsed) throw new Error('message did not parse');
  return validateSiweMessage(parsed, { reqHost: opts.reqHost ?? 'mercadopleis.club', isProduction: opts.isProduction ?? true, now: opts.now ?? NOW });
};

describe('parseSiweMessage', () => {
  it('parses every field of a well-formed message', () => {
    const parsed = parseSiweMessage(message());
    expect(parsed).toMatchObject({
      domain: 'mercadopleis.club',
      address: ADDRESS,
      uri: 'https://mercadopleis.club',
      version: '1',
      chainId: 8453,
      nonce: 'abc123_1790000000000',
    });
  });

  it('rejects the legacy non-EIP-4361 format', () => {
    expect(parseSiweMessage(`Sign in to mercadopleis with your Ethereum account:\nAddress: ${ADDRESS}\nNonce: x`)).toBeNull();
  });

  it('rejects a message with a missing required field', () => {
    expect(parseSiweMessage(message().replace(/\nNonce:[^\n]+/, ''))).toBeNull();
  });

  it('rejects a malformed address', () => {
    expect(parseSiweMessage(message().replace(ADDRESS, '0x1234'))).toBeNull();
  });

  it('parses the optional expiration time', () => {
    const exp = new Date(NOW + 60_000).toISOString();
    expect(parseSiweMessage(message({ expiration: exp }))?.expirationTime).toBe(exp);
  });
});

describe('validateSiweMessage', () => {
  it('accepts a valid production message', () => {
    expect(validate(message())).toEqual({ ok: true });
  });

  it('accepts the www domain', () => {
    expect(validate(message({ domain: 'www.mercadopleis.club', uri: 'https://www.mercadopleis.club' }), { reqHost: 'www.mercadopleis.club' })).toEqual({ ok: true });
  });

  it('rejects an unsupported version', () => {
    expect(validate(message({ version: '2' }))).toMatchObject({ ok: false, error: expect.stringContaining('version') });
  });

  it('rejects a foreign domain (phishing site)', () => {
    const res = validate(message({ domain: 'evil.example', uri: 'https://evil.example' }));
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining('domain') });
  });

  it('rejects a URI whose host differs from the signed domain', () => {
    const res = validate(message({ uri: 'https://evil.example' }));
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining('URI authority') });
  });

  it('rejects an invalid URI', () => {
    expect(validate(message({ uri: 'not a uri' }))).toMatchObject({ ok: false, error: expect.stringContaining('URI') });
  });

  it('rejects unsupported chain ids but accepts Base and Base Sepolia', () => {
    expect(validate(message({ chainId: '1' }))).toMatchObject({ ok: false });
    expect(validate(message({ chainId: '84532' }))).toEqual({ ok: true });
  });

  it('rejects an expired message (older than 10 minutes)', () => {
    const res = validate(message({ issuedAt: new Date(NOW - 11 * 60_000).toISOString() }));
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining('expired') });
  });

  it('rejects a message issued in the future', () => {
    const res = validate(message({ issuedAt: new Date(NOW + 5 * 60_000).toISOString() }));
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining('future') });
  });

  it('rejects an unparseable issuedAt', () => {
    expect(validate(message({ issuedAt: 'yesterday' }))).toMatchObject({ ok: false });
  });

  it('rejects a message past its own expirationTime', () => {
    const res = validate(message({ expiration: new Date(NOW - 1_000).toISOString() }));
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining('expirationTime') });
  });

  describe('localhost', () => {
    const local = message({ domain: 'localhost:3000', uri: 'http://localhost:3000' });

    it('is accepted outside production', () => {
      expect(validate(local, { reqHost: 'localhost:3000', isProduction: false })).toEqual({ ok: true });
    });

    it('is not accepted as a signed domain in production for a different request host', () => {
      expect(validate(local, { reqHost: 'mercadopleis.club', isProduction: true })).toMatchObject({ ok: false });
    });
  });
});
