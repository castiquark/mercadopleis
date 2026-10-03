import { describe, expect, it } from 'vitest';
import { parseSiweMessage, validateSiweMessage } from '../../../apps/web/src/lib/siwe';
import { buildSiweMessage } from './session';

const address = '0x00000000000000000000000000000000000000Aa';

describe('SIWE message built by the MCP server', () => {
  it('passes the web API validation in production', () => {
    const message = buildSiweMessage({
      apiUrl: 'https://mercadopleis.club',
      address,
      chainId: 8453,
      nonce: 'abc123',
      issuedAt: new Date().toISOString(),
    });
    const parsed = parseSiweMessage(message);
    expect(parsed).not.toBeNull();
    expect(parsed!.address).toBe(address);
    expect(parsed!.nonce).toBe('abc123');
    expect(validateSiweMessage(parsed!, { reqHost: 'mercadopleis.club', isProduction: true })).toEqual({ ok: true });
  });

  it('uses the API host (with port) as domain and URI for local servers', () => {
    const parsed = parseSiweMessage(
      buildSiweMessage({ apiUrl: 'http://localhost:3100/', address, chainId: 84532, nonce: 'n', issuedAt: new Date().toISOString() })
    )!;
    expect(parsed.domain).toBe('localhost:3100');
    expect(parsed.uri).toBe('http://localhost:3100');
    expect(validateSiweMessage(parsed, { reqHost: 'localhost:3100', isProduction: false })).toEqual({ ok: true });
  });

  it('is rejected by the API once it is older than 10 minutes', () => {
    const parsed = parseSiweMessage(
      buildSiweMessage({
        apiUrl: 'https://mercadopleis.club',
        address,
        chainId: 8453,
        nonce: 'n',
        issuedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
      })
    )!;
    expect(validateSiweMessage(parsed, { reqHost: 'mercadopleis.club', isProduction: true }).ok).toBe(false);
  });
});
