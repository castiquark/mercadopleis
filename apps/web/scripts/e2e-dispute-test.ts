/**
 * End-to-end dispute flow on Base Sepolia against a running API (default http://localhost:3000/api).
 * Fund -> deliver -> buyer opens dispute -> arbitrator resolves 60/40 -> API records match on-chain.
 *
 *   API_BASE=http://localhost:3100/api pnpm tsx scripts/e2e-dispute-test.ts
 *
 * Requires DEPLOYER_PRIVATE_KEY to be the escrow arbitrator on Base Sepolia (it is also the admin wallet).
 * Point the API at a throwaway database (e.g. a Neon branch), never production.
 */
import { createPublicClient, createWalletClient, defineChain, http, parseAbiItem, parseEther } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { MarketplaceEscrowAbi, ESCROW_ADDRESSES } from '@mercadopleis/contracts-abi';
import { Attribution } from 'ox/erc8021';
import { CONTRACT_CONFIG } from '@mercadopleis/types';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://sepolia.base.org'] } },
});

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
const ESCROW = ESCROW_ADDRESSES[84532]; // registry address for Base Sepolia
const USDC = CONTRACT_CONFIG.USDC_BASE_SEPOLIA; // mintable test USDC accepted by the Sepolia escrow
const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
const SUFFIX = Attribution.toDataSuffix({ codes: ['bc_dmphihka'] });

const usdcAbi = [
  parseAbiItem('function mint(address to, uint256 amount) external'),
  parseAbiItem('function approve(address spender, uint256 amount) external returns (bool)'),
  parseAbiItem('function balanceOf(address account) external view returns (uint256)'),
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const check = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
};

const pub = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
const wallet = (account: ReturnType<typeof privateKeyToAccount>) =>
  createWalletClient({ account, chain: baseSepolia, transport: http(RPC_URL) });

async function siwe(account: ReturnType<typeof privateKeyToAccount>): Promise<string> {
  const { nonce } = await (await fetch(`${API_BASE}/auth/nonce?address=${account.address}`)).json();
  const u = new URL(API_BASE);
  const message = `${u.host} wants you to sign in with your Ethereum account:\n${account.address}\n\nIniciar sesión en mercadopleis con tu wallet criptográfica.\n\nURI: ${u.origin}\nVersion: 1\nChain ID: 84532\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;
  const signature = await account.signMessage({ message });
  const res = await fetch(`${API_BASE}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: account.address, signature, message }),
  });
  if (!res.ok) throw new Error(`SIWE failed for ${account.address}: ${await res.text()}`);
  const data = await res.json();
  return data.token;
}

