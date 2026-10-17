// On-chain lifecycle check of a MarketplaceEscrow deployment on any EVM test network (no web API involved).
//
//   start:  creates throwaway buyer and seller wallets, tops them up with gas from the deployer, mints test
//           tokens and runs: fund -> deliver -> approve (97/3 split), fund -> deliver -> dispute -> resolve,
//           plus negative checks. It also opens two timed orders and saves them to the state file.
//   finish: run after the timers expire (1 day for the timeout refund, 5 days for auto-release).
//
//   RPC_URL=https://rpc.bohr.life ESCROW=0x... TOKEN=0x... DEPLOYER_PRIVATE_KEY=0x... \
//     pnpm --filter @mercadopleis/mcp-server exec tsx scripts/testnet-lifecycle.ts start
//   ... same env ... tsx scripts/testnet-lifecycle.ts finish
//
// TOKEN must be a mintable test token (MockStablecoin). DEPLOYER_PRIVATE_KEY must be the escrow's arbitrator.
// On a local fork (RPC_URL on 127.0.0.1) `finish` fast-forwards time instead of waiting.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatUnits,
  http,
  keccak256,
  parseEther,
  parseEventLogs,
  parseUnits,
  toHex,
  type Hex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { MarketplaceEscrowAbi } from '../../contracts-abi/src/MarketplaceEscrowAbi';

const mode = process.argv[2];
if (mode !== 'start' && mode !== 'finish') throw new Error('Usage: testnet-lifecycle.ts start|finish');

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};
const RPC_URL = env('RPC_URL');
const ESCROW = env('ESCROW') as Hex;
const TOKEN = env('TOKEN') as Hex;
const DEPLOYER = privateKeyToAccount(env('DEPLOYER_PRIVATE_KEY') as Hex);
const GAS_TOPUP = parseEther(process.env.GAS_TOPUP || '0.02');
const isLocal = /127\.0\.0\.1|localhost/.test(RPC_URL);

