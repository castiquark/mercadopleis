import { describe, expect, it } from 'vitest';
import { decodeEscrowError, escrowErrorMessage, onchainStatusName } from './escrowErrors';

const L = (_es: string, en: string) => en;

describe('decodeEscrowError', () => {
  it('finds a nested ContractFunctionRevertedError via walk', () => {
    const inner = { name: 'ContractFunctionRevertedError', data: { errorName: 'InvalidStatus', args: [4, 1] } };
    const err = { walk: (fn: (e: any) => boolean) => (fn(err) ? err : fn(inner) ? inner : null) };
    expect(decodeEscrowError(err)).toEqual({ name: 'InvalidStatus', args: [4, 1] });
  });

  it('follows cause chains without walk', () => {
    expect(decodeEscrowError({ cause: { cause: { data: { errorName: 'EnforcedPause' } } } })?.name).toBe('EnforcedPause');
  });

  it('ignores unknown errors', () => {
    expect(decodeEscrowError({ data: { errorName: 'Other' } })).toBeNull();
    expect(decodeEscrowError(new Error('boom'))).toBeNull();
  });
});

describe('escrowErrorMessage', () => {
  it('names the on-chain status for InvalidStatus', () => {
    expect(escrowErrorMessage({ name: 'InvalidStatus', args: [4, 1] }, L)).toContain('refunded');
  });
  it('maps enum values', () => {
    expect(onchainStatusName(4)).toBe('REFUNDED');
    expect(onchainStatusName(9)).toBeNull();
  });
});
