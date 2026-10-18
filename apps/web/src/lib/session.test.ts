import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAuthToken, getAuthToken, setActiveAuthAddress, setAuthToken } from './api';
import { confirmTx, TxRevertedError } from './txConfirm';

// Minimal browser globals for the node test environment.
const store = new Map<string, string>();
vi.stubGlobal('window', {});
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const A = '0xF6d48E6EFa40Ac16B2A71fa89c81D93da171cA00';
const B = '0x9DdF9f930ff5B7064FfCEe63738af7F6a31AFB10';

beforeEach(() => {
  store.clear();
  setActiveAuthAddress(null);
});

describe('sessions per wallet', () => {
  it('uses the session of the connected wallet, not the one that signed in last', () => {
    setAuthToken('token-a', A);
    setAuthToken('token-b', B); // B signed in last, in the same browser
    setActiveAuthAddress(A);
    expect(getAuthToken()).toBe('token-a');
    setActiveAuthAddress(B.toLowerCase());
    expect(getAuthToken()).toBe('token-b');
  });

  it('sends no session for a connected wallet that has not signed in, nor when no wallet is connected', () => {
    setAuthToken('token-b', B);
    setActiveAuthAddress(A);
    expect(getAuthToken()).toBeNull();
    setActiveAuthAddress(null);
    expect(getAuthToken()).toBeNull();
  });

  it('ignores and removes the old browser-wide session key', () => {
    store.set('mercadopleis_jwt', 'legacy-token');
    setActiveAuthAddress(A);
    expect(getAuthToken()).toBeNull();
    setAuthToken('token-a', A);
    expect(store.has('mercadopleis_jwt')).toBe(false);
    clearAuthToken(A);
    expect(getAuthToken()).toBeNull();
  });
});

describe('confirmTx', () => {
  const hash = `0x${'1'.repeat(64)}` as `0x${string}`;
  const landed = `0x${'2'.repeat(64)}` as `0x${string}`;
  const client = (impl: () => Promise<unknown>) => ({ waitForTransactionReceipt: vi.fn(impl) }) as any;

  it('returns the hash that actually landed', async () => {
    await expect(confirmTx(client(async () => ({ status: 'success', transactionHash: landed })), hash)).resolves.toBe(landed);
  });

  it('throws when the transaction reverted', async () => {
    await expect(confirmTx(client(async () => ({ status: 'reverted', transactionHash: hash })), hash)).rejects.toBeInstanceOf(TxRevertedError);
  });

  it('falls back to the original hash when the receipt does not show up (the API then reads the contract)', async () => {
    await expect(confirmTx(client(async () => { throw new Error('timeout'); }), hash)).resolves.toBe(hash);
    await expect(confirmTx(undefined, hash)).resolves.toBe(hash);
  });
});
