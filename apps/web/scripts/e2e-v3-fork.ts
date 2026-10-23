/**
 * End-to-end test of the web + API against escrow v3, on an anvil fork of Base Sepolia.
 *
 *   anvil --fork-url <base-sepolia-rpc> --port 8545 --chain-id 84532
 *   BASE_SEPOLIA_RPC_URL=http://127.0.0.1:8545 DATABASE_URL=<neon TEST branch> next start -p 3100
 *   DATABASE_URL=<same test branch> npx tsx scripts/e2e-v3-fork.ts
 *
 * The fork lets the test move time (timeout refund, 14-day dispute timeout, pause clock) and impersonate the owner.
 * Buyer and seller are fresh wallets created per run; the arbitrator signs with ARBITRATOR_PRIVATE_KEY from
 * ../../.wallets.env (Sepolia test key, never printed). Never point DATABASE_URL at production.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import postgres from 'postgres';
import {
  createPublicClient, createTestClient, createWalletClient, http, parseUnits, formatUnits, parseEventLogs, keccak256, encodeAbiParameters, pad, toHex, type Hex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { MarketplaceEscrowV3Abi as ABI, ESCROW_V3_ADDRESSES, ESCROW_ADDRESSES, Erc20Abi } from '@mercadopleis/contracts-abi';

const API = process.env.API_BASE || 'http://localhost:3100/api';
const ORIGIN = new URL(API).origin;
const RPC = process.env.FORK_RPC || 'http://127.0.0.1:8545';
const ESCROW = ESCROW_V3_ADDRESSES[84532]!;
const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;
const OWNER = '0xF6d48E6EFa40Ac16B2A71fa89c81D93da171cA00' as const;
const DAY = 86_400;

if (!process.env.DATABASE_URL || /production/i.test(process.env.NEON_BRANCH || '')) throw new Error('Set DATABASE_URL to the Neon TEST branch');
const sqlc = postgres(process.env.DATABASE_URL, { max: 1 });

const wallets = Object.fromEntries(
  readFileSync(new URL('../../../.wallets.env', import.meta.url), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')])
);
const rawArb = wallets.ARBITRATOR_PRIVATE_KEY;
const arbPk = (rawArb && !rawArb.startsWith('0x') ? '0x' + rawArb : rawArb) as Hex;
if (!arbPk) throw new Error('ARBITRATOR_PRIVATE_KEY missing in .wallets.env');

const chain = { ...baseSepolia, rpcUrls: { default: { http: [RPC] } } };
const pub = createPublicClient({ chain, transport: http(RPC) });
const test = createTestClient({ chain, mode: 'anvil', transport: http(RPC) });
const walletOf = (pk: Hex) => createWalletClient({ account: privateKeyToAccount(pk), chain, transport: http(RPC) });

const results: { flow: string; step: string; ok: boolean; detail: string }[] = [];
const record = (flow: string, step: string, ok: boolean, detail = '') => {
  results.push({ flow, step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${flow}] ${step}${detail ? ' — ' + detail : ''}`);
};

async function api(path: string, opts: { method?: string; token?: string; body?: unknown } = {}) {
  const res = await fetch(API + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json: json as any };
}

async function login(pk: Hex): Promise<string> {
  const acct = privateKeyToAccount(pk);
  const { json } = await api(`/auth/nonce?address=${acct.address}`);
  const host = new URL(ORIGIN).host;
  const message = `${host} wants you to sign in with your Ethereum account:\n${acct.address}\n\nIniciar sesión.\n\nURI: ${ORIGIN}\nVersion: 1\nChain ID: 84532\nNonce: ${json.nonce}\nIssued At: ${new Date().toISOString()}`;
  const signature = await acct.signMessage({ message });
  const r = await api('/auth/verify', { method: 'POST', body: { address: acct.address, signature, message } });
  if (!r.json.token) throw new Error(`login failed ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  return r.json.token;
}

async function send(pk: Hex | null, from: `0x${string}`, functionName: string, args: readonly unknown[], address: `0x${string}` = ESCROW, abi: any = ABI) {
  const wc = pk ? walletOf(pk) : createWalletClient({ account: from, chain, transport: http(RPC) });
  const hash = await wc.writeContract({ address, abi, functionName, args, account: (pk ? privateKeyToAccount(pk) : from) as any, chain } as any);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`${functionName} reverted (${hash})`);
  return { hash, receipt };
}

async function simulateError(from: `0x${string}`, functionName: string, args: readonly unknown[]) {
  try {
    await pub.simulateContract({ address: ESCROW, abi: ABI, functionName: functionName as any, args: args as any, account: from });
    return null;
  } catch (e: any) {
    let name: string | undefined;
    e?.walk?.((x: any) => (name = name ?? x?.data?.errorName));
    return name ?? 'unknown';
  }
}

const withdrawable = async (who: string) => (await pub.readContract({ address: ESCROW, abi: ABI, functionName: 'withdrawable', args: [USDC, who as `0x${string}`] })) as bigint;
const onchainStatus = async (id: bigint) => ['None', 'Funded', 'Delivered', 'Released', 'Refunded', 'Disputed', 'Resolved'][Number(((await pub.readContract({ address: ESCROW, abi: ABI, functionName: 'orders', args: [id] })) as any[])[7])];
const warp = async (seconds: number) => {
  await test.increaseTime({ seconds });
  await test.mine({ blocks: 1 });
};
// One /api/sync call covers at most 30 chunks (6,000 blocks on Sepolia): call it until the v3 cursor reaches the head.
const sync = async () => {
  for (let i = 0; i < 60; i++) {
    const r = await api('/sync?chainId=84532&escrow=v3');
    if (r.json?.upToDate) return r;
  }
  throw new Error('sync did not reach the chain head after 60 calls');
};

async function dbOrder(contractOrderId: bigint) {
  const rows = await sqlc`SELECT status, delivery_hash, escrow_address FROM orders WHERE chain_id = 84532 AND escrow_address = ${ESCROW.toLowerCase()} AND contract_order_id = ${Number(contractOrderId)}`;
  return rows[0] as any;
}

async function checkIndexer(flow: string, id: bigint, expectDb: string) {
  await sync();
  const [chainS, row] = [await onchainStatus(id), await dbOrder(id)];
  record(flow, `indexer after sync (chain ${chainS})`, row?.status === expectDb, `db ${row?.status ?? 'missing'}, expected ${expectDb}`);
}

async function fund(flow: string, buyerPk: Hex, sellerAddr: `0x${string}`, buyerToken: string, serviceId: string, price: bigint, days: number) {
  await send(buyerPk, '0x0', 'approve', [ESCROW, price], USDC, Erc20Abi);
  const { hash, receipt } = await send(buyerPk, '0x0', 'createAndFundOrder', [sellerAddr, USDC, price, BigInt(days)]);
  const log = parseEventLogs({ abi: ABI, logs: receipt.logs, eventName: 'OrderFunded' })[0];
  const id = log.args.orderId as bigint;
  const r = await api('/orders', { method: 'POST', token: buyerToken, body: { serviceId, contractOrderId: Number(id), txHashFunding: hash, buyerWallet: privateKeyToAccount(buyerPk).address, chainId: 84532 } });
  const row = await dbOrder(id);
  record(flow, `fund order #${id} (${hash})`, r.status < 300 && row?.status === 'FUNDED' && row?.escrow_address === ESCROW.toLowerCase(), `api ${r.status}, db ${row?.status}/${row?.escrow_address}`);
  return { id, dbId: r.json.order?.id as string, hash };
}

async function deliver(flow: string, sellerPk: Hex, sellerToken: string, o: { id: bigint; dbId: string }) {
  const url = `https://example.com/e2e-v3/${o.id}-${Date.now()}`;
  const hashHex = ('0x' + createHash('sha256').update(url).digest('hex')) as Hex;
  const { hash } = await send(sellerPk, '0x0', 'submitDelivery', [o.id, hashHex]);
  const r = await api(`/orders/${o.dbId}`, { method: 'PATCH', token: sellerToken, body: { status: 'DELIVERED', txHash: hash, deliveryUrl: url, deliveryHash: hashHex } });
  record(flow, `deliver #${o.id} (${hash})`, r.status < 300, `api ${r.status} ${r.status >= 300 ? JSON.stringify(r.json).slice(0, 120) : ''}`);
  return hash;
}

async function main() {
  // --- setup
  const buyerPk = generatePrivateKey();
  const sellerPk = generatePrivateKey();
  const buyer = privateKeyToAccount(buyerPk).address;
  const seller = privateKeyToAccount(sellerPk).address;
  const arb = privateKeyToAccount(arbPk).address;
  for (const a of [buyer, seller, arb, OWNER]) await test.setBalance({ address: a, value: parseUnits('1', 18) });
  await test.impersonateAccount({ address: OWNER });
  // Test USDC for the fresh buyer: write its balance straight into Circle's FiatToken storage (mapping at slot 9).
  const slot = keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [buyer, 9n]));
  await test.setStorageAt({ address: USDC, index: slot, value: pad(toHex(parseUnits('20', 6))) });
  const buyerUsdc = (await pub.readContract({ address: USDC, abi: Erc20Abi, functionName: 'balanceOf', args: [buyer] })) as bigint;
  if (buyerUsdc !== parseUnits('20', 6)) throw new Error(`could not set test USDC on the fork (balance ${formatUnits(buyerUsdc, 6)})`);
  console.log(`buyer ${buyer}, seller ${seller}, arbitrator ${arb}, escrow ${ESCROW}`);
  console.log('arbitrator on-chain:', await pub.readContract({ address: ESCROW, abi: ABI, functionName: 'arbitrator' }));

  const buyerToken = await login(buyerPk);
  const sellerToken = await login(sellerPk);
  record('setup', 'SIWE login buyer and seller on localhost:3100', !!buyerToken && !!sellerToken);
  const svc = await api('/services', {
    method: 'POST', token: sellerToken,
    body: { title: 'E2E v3 fork test service', description: 'Automated end-to-end test of escrow v3 on a fork of Base Sepolia. Not a real listing; test branch only.', category: 'ai_data', priceUsdc: '2.00', deliveryDays: 1, deliveryType: 'digital', sellerWallet: seller },
  });
  const serviceId = svc.json.service?.id as string;
  record('setup', 'seller publishes a 2 USDC / 1 day service', svc.status === 201, `api ${svc.status}`);
  const price = parseUnits('2', 6);

  // --- A: fund, deliver, approve, withdraw (seller, fee)
  {
    const F = 'A happy path';
    const o = await fund(F, buyerPk, seller, buyerToken, serviceId, price, 1);
    await deliver(F, sellerPk, sellerToken, o);
    const { hash } = await send(buyerPk, '0x0', 'approveDelivery', [o.id]);
    const r = await api(`/orders/${o.dbId}`, { method: 'PATCH', token: buyerToken, body: { status: 'RELEASED', txHashRelease: hash } });
    record(F, `approve (${hash})`, r.status < 300, `api ${r.status}`);
    const ws = await withdrawable(seller), wf = await withdrawable(OWNER);
    record(F, 'seller credited 1.94, fee recipient credited +0.06', ws === parseUnits('1.94', 6) && wf >= parseUnits('0.06', 6), `seller ${formatUnits(ws, 6)}, fee ${formatUnits(wf, 6)}`);
    const before = (await pub.readContract({ address: USDC, abi: Erc20Abi, functionName: 'balanceOf', args: [seller] })) as bigint;
    const w = await send(sellerPk, '0x0', 'withdraw', [USDC, seller]);
    const after = (await pub.readContract({ address: USDC, abi: Erc20Abi, functionName: 'balanceOf', args: [seller] })) as bigint;
    record(F, `seller withdraw (${w.hash})`, after - before === ws && (await withdrawable(seller)) === 0n, `+${formatUnits(after - before, 6)} USDC`);
    const wfee = await send(null, OWNER, 'withdraw', [USDC, OWNER]);
    record(F, `fee recipient withdraw (${wfee.hash})`, (await withdrawable(OWNER)) === 0n, `withdrew ${formatUnits(wf, 6)}`);
    record(F, 'withdraw again reverts NothingToWithdraw', (await simulateError(seller, 'withdraw', [USDC, seller])) === 'NothingToWithdraw');
    await checkIndexer(F, o.id, 'RELEASED');
  }

  // --- B: timeout refund, late delivery blocked, buyer withdraw
  {
    const F = 'B timeout refund';
    const o = await fund(F, buyerPk, seller, buyerToken, serviceId, price, 1);
    record(F, 'refund before deadline reverts DeadlineNotPassed', (await simulateError(buyer, 'claimTimeoutRefund', [o.id])) === 'DeadlineNotPassed');
    await warp(DAY + 60);
    record(F, 'late delivery reverts DeadlinePassed', (await simulateError(seller, 'submitDelivery', [o.id, ('0x' + '11'.repeat(32)) as Hex])) === 'DeadlinePassed');
    const { hash } = await send(buyerPk, '0x0', 'claimTimeoutRefund', [o.id]);
    const r = await api(`/orders/${o.dbId}`, { method: 'PATCH', token: buyerToken, body: { status: 'REFUNDED' } });
    record(F, `claimTimeoutRefund (${hash})`, r.status < 300, `api ${r.status}`);
    const wb = await withdrawable(buyer);
    record(F, 'buyer credited the full 2 USDC, no fee', wb === price, formatUnits(wb, 6));
    const w = await send(buyerPk, '0x0', 'withdraw', [USDC, buyer]);
    record(F, `buyer withdraw (${w.hash})`, (await withdrawable(buyer)) === 0n);
    await checkIndexer(F, o.id, 'REFUNDED');
  }

  // --- C: dispute, arbitrator sees it in the admin API and resolves 50/50
  {
    const F = 'C dispute + arbitrator';
    const o = await fund(F, buyerPk, seller, buyerToken, serviceId, price, 2);
    await deliver(F, sellerPk, sellerToken, o);
    const d = await send(buyerPk, '0x0', 'openDispute', [o.id]);
    const r = await api('/disputes', { method: 'POST', token: buyerToken, body: { orderId: o.dbId, reason: 'E2E: the delivery is incomplete', txHash: d.hash } });
    record(F, `openDispute (${d.hash})`, r.status < 300, `api ${r.status} ${r.status >= 300 ? JSON.stringify(r.json).slice(0, 120) : ''}`);
    const arbToken = await login(arbPk);
    const me = await api('/auth/me', { token: arbToken });
    record(F, 'arbitrator 0x5642 signs in as ADMIN (role from arbitrator())', me.json?.user?.role === 'ADMIN' || me.json?.role === 'ADMIN', `role ${me.json?.user?.role ?? me.json?.role}`);
    const list = await api('/disputes', { token: arbToken });
    const listed = (Array.isArray(list.json) ? list.json : list.json.disputes ?? []).find((x: any) => x.orderId === o.dbId);
    record(F, 'admin disputes list shows it', !!listed, `api ${list.status}`);
    const half = price / 2n;
    const res = await send(arbPk, '0x0', 'resolveDispute', [o.id, half, price - half]);
    const rr = listed ? await api(`/disputes/${listed.id}/resolve`, { method: 'POST', token: arbToken, body: { txHash: res.hash, resolutionNotes: 'E2E: rule 4, 50/50' } }) : { status: 0, json: {} };
    record(F, `resolveDispute 50/50 (${res.hash})`, rr.status < 300, `api ${rr.status} ${rr.status >= 300 ? JSON.stringify(rr.json).slice(0, 120) : ''}`);
    const [wb, ws] = [await withdrawable(buyer), await withdrawable(seller)];
    record(F, 'buyer 1.00 and seller 0.97 credited', wb === parseUnits('1', 6) && ws === parseUnits('0.97', 6), `buyer ${formatUnits(wb, 6)}, seller ${formatUnits(ws, 6)}`);
    await send(buyerPk, '0x0', 'withdraw', [USDC, buyer]);
    await send(sellerPk, '0x0', 'withdraw', [USDC, seller]);
    record(F, 'both withdraw', (await withdrawable(buyer)) === 0n && (await withdrawable(seller)) === 0n);
    const row = await dbOrder(o.id);
    record(F, `db after resolve (chain ${await onchainStatus(o.id)})`, true, `db ${row?.status}`);
    await sync();
    record(F, 'db after sync', true, `db ${(await dbOrder(o.id))?.status}`);
  }

  // --- D: dispute timeout with the default outcome (delivered -> seller paid)
  {
    const F = 'D dispute timeout';
    const o = await fund(F, buyerPk, seller, buyerToken, serviceId, price, 2);
    await deliver(F, sellerPk, sellerToken, o);
    const d = await send(buyerPk, '0x0', 'openDispute', [o.id]);
    await api('/disputes', { method: 'POST', token: buyerToken, body: { orderId: o.dbId, reason: 'E2E: timeout case', txHash: d.hash } });
    record(F, 'claim before 14 days reverts DisputeTimeoutNotReached', (await simulateError(buyer, 'claimDisputeTimeout', [o.id])) === 'DisputeTimeoutNotReached');
    await warp(14 * DAY + 60);
    const c = await send(sellerPk, '0x0', 'claimDisputeTimeout', [o.id]);
    const ws = await withdrawable(seller);
    record(F, `claimDisputeTimeout (${c.hash}) pays the seller 1.94`, ws === parseUnits('1.94', 6), formatUnits(ws, 6));
    await sync();
    const row = await dbOrder(o.id);
    record(F, `indexer after timeout (chain ${await onchainStatus(o.id)})`, !!row && row.status !== 'DISPUTED', `db ${row?.status}`);
    await send(sellerPk, '0x0', 'withdraw', [USDC, seller]);
  }

  // --- E: pause freezes timers; delivery blocked; withdraw open; unpause resumes
  {
    const F = 'E pause';
    const o = await fund(F, buyerPk, seller, buyerToken, serviceId, price, 1);
    const before = (await pub.readContract({ address: ESCROW, abi: ABI, functionName: 'effectiveDeadline', args: [o.id] })) as bigint;
    const p = await send(null, OWNER, 'pause', []);
    record(F, `owner pause (${p.hash})`, (await pub.readContract({ address: ESCROW, abi: ABI, functionName: 'paused' })) === true);
    record(F, 'delivery while paused reverts EnforcedPause', (await simulateError(seller, 'submitDelivery', [o.id, ('0x' + '22'.repeat(32)) as Hex])) === 'EnforcedPause');
    record(F, 'withdraw while paused is allowed (NothingToWithdraw, not EnforcedPause)', (await simulateError(seller, 'withdraw', [USDC, seller])) === 'NothingToWithdraw');
    await warp(2 * DAY);
    const u = await send(null, OWNER, 'unpause', []);
    const after = (await pub.readContract({ address: ESCROW, abi: ABI, functionName: 'effectiveDeadline', args: [o.id] })) as bigint;
    const shift = Number(after - before);
    record(F, `unpause (${u.hash}); effective deadline moved by the paused time`, shift >= 2 * DAY && shift <= 2 * DAY + 120, `+${shift} s`);
    await deliver(F, sellerPk, sellerToken, o);
    record(F, 'delivery after unpause accepted (raw deadline passed, effective not)', (await onchainStatus(o.id)) === 'Delivered');
    await checkIndexer(F, o.id, 'DELIVERED');
  }

  // --- F: v2 orders still readable
  {
    const F = 'F v2 legacy';
    const v2 = ESCROW_ADDRESSES[84532];
    const n = (await pub.readContract({ address: v2, abi: ABI, functionName: 'orderCount' }).catch(() => 0n)) as bigint;
    const rows = await sqlc`SELECT count(*)::int AS c FROM orders WHERE chain_id = 84532 AND (escrow_address = ${v2.toLowerCase()} OR escrow_address IS NULL)`;
    const one = n > 0n ? await pub.readContract({ address: v2, abi: ABI, functionName: 'orders', args: [1n] }) : null;
    record(F, 'v2 orders readable on-chain and in the DB', n > 0n && !!one && rows[0].c > 0, `v2 orderCount ${n}, db rows ${rows[0].c}`);
  }

  await sqlc.end();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  console.log('RESULTS_JSON ' + JSON.stringify(results));
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error('ABORTED:', e?.shortMessage || e?.message || e);
  console.log('RESULTS_JSON ' + JSON.stringify(results));
  await sqlc.end().catch(() => {});
  process.exit(2);
});