const api = async (method: string, route: string, token: string, body?: unknown) => {
  const res = await fetch(`${API_BASE}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json } as { status: number; json: any };
};

async function main() {
  console.log(`Dispute E2E on Base Sepolia | API: ${API_BASE}`);
  const deployer = privateKeyToAccount(DEPLOYER_KEY);
  const seller = privateKeyToAccount(generatePrivateKey());
  const buyer = privateKeyToAccount(generatePrivateKey());
  const dep = wallet(deployer), sel = wallet(seller), buy = wallet(buyer);

  const arbitrator = (await pub.readContract({ address: ESCROW, abi: MarketplaceEscrowAbi, functionName: 'arbitrator' })) as string;
  check(arbitrator.toLowerCase() === deployer.address.toLowerCase(), 'deployer wallet is the escrow arbitrator on Sepolia');

  console.log('\n-- Setup: gas + test USDC --');
  for (const [to, v] of [[seller.address, process.env.E2E_SELLER_ETH || '0.00001'], [buyer.address, process.env.E2E_BUYER_ETH || '0.00002']] as const) {
    const h = await dep.sendTransaction({ to, value: parseEther(v) });
    await pub.waitForTransactionReceipt({ hash: h });
  }
  const mint = await dep.writeContract({ address: USDC, abi: usdcAbi, functionName: 'mint', args: [buyer.address, 100_000000n] });
  await pub.waitForTransactionReceipt({ hash: mint });
  await sleep(3000);

  const [sellerToken, buyerToken, adminToken] = [await siwe(seller), await siwe(buyer), await siwe(deployer)];
  check(sellerToken && buyerToken && adminToken, 'seller, buyer and admin authenticated via SIWE');

  const svc = await api('POST', '/services', sellerToken, {
    title: 'Dispute flow test service',
    slug: `dispute-e2e-${Date.now()}`,
    description: 'Temporary service created by the dispute e2e test.',
    category: 'development',
    priceUsdc: 50,
    deliveryDays: 3,
  });
  check(svc.status < 300, 'seller published a service');
  const service = svc.json.service || svc.json;

  console.log('\n-- Fund and deliver --');
  const amount = 50_000000n;
  const ap = await buy.writeContract({ address: USDC, abi: usdcAbi, functionName: 'approve', args: [ESCROW, amount] });
  await pub.waitForTransactionReceipt({ hash: ap });
  await sleep(3500);
  const fundTx = await buy.writeContract({
    address: ESCROW, abi: MarketplaceEscrowAbi, functionName: 'createAndFundOrder',
    args: [seller.address, USDC, amount, 3n], dataSuffix: SUFFIX,
  });
  const fundRc = await pub.waitForTransactionReceipt({ hash: fundTx });
  const orderId = Number(BigInt(fundRc.logs.find((l) => l.address.toLowerCase() === ESCROW.toLowerCase())!.topics[1]!));
  const created = await api('POST', '/orders', buyerToken, { serviceId: service.id, contractOrderId: orderId, txHashFunding: fundTx, chainId: 84532 });
  check(created.status < 300, `order #${orderId} registered in the API (FUNDED)`);
  const dbOrder = created.json.order || created.json;

  const hash = ('0x' + 'cd'.repeat(32)) as `0x${string}`;
  const delTx = await sel.writeContract({ address: ESCROW, abi: MarketplaceEscrowAbi, functionName: 'submitDelivery', args: [BigInt(orderId), hash] });
  await pub.waitForTransactionReceipt({ hash: delTx });
  await sleep(3500);
  const delivered = await api('PATCH', `/orders/${dbOrder.id}`, sellerToken, { status: 'DELIVERED', txHash: delTx, deliverableHash: hash, deliverableUrl: 'https://example.com/file' });
  check(delivered.status === 200 && delivered.json.order.status === 'DELIVERED', 'API order is DELIVERED with on-chain proof');

  console.log('\n-- Negative checks --');
  const forged = await api('PATCH', `/orders/${dbOrder.id}`, buyerToken, { status: 'RELEASED', txHashRelease: '0x' + 'ab'.repeat(32) });
  check(forged.status === 400, 'forged RELEASED with a fake tx hash is rejected (400)');
  const noProofDispute = await api('POST', '/disputes', buyerToken, { orderId: dbOrder.id, reason: 'no proof' });
  check(noProofDispute.status === 400, 'dispute without on-chain tx hash is rejected (400)');

  console.log('\n-- Dispute --');
  const dispTx = await buy.writeContract({ address: ESCROW, abi: MarketplaceEscrowAbi, functionName: 'openDispute', args: [BigInt(orderId)], dataSuffix: SUFFIX });
  await pub.waitForTransactionReceipt({ hash: dispTx });
  await sleep(3500);
  const disp = await api('POST', '/disputes', buyerToken, { orderId: dbOrder.id, reason: 'Entregable incompleto (test)', txHash: dispTx });
  check(disp.status < 300, 'dispute registered in the API with on-chain proof');
  const dispute = disp.json.dispute || disp.json;

  const notAdmin = await api('POST', `/disputes/${dispute.id}/resolve`, buyerToken, { txHash: dispTx });
  check(notAdmin.status === 403 || notAdmin.status === 404, `non-admin cannot resolve (got ${notAdmin.status})`);

  console.log('\n-- Arbitration 60/40 --');
  const sellerShare = 30_000000n, buyerShare = 20_000000n;
  const buyerBefore = (await pub.readContract({ address: USDC, abi: usdcAbi, functionName: 'balanceOf', args: [buyer.address] })) as bigint;
  const sellerBefore = (await pub.readContract({ address: USDC, abi: usdcAbi, functionName: 'balanceOf', args: [seller.address] })) as bigint;
  const resTx = await dep.writeContract({ address: ESCROW, abi: MarketplaceEscrowAbi, functionName: 'resolveDispute', args: [BigInt(orderId), sellerShare, buyerShare], dataSuffix: SUFFIX });
  await pub.waitForTransactionReceipt({ hash: resTx });
  await sleep(3500);
  const resolved = await api('POST', `/disputes/${dispute.id}/resolve`, adminToken, { txHash: resTx, resolutionNotes: 'Reparto 60/40 (test)', sellerAwardUsdc: 30, buyerRefundUsdc: 20 });
  check(resolved.status < 300, 'admin resolution accepted with on-chain proof');

  const buyerAfter = (await pub.readContract({ address: USDC, abi: usdcAbi, functionName: 'balanceOf', args: [buyer.address] })) as bigint;
  const sellerAfter = (await pub.readContract({ address: USDC, abi: usdcAbi, functionName: 'balanceOf', args: [seller.address] })) as bigint;
  check(buyerAfter - buyerBefore === 20_000000n, 'buyer refunded 20.00 USDC on-chain');
  check(sellerAfter - sellerBefore === 29_100000n, 'seller received 29.10 USDC on-chain (30.00 minus 3% fee)');

  const final = await api('GET', `/orders/${dbOrder.id}`, buyerToken);
  console.log(`  order status in API: ${final.json.order?.status}`);
  check(['RESOLVED', 'RELEASED', 'REFUNDED'].includes(final.json.order?.status), 'API order reached a final status');

  console.log('\n🎉 DISPUTE E2E PASSED');
}

main().catch((e) => {
  console.error('\n❌ DISPUTE E2E FAILED:', e);
  process.exit(1);
});
