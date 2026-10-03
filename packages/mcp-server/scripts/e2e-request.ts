/**
 * End-to-end test of the request (bounty) flow on Base Sepolia. The buyer agent acts only through this MCP server:
 * post_request, list_proposals, accept_proposal, create_order on the accepted terms, register_order, send_message,
 * get_deliverable and prepare_order_action. The seller answers and delivers through the web API. Also checks that
 * the accepted (unlisted) service never shows in the catalog and that proposal prices are private.
 *
 *   API_URL=http://localhost:3100 pnpm --filter @mercadopleis/mcp-server exec tsx scripts/e2e-request.ts
 *
 * Needs a local web server pointed at a test database (never production) and DEPLOYER_PRIVATE_KEY in
 * apps/web/.env.local to pay test gas. Spends a few cents of Sepolia test ETH.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createPublicClient, createWalletClient, http, parseAbi, parseEther, parseEventLogs, type Hex } from 'viem';
import { baseSepolia } from 'viem/chains';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';

const env = Object.fromEntries(
  readFileSync(resolve(import.meta.dirname, '../../../apps/web/.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')])
);
const API_URL = process.env.API_URL || 'http://localhost:3100';
assert.ok(/localhost|127\.0\.0\.1/.test(API_URL), 'Run this against a local test server only');
const RPC = env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
const USDC = '0x6Fa1279f6c760fA993B7f9aC75de5a141d7D2D8A' as const;
const ESCROW = '0x41880C194F31b1D9AbAC53513De176f2892315EA' as const;
const escrowAbi = parseAbi([
  'event OrderFunded(uint256 indexed orderId, address indexed buyer, address indexed seller, address token, uint256 amount, uint256 deadline)',
  'function submitDelivery(uint256 orderId, bytes32 deliveryHash)',
  'function orders(uint256) view returns (address,address,address,uint256,uint256,uint256,bytes32,uint8)',
]);
const usdcAbi = parseAbi(['function mint(address to, uint256 amount)', 'function balanceOf(address) view returns (uint256)']);

const pub = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
const wallet = (account: PrivateKeyAccount) => createWalletClient({ account, chain: baseSepolia, transport: http(RPC) });
const step = (s: string) => console.log(`\n— ${s}`);

// Load-balanced RPCs can lag behind a receipt: confirm state before the next step.
async function until(label: string, check: () => Promise<boolean>) {
  for (let i = 0; i < 30; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Timed out waiting for ${label}`);
}
async function mined(hash: Hex, label: string) {
  const receipt = await pub.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, 'success', `${label} reverted`);
  console.log(`  ✓ ${label}: https://sepolia.basescan.org/tx/${hash}`);
  return receipt;
}
const orderStatus = async (id: bigint) => Number(((await pub.readContract({ address: ESCROW, abi: escrowAbi, functionName: 'orders', args: [id] })) as readonly unknown[])[7]);

async function siwe(account: PrivateKeyAccount) {
  const { nonce } = await (await fetch(`${API_URL}/api/auth/nonce?address=${account.address}`)).json();
  const u = new URL(API_URL);
  const message = `${u.host} wants you to sign in with your Ethereum account:\n${account.address}\n\nSeller test sign-in.\n\nURI: ${u.origin}\nVersion: 1\nChain ID: 84532\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;
  const res = await fetch(`${API_URL}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: account.address, message, signature: await account.signMessage({ message }) }),
  });
  if (!res.ok) throw new Error(`seller sign-in failed: ${await res.text()}`);
  return (await res.json()).token as string;
}

async function main() {
  const funder = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY as Hex);
  const seller = privateKeyToAccount(generatePrivateKey());
  const buyer = privateKeyToAccount(generatePrivateKey());
  console.log(`seller ${seller.address}\nbuyer  ${buyer.address} (acts only through MCP)`);

  step('Gas for both wallets and test USDC for the buyer');
  for (const [who, eth] of [[seller, '0.00002'], [buyer, '0.00003']] as const) {
    await mined(await wallet(funder).sendTransaction({ to: who.address, value: parseEther(eth) }), `gas to ${who === seller ? 'seller' : 'buyer'}`);
    await until('gas', async () => (await pub.getBalance({ address: who.address })) > 0n);
  }
  await mined(await wallet(funder).writeContract({ address: USDC, abi: usdcAbi, functionName: 'mint', args: [buyer.address, 5_000_000n] }), 'mint 5 USDC to buyer');
  await until('buyer USDC', async () => (await pub.readContract({ address: USDC, abi: usdcAbi, functionName: 'balanceOf', args: [buyer.address] })) >= 5_000_000n);

  step('Start the MCP server (built dist) as the buyer agent would');
  const mcp = new Client({ name: 'e2e-agent', version: '0' });
  await mcp.connect(
    new StdioClientTransport({
      command: 'node',
      args: [resolve(import.meta.dirname, '../dist/index.js')],
      env: { ...process.env, MERCADOPLEIS_API_URL: API_URL, MERCADOPLEIS_CHAIN_ID: '84532', BASE_SEPOLIA_RPC_URL: RPC } as Record<string, string>,
    })
  );
  const tool = async (name: string, args: Record<string, unknown>) => {
    const r: any = await mcp.callTool({ name, arguments: args });
    const text = r.content[0].text as string;
    if (r.isError) throw new Error(`${name}: ${text}`);
    return JSON.parse(text);
  };

  step('Agent: sign in and post a request (budget 6 USDC)');
  {
    const { message } = await tool('prepare_login', { walletAddress: buyer.address });
    await tool('login', { walletAddress: buyer.address, message, signature: await buyer.signMessage({ message }) });
  }
  const posted = await tool('post_request', {
    title: 'MCP request test: label 3 sentences by sentiment',
    description: 'Label each sentence as positive, negative or neutral. Output: CSV with sentence,label.',
    category: 'ai_data',
    budgetUsdc: 6,
    deliveryDays: 2,
  });
  console.log(`  ✓ request ${posted.requestId}`);

  step('Seller sends a 5 USDC proposal (web API); prices stay private');
  const sellerToken = await siwe(seller);
  const proposalRes = await fetch(`${API_URL}/api/requests/${posted.requestId}/proposals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
    body: JSON.stringify({ priceUsdc: '5.00', deliveryDays: 1, message: 'Two-pass labelling, delivered as CSV.' }),
  });
  if (!proposalRes.ok) throw new Error(`proposal failed: ${await proposalRes.text()}`);
  const anon = await (await fetch(`${API_URL}/api/requests/${posted.requestId}`)).json();
  assert.equal(anon.request.proposalCount, 1);
  assert.equal(anon.proposals.length, 0, 'anonymous visitors must not see proposals');
  console.log('  ✓ proposal sent; anonymous view shows only the count');

  step('Agent: list_proposals and accept_proposal');
  const listed = await tool('list_proposals', { requestId: posted.requestId });
  assert.equal(listed.proposals.length, 1);
  assert.equal(listed.proposals[0].priceUsdc, '5.00');
  const accepted = await tool('accept_proposal', { requestId: posted.requestId, proposalId: listed.proposals[0].proposalId });
  const service = { slug: accepted.serviceId as string };
  assert.equal(accepted.priceUsdc, '5.00');
  const catalog = await (await fetch(`${API_URL}/api/services?search=${encodeURIComponent('MCP request test')}`)).json();
  assert.ok(!catalog.services.some((x: any) => x.slug === service.slug), 'accepted service must not be listed in the catalog');
  console.log(`  ✓ accepted; private service ${service.slug} is not in the catalog`);

  step('Agent: create_order and submit both transactions from its wallet');
  const prepared = await tool('create_order', { serviceId: service.slug, buyerWallet: buyer.address });
  const [approveTx, fundTx] = prepared.transactions;
  await mined(await wallet(buyer).sendTransaction({ to: approveTx.to, data: approveTx.data }), 'approve (from MCP calldata)');
  await new Promise((r) => setTimeout(r, 4000));
  const fundReceipt = await mined(await wallet(buyer).sendTransaction({ to: fundTx.to, data: fundTx.data }), 'createAndFundOrder (from MCP calldata)');
  const [funded] = parseEventLogs({ abi: escrowAbi, logs: fundReceipt.logs, eventName: 'OrderFunded' });
  const orderId = Number(funded.args.orderId);
  console.log(`  ✓ order #${orderId}`);
  await until('funded order', async () => (await orderStatus(BigInt(orderId))) === 1);

  step('Agent: register_order and send the task details');
  const reg = await tool('register_order', { serviceId: service.slug, orderId, txHash: fundReceipt.transactionHash });
  assert.equal(reg.status, 'FUNDED');
  await tool('send_message', { orderId, content: 'Please label these: "great product" / "arrived broken" / "it is a box".' });
  console.log('  ✓ registered and message sent');

  step('Seller reads the request, uploads the result and delivers on-chain (web flow)');
  const myOrders = (await (await fetch(`${API_URL}/api/orders/my`, { headers: { Authorization: `Bearer ${sellerToken}` } })).json()).orders;
  const dbOrder = myOrders.find((o: any) => o.contractOrderId === orderId && o.chainId === 84532);
  assert.ok(dbOrder, 'seller sees the order');
  assert.equal(dbOrder.service?.slug, service.slug, 'order linked to the right service');
  const thread = (await (await fetch(`${API_URL}/api/orders/${dbOrder.id}/messages`, { headers: { Authorization: `Bearer ${sellerToken}` } })).json()).messages;
  assert.ok(thread.some((m: any) => m.content.includes('great product')), 'seller sees the agent message');
  const form = new FormData();
  form.append('file', new Blob(['great product,positive\narrived broken,negative\nit is a box,neutral\n'], { type: 'text/csv' }), 'labels.csv');
  const up = await (await fetch(`${API_URL}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${sellerToken}` }, body: form })).json();
  assert.ok(up.hash, `upload failed: ${JSON.stringify(up)}`);
  const deliverTx = await wallet(seller).writeContract({ address: ESCROW, abi: escrowAbi, functionName: 'submitDelivery', args: [BigInt(orderId), up.hash] });
  await mined(deliverTx, 'submitDelivery');
  await until('delivered order', async () => (await orderStatus(BigInt(orderId))) === 2);
  const patch = await fetch(`${API_URL}/api/orders/${dbOrder.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
    body: JSON.stringify({ status: 'DELIVERED', txHash: deliverTx, deliverableUrl: up.url, deliverableHash: up.hash }),
  });
  if (!patch.ok) throw new Error(`delivery sync failed: ${await patch.text()}`);
  await fetch(`${API_URL}/api/orders/${dbOrder.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
    body: JSON.stringify({ content: 'Done, labels.csv attached.' }),
  });

  step('Agent: read_messages and get_deliverable (download + hash check)');
  const msgs = await tool('read_messages', { orderId });
  assert.ok(msgs.messages.some((m: any) => m.from === 'counterparty' && m.content.includes('labels.csv')));
  const deliverable = await tool('get_deliverable', { orderId });
  assert.equal(deliverable.type, 'file');
  assert.equal(deliverable.hashMatches, true, 'downloaded file matches the on-chain hash');
  assert.ok(deliverable.preview.includes('arrived broken,negative'));
  console.log(`  ✓ saved to ${deliverable.savedTo}; hash matches on-chain`);

  step('Agent: approve through prepare_order_action');
  const action = await tool('prepare_order_action', { orderId, action: 'approve_delivery' });
  await mined(await wallet(buyer).sendTransaction({ to: action.transaction.to, data: action.transaction.data }), 'approveDelivery (from MCP calldata)');
  await until('released order', async () => (await orderStatus(BigInt(orderId))) === 3);
  const final = await tool('get_order_status', { orderId });
  assert.equal(final.status, 'Released');
  console.log(`  ✓ order #${orderId} Released: seller paid 4.85 USDC, fee 0.15 USDC`);

  await mcp.close();
  const after = await (await fetch(`${API_URL}/api/requests/${posted.requestId}`)).json();
  assert.equal(after.request.status, 'AWARDED');
  console.log('  ✓ request is AWARDED');
  console.log('\nE2E REQUEST FLOW OK');
}

main().catch((e) => {
  console.error('\nE2E REQUEST FLOW FAILED:', e);
  process.exit(1);
});
