import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { concatHex, decodeFunctionData, encodeFunctionData, getAddress, parseUnits } from 'viem';
import { MarketplaceEscrowAbi } from '../../contracts-abi/src/MarketplaceEscrowAbi';
import { BUILDER_DATA_SUFFIX, NETWORKS, ORDER_STATUS, erc20Abi, escrowAbi } from './config';

const repoRoot = resolve(__dirname, '../../..');

describe('Builder Code suffix (ERC-8021)', () => {
  it('ends with the repeating 8021 marker and embeds the code', () => {
    expect(BUILDER_DATA_SUFFIX.endsWith('0b0080218021802180218021802180218021')).toBe(true);
    expect(Buffer.from(BUILDER_DATA_SUFFIX.slice(2), 'hex').toString('utf8')).toContain('bc_dmphihka');
  });

  it('leaves the function call decodable when appended to calldata', () => {
    const data = encodeFunctionData({ abi: escrowAbi, functionName: 'approveDelivery', args: [7n] });
    const tagged = concatHex([data, BUILDER_DATA_SUFFIX]);
    // The EVM ignores trailing bytes beyond the ABI-encoded arguments.
    expect(tagged.startsWith(data)).toBe(true);
    expect(decodeFunctionData({ abi: escrowAbi, data }).args).toEqual([7n]);
  });
});

describe('drift guards against the contract', () => {
  it('ORDER_STATUS matches the OrderStatus enum in MarketplaceEscrow.sol', () => {
    const sol = readFileSync(resolve(repoRoot, 'contracts/src/MarketplaceEscrow.sol'), 'utf8');
    const body = sol.match(/enum OrderStatus\s*\{([^}]+)\}/)![1];
    const names = body.split(',').map((s) => s.trim()).filter(Boolean);
    expect([...ORDER_STATUS]).toEqual(names);
  });

  it('the minimal ABI used by the MCP server matches the published escrow ABI', () => {
    for (const fn of escrowAbi) {
      const published = MarketplaceEscrowAbi.find((x: any) => x.type === 'function' && x.name === fn.name) as any;
      expect(published, `function ${fn.name} exists in the escrow ABI`).toBeDefined();
      expect(published.inputs.map((i: any) => i.type)).toEqual(fn.inputs.map((i) => i.type));
      expect(published.outputs.map((o: any) => o.type)).toEqual(fn.outputs.map((o) => o.type));
    }
  });

  it('the escrow address of each network matches the registry in contracts-abi', async () => {
    const { ESCROW_ADDRESSES } = await import('../../contracts-abi/src/index');
    for (const chainId of [8453, 84532]) {
      expect(NETWORKS[chainId].escrow.toLowerCase()).toBe(ESCROW_ADDRESSES[chainId].toLowerCase());
    }
  });

  it('uses the official USDC on Base Mainnet', () => {
    expect(NETWORKS[8453].usdc).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  });
});

describe('order calldata', () => {
  it('encodes approve and createAndFundOrder with 6-decimal USDC amounts', () => {
    const amount = parseUnits('20.00', 6);
    expect(amount).toBe(20_000_000n);
    const seller = '0x9ddf9f930ff5b7064ffcee63738af7f6a31afb10';
    const fund = encodeFunctionData({ abi: escrowAbi, functionName: 'createAndFundOrder', args: [seller, NETWORKS[8453].usdc, amount, 2n] });
    expect(decodeFunctionData({ abi: escrowAbi, data: fund }).args).toEqual([getAddress(seller), NETWORKS[8453].usdc, amount, 2n]);
    const approve = encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [NETWORKS[8453].escrow, amount] });
    expect(decodeFunctionData({ abi: erc20Abi, data: approve }).args).toEqual([NETWORKS[8453].escrow, amount]);
  });
});
