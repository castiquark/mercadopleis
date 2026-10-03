import { describe, expect, it } from 'vitest';
import { currentEscrowKey, resolveNetwork } from './networks';

const MAINNET_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

describe('resolveNetwork', () => {
  it('defaults to Base Mainnet when no wallet is connected', () => {
    for (const input of [undefined, null]) {
      const n = resolveNetwork(input);
      expect(n).toMatchObject({ chainId: 8453, supported: true, isTestnet: false, usdc: MAINNET_USDC });
    }
  });

  it('resolves Base Mainnet to the native Circle USDC', () => {
    expect(resolveNetwork(8453)).toMatchObject({ supported: true, isTestnet: false, usdc: MAINNET_USDC });
  });

  it('resolves Base Sepolia to the test USDC and flags it as testnet', () => {
    const n = resolveNetwork(84532);
    expect(n).toMatchObject({ supported: true, isTestnet: true });
    expect(n.usdc).not.toBe(MAINNET_USDC);
  });

  it('marks other chains as unsupported and never falls back to testnet addresses', () => {
    for (const id of [1, 10, 137, 42161, 11155111]) {
      const n = resolveNetwork(id);
      expect(n.supported).toBe(false);
      expect(n.isTestnet).toBe(false);
      expect(n.usdc).toBe(MAINNET_USDC);
    }
  });

  it('uses the same escrow address on both supported chains', () => {
    expect(resolveNetwork(8453).escrow).toBe(resolveNetwork(84532).escrow);
  });
});

describe('currentEscrowKey', () => {
  it('is the lowercase registry address, used to tell escrow deployments apart', () => {
    for (const chainId of [8453, 84532]) {
      const key = currentEscrowKey(chainId);
      expect(key).toBe(key.toLowerCase());
      expect(key).toBe(resolveNetwork(chainId).escrow.toLowerCase());
      expect(key).toMatch(/^0x[0-9a-f]{40}$/);
    }
  });
});
