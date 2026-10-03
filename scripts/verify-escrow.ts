/**
 * Verifies on-chain that a deployed MarketplaceEscrow is the fixed-fee version and is configured as documented.
 *
 *   pnpm tsx scripts/verify-escrow.ts 8453    # Base Mainnet (default)
 *   pnpm tsx scripts/verify-escrow.ts 84532   # Base Sepolia
 *
 * Reads only; exits with code 1 if any check fails. The address comes from the registry in
 * packages/contracts-abi, so it checks exactly what the app will use.
 */
import dotenv from 'dotenv';
import path from 'path';
import { createPublicClient, http, parseAbi, toFunctionSelector, type Address } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { ESCROW_ADDRESSES } from '../packages/contracts-abi/src/index';

// Use the RPC configured for the app (a dedicated provider avoids public-RPC rate limits).
dotenv.config({ path: path.resolve(__dirname, '../apps/web/.env.local') });

const chainId = Number(process.argv[2] || 8453);
const chain = chainId === 84532 ? baseSepolia : base;
const rpc = chainId === 84532 ? process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org' : process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org';
const escrow = ESCROW_ADDRESSES[chainId] as Address | undefined;
if (!escrow) throw new Error(`No escrow address registered for chain ${chainId}`);

const USDC: Record<number, Address> = {
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  84532: '0x6Fa1279f6c760fA993B7f9aC75de5a141d7D2D8A',
};
const EXPECTED_ADMIN = (process.env.EXPECTED_OWNER || '').toLowerCase();

const abi = parseAbi([
  'function FEE_BPS() view returns (uint256)',
  'function feeBps() view returns (uint256)',
  'function FEE_DENOMINATOR() view returns (uint256)',
  'function AUTO_RELEASE_DURATION() view returns (uint256)',
  'function owner() view returns (address)',
  'function pendingOwner() view returns (address)',
  'function feeRecipient() view returns (address)',
  'function arbitrator() view returns (address)',
  'function paused() view returns (bool)',
  'function orderCount() view returns (uint256)',
  'function acceptedTokens(address) view returns (bool)',
]);

const client = createPublicClient({ chain, transport: http(rpc) });
let failures = 0;
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
};

async function main() {
  console.log(`Verifying escrow ${escrow} on ${chain.name}\n`);

  const code = await client.getCode({ address: escrow });
  check(!!code && code !== '0x', 'contract code is deployed');
  const bytecode = (code || '0x').toLowerCase();

  // The deployed bytecode must not contain any function that could change the fee.
  for (const sig of ['setFeeBps(uint256)', 'setFee(uint256)', 'updateFee(uint256)']) {
    const selector = toFunctionSelector(sig).slice(2);
    check(!bytecode.includes(selector), `bytecode has no ${sig} (selector ${selector})`);
  }

  // Public RPCs rate-limit bursts of calls, so retry before concluding that a function is missing.
  const read = async <T>(fn: string, args: unknown[] = []): Promise<T | undefined> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 6; attempt++) {
      try {
        return (await client.readContract({ address: escrow, abi, functionName: fn as never, args: args as never })) as T;
      } catch (e) {
        lastError = e;
        const text = String((e as Error)?.message || e);
        // A revert or a missing selector is a real answer; only transport errors are retried.
        if (/revert|returned no data|zero data|could not decode/i.test(text)) return undefined;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    throw new Error(`RPC error reading ${fn}: ${String((lastError as Error)?.message || lastError).slice(0, 120)}`);
  };

  const feeConst = await read<bigint>('FEE_BPS');
  check(feeConst === 300n, 'FEE_BPS() is the constant 300 (3%)', feeConst === undefined ? 'function missing: this is not the fixed-fee contract' : String(feeConst));
  const feeGetter = await read<bigint>('feeBps');
  check(feeGetter === 300n, 'feeBps() returns 300', String(feeGetter));
  check((await read<bigint>('FEE_DENOMINATOR')) === 10_000n, 'FEE_DENOMINATOR is 10000');
  check((await read<bigint>('AUTO_RELEASE_DURATION')) === 432_000n, 'review window is 5 days');

  const owner = await read<Address>('owner');
  const recipient = await read<Address>('feeRecipient');
  const arbiter = await read<Address>('arbitrator');
  console.log(`  owner=${owner} feeRecipient=${recipient} arbitrator=${arbiter}`);
  if (EXPECTED_ADMIN) check(owner?.toLowerCase() === EXPECTED_ADMIN, 'owner is the expected address (EXPECTED_OWNER)');
  check((await read<Address>('pendingOwner'))?.toLowerCase() === '0x0000000000000000000000000000000000000000', 'no pending ownership transfer');
  check((await read<boolean>('paused')) === false, 'contract is not paused');
  check((await read<boolean>('acceptedTokens', [USDC[chainId]])) === true, 'USDC is accepted');
  console.log(`  orderCount=${await read<bigint>('orderCount')}`);

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