const probe = createPublicClient({ transport: http(RPC_URL) });
const chainId = await probe.getChainId();
const chain = defineChain({
  id: chainId,
  name: `chain-${chainId}`,
  nativeCurrency: { name: 'native', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});
const pub = createPublicClient({ chain, transport: http(RPC_URL) });
const STATE_FILE = process.env.STATE_FILE || `testnet-lifecycle-${chainId}.json`;

const tokenAbi = [
  { type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 's', type: 'address' }, { name: 'a', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
] as const;

const decimals = await pub.readContract({ address: TOKEN, abi: tokenAbi, functionName: 'decimals' });
const symbol = await pub.readContract({ address: TOKEN, abi: tokenAbi, functionName: 'symbol' });
const units = (v: string) => parseUnits(v, decimals);
const fmt = (v: bigint) => `${formatUnits(v, decimals)} ${symbol}`;
const balance = (a: Hex) => pub.readContract({ address: TOKEN, abi: tokenAbi, functionName: 'balanceOf', args: [a] });

type Key = Hex;
const wallet = (key: Key) => createWalletClient({ account: privateKeyToAccount(key), chain, transport: http(RPC_URL) });

async function send(key: Key, address: Hex, abi: any, functionName: string, args: unknown[]) {
  const hash = await wallet(key).writeContract({ address, abi, functionName, args } as any);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, 'success', `${functionName} reverted (${hash})`);
  return receipt;
}

async function expectRevert(key: Key, address: Hex, abi: any, functionName: string, args: unknown[], label: string) {
  try {
    await pub.simulateContract({ account: privateKeyToAccount(key), address, abi, functionName, args } as any);
  } catch {
    console.log(`  ok   rejected: ${label}`);
    return;
  }
  throw new Error(`expected a revert: ${label}`);
}

async function fund(buyer: Key, seller: Hex, amount: bigint, days: number) {
  await send(buyer, TOKEN, tokenAbi, 'approve', [ESCROW, amount]);
  const receipt = await send(buyer, ESCROW, MarketplaceEscrowAbi, 'createAndFundOrder', [seller, TOKEN, amount, BigInt(days)]);
  const [ev] = parseEventLogs({ abi: MarketplaceEscrowAbi, logs: receipt.logs, eventName: 'OrderFunded' }) as any[];
  return ev.args.orderId as bigint;
}

const status = async (id: bigint) => {
  const o = (await pub.readContract({ address: ESCROW, abi: MarketplaceEscrowAbi, functionName: 'orders', args: [id] })) as any[];
  return { status: Number(o[7]), deadline: o[4] as bigint, autoRelease: o[5] as bigint };
};

const deployerKeyHex = env('DEPLOYER_PRIVATE_KEY') as Key;
const feeRecipient = (await pub.readContract({ address: ESCROW, abi: MarketplaceEscrowAbi, functionName: 'feeRecipient' })) as Hex;
const arbitrator = (await pub.readContract({ address: ESCROW, abi: MarketplaceEscrowAbi, functionName: 'arbitrator' })) as Hex;
assert.equal(arbitrator.toLowerCase(), DEPLOYER.address.toLowerCase(), 'DEPLOYER_PRIVATE_KEY must be the arbitrator');
console.log(`chain ${chainId} | escrow ${ESCROW} | token ${symbol} ${TOKEN} | mode ${mode}`);

if (mode === 'start') {
  const buyerKey = generatePrivateKey();
  const sellerKey = generatePrivateKey();
  const buyer = privateKeyToAccount(buyerKey).address;
  const seller = privateKeyToAccount(sellerKey).address;
  const deployerWallet = createWalletClient({ account: DEPLOYER, chain, transport: http(RPC_URL) });
  for (const to of [buyer, seller]) {
    await pub.waitForTransactionReceipt({ hash: await deployerWallet.sendTransaction({ to, value: GAS_TOPUP }) });
  }
  await send(deployerKeyHex, TOKEN, tokenAbi, 'mint', [buyer, units('100')]);
  console.log(`buyer ${buyer} | seller ${seller}`);

  // 1. Happy path: fund -> deliver -> approve. Seller receives 97%, fee recipient 3%.
  const a = await fund(buyerKey, seller, units('10'), 3);
  await expectRevert(buyerKey, ESCROW, MarketplaceEscrowAbi, 'approveDelivery', [a], 'approve before delivery');
  await expectRevert(deployerKeyHex, ESCROW, MarketplaceEscrowAbi, 'submitDelivery', [a, keccak256(toHex('x'))], 'delivery by a non-seller');
  await send(sellerKey, ESCROW, MarketplaceEscrowAbi, 'submitDelivery', [a, keccak256(toHex('deliverable A'))]);
  await expectRevert(sellerKey, ESCROW, MarketplaceEscrowAbi, 'claimAutoRelease', [a], 'auto-release before the review window');
  const [sellerBefore, feeBefore] = [await balance(seller), await balance(feeRecipient)];
  await send(buyerKey, ESCROW, MarketplaceEscrowAbi, 'approveDelivery', [a]);
  assert.equal((await balance(seller)) - sellerBefore, units('9.7'));
  assert.equal((await balance(feeRecipient)) - feeBefore, units('0.3'));
  console.log(`  ok   order ${a}: approved, seller +${fmt(units('9.7'))}, fee +${fmt(units('0.3'))}`);

  // 2. Dispute: fund -> deliver -> dispute -> arbitrator splits 6/4 (fee only on the seller part).
  const b = await fund(buyerKey, seller, units('10'), 3);
  await send(sellerKey, ESCROW, MarketplaceEscrowAbi, 'submitDelivery', [b, keccak256(toHex('deliverable B'))]);
  await send(buyerKey, ESCROW, MarketplaceEscrowAbi, 'openDispute', [b]);
  await expectRevert(buyerKey, ESCROW, MarketplaceEscrowAbi, 'resolveDispute', [b, units('6'), units('4')], 'resolution by a non-arbitrator');
  await expectRevert(deployerKeyHex, ESCROW, MarketplaceEscrowAbi, 'resolveDispute', [b, units('6'), units('5')], 'resolution that does not add up');
  const [s2, b2, f2] = [await balance(seller), await balance(buyer), await balance(feeRecipient)];
  await send(deployerKeyHex, ESCROW, MarketplaceEscrowAbi, 'resolveDispute', [b, units('6'), units('4')]);
  assert.equal((await balance(seller)) - s2, units('5.82'));
  assert.equal((await balance(buyer)) - b2, units('4'));
  assert.equal((await balance(feeRecipient)) - f2, units('0.18'));
  console.log(`  ok   order ${b}: dispute resolved 6/4, seller +${fmt(units('5.82'))}, buyer +${fmt(units('4'))}, fee +${fmt(units('0.18'))}`);

  // 3. Timed orders, finished later: refund after the delivery deadline, auto-release after the review window.
  const c = await fund(buyerKey, seller, units('5'), 1);
  await expectRevert(buyerKey, ESCROW, MarketplaceEscrowAbi, 'claimTimeoutRefund', [c], 'refund before the deadline');
  const d = await fund(buyerKey, seller, units('5'), 1);
  await send(sellerKey, ESCROW, MarketplaceEscrowAbi, 'submitDelivery', [d, keccak256(toHex('deliverable D'))]);
  const [sc, sd] = [await status(c), await status(d)];
  writeFileSync(
    STATE_FILE,
    JSON.stringify(
      { chainId, escrow: ESCROW, token: TOKEN, buyerKey, sellerKey, refundOrder: c.toString(), autoReleaseOrder: d.toString(), refundAfter: Number(sc.deadline), releaseAfter: Number(sd.autoRelease) },
      null,
      2
    )
  );
  console.log(`  ..   order ${c}: refundable after ${new Date(Number(sc.deadline) * 1000).toISOString()}`);
  console.log(`  ..   order ${d}: auto-release after ${new Date(Number(sd.autoRelease) * 1000).toISOString()}`);
  console.log(`start OK. Throwaway keys saved in ${STATE_FILE} (test wallets only). Run "finish" after the timers.`);
} else {
  if (!existsSync(STATE_FILE)) throw new Error(`No ${STATE_FILE}; run "start" first`);
  const st = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  const buyer = privateKeyToAccount(st.buyerKey).address;
  const seller = privateKeyToAccount(st.sellerKey).address;
  if (isLocal) {
    await pub.request({ method: 'evm_increaseTime' as any, params: [6 * 24 * 3600] as any });
    await pub.request({ method: 'evm_mine' as any, params: [] as any });
    console.log('  (local fork: advanced time by 6 days)');
  }
  const now = Number((await pub.getBlock()).timestamp);

  const c = BigInt(st.refundOrder);
  if ((await status(c)).status === 1 && now > st.refundAfter) {
    const before = await balance(buyer);
    await send(st.buyerKey, ESCROW, MarketplaceEscrowAbi, 'claimTimeoutRefund', [c]);
    assert.equal((await balance(buyer)) - before, units('5'));
    console.log(`  ok   order ${c}: full refund to the buyer after the deadline (+${fmt(units('5'))}, no fee)`);
  } else {
    console.log(`  ..   order ${c}: status ${(await status(c)).status}, refundable after ${new Date(st.refundAfter * 1000).toISOString()}`);
  }

  const d = BigInt(st.autoReleaseOrder);
  if ((await status(d)).status === 2 && now >= st.releaseAfter) {
    const [before, feeBefore] = [await balance(seller), await balance(feeRecipient)];
    await send(st.sellerKey, ESCROW, MarketplaceEscrowAbi, 'claimAutoRelease', [d]);
    assert.equal((await balance(seller)) - before, units('4.85'));
    assert.equal((await balance(feeRecipient)) - feeBefore, units('0.15'));
    console.log(`  ok   order ${d}: auto-released to the seller after the review window (+${fmt(units('4.85'))})`);
  } else {
    console.log(`  ..   order ${d}: status ${(await status(d)).status}, releasable after ${new Date(st.releaseAfter * 1000).toISOString()}`);
  }
}
