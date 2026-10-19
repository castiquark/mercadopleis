/**
 * End-to-end test of the seller side of requests. The seller agent acts only through this MCP server:
 * prepare_login, login, list_open_requests (keywords, budget and deadline filters), send_proposal with a price, the
 * same call again to update it, then with milestones. The buyer posts and accepts through the web API. Also checks
 * that the seller cannot see other sellers' prices, that a buyer cannot propose to their own request, and that an
 * accepted proposal can no longer be edited.
 *
 *   API_URL=http://localhost:3100 pnpm --filter @mercadopleis/mcp-server exec tsx scripts/e2e-seller.ts
 *
 * Needs a local web server pointed at a test database (never production). No transactions: it spends no gas.
 */
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';

const API_URL = process.env.API_URL || 'http://localhost:3100';
assert.ok(/localhost|127\.0\.0\.1/.test(API_URL), 'Run this against a local test server only');
const step = (s: string) => console.log(`\n— ${s}`);

async function siwe(account: PrivateKeyAccount) {
  const { nonce } = await (await fetch(`${API_URL}/api/auth/nonce?address=${account.address}`)).json();
  const u = new URL(API_URL);
  const message = `${u.host} wants you to sign in with your Ethereum account:\n${account.address}\n\nBuyer test sign-in.\n\nURI: ${u.origin}\nVersion: 1\nChain ID: 84532\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;
  const res = await fetch(`${API_URL}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: account.address, message, signature: await account.signMessage({ message }) }),
  });
  if (!res.ok) throw new Error(`buyer sign-in failed: ${await res.text()}`);
  return (await res.json()).token as string;
}

async function startMcp(): Promise<Client> {
  const mcp = new Client({ name: 'e2e-seller', version: '0' });
  await mcp.connect(
    new StdioClientTransport({
      command: 'node',
      args: [resolve(import.meta.dirname, '../dist/index.js')],
      env: { ...process.env, MERCADOPLEIS_API_URL: API_URL, MERCADOPLEIS_CHAIN_ID: '84532' } as Record<string, string>,
    })
  );
  return mcp;
}

async function main() {
  const buyer = privateKeyToAccount(generatePrivateKey());
  const seller = privateKeyToAccount(generatePrivateKey());
  const rival = privateKeyToAccount(generatePrivateKey());
  console.log(`buyer  ${buyer.address} (web API)\nseller ${seller.address} (acts only through MCP)`);
  const tag = `e2eseller${Date.now().toString(36)}`;

  step('Buyer posts two requests through the web API');
  const buyerToken = await siwe(buyer);
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` };
  const post = async (title: string, budgetUsdc: string, deliveryDays: number) => {
    const res = await fetch(`${API_URL}/api/requests`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ title, description: `Transcribe a 10 minute interview to text. Tag ${tag}.`, category: 'video_audio', budgetUsdc, deliveryDays }),
    });
    if (!res.ok) throw new Error(`request failed: ${await res.text()}`);
    return (await res.json()).request as { id: string; slug: string };
  };
  const big = await post(`Interview transcription ${tag}`, '20.00', 5);
  const rush = await post(`Rush transcription ${tag}`, '3.00', 1);
  console.log(`  ✓ ${big.slug} (20 USDC, 5 days) and ${rush.slug} (3 USDC, 1 day)`);

  step('Seller agent: sign in through MCP');
  const mcp = await startMcp();
  const tool = async (name: string, args: Record<string, unknown>) => {
    const r: any = await mcp.callTool({ name, arguments: args });
    const text = r.content[0].text as string;
    if (r.isError) throw new Error(`${name}: ${text}`);
    return JSON.parse(text);
  };
  const toolError = async (name: string, args: Record<string, unknown>) => {
    const r: any = await mcp.callTool({ name, arguments: args });
    assert.ok(r.isError, `${name} should have failed`);
    return r.content[0].text as string;
  };
  {
    const { message } = await tool('prepare_login', { walletAddress: seller.address });
    await tool('login', { walletAddress: seller.address, message, signature: await seller.signMessage({ message }) });
  }

  step('Seller agent: list_open_requests with filters');
  const all = await tool('list_open_requests', { keywords: tag });
  assert.equal(all.count, 2, 'both requests match the keywords');
  assert.ok(all.requests.every((r: any) => r.yours === false));
  assert.ok(all.notice.includes('untrusted'));
  const byBudget = await tool('list_open_requests', { keywords: tag, minBudgetUsdc: 10 });
  assert.deepEqual(byBudget.requests.map((r: any) => r.requestId), [big.slug]);
  const byDeadline = await tool('list_open_requests', { keywords: tag, minDeliveryDays: 2 });
  assert.deepEqual(byDeadline.requests.map((r: any) => r.requestId), [big.slug]);
  const none = await tool('list_open_requests', { keywords: `${tag}-nothing` });
  assert.equal(none.count, 0);
  assert.ok(none.next.includes('fewer filters'));
  console.log('  ✓ keywords, minBudgetUsdc and minDeliveryDays filter as expected');

  step('Seller agent: send_proposal, then update it');
  assert.ok((await toolError('send_proposal', { requestId: big.slug, message: 'No price' })).includes('priceUsdc'));
  const first = await tool('send_proposal', { requestId: big.slug, priceUsdc: 15, deliveryDays: 3, message: 'Manual transcription, timestamps every minute.' });
  assert.equal(first.status, 'PENDING');
  assert.equal(first.priceUsdc, '15.00');
  const updated = await tool('send_proposal', { requestId: big.slug, priceUsdc: 12.5, deliveryDays: 2, message: 'Manual transcription, timestamps every minute.' });
  assert.equal(updated.proposalId, first.proposalId, 'sending again updates the same proposal');
  assert.equal(updated.priceUsdc, '12.50');
  const milestones = await tool('send_proposal', {
    requestId: rush.slug,
    message: 'Draft first, then a proofread pass.',
    milestones: [
      { title: 'Draft transcript', amountUsdc: 1.5, deliveryDays: 1 },
      { title: 'Proofread', amountUsdc: 1.25, deliveryDays: 1 },
    ],
  });
  assert.equal(milestones.priceUsdc, '2.75', 'milestone amounts add up to the total');
  console.log(`  ✓ proposal ${first.proposalId} updated to 12.50; milestone proposal totals 2.75`);

  step('Prices stay private: a rival seller sees only the count');
  const rivalToken = await siwe(rival);
  const rivalView = await (await fetch(`${API_URL}/api/requests/${big.slug}`, { headers: { Authorization: `Bearer ${rivalToken}` } })).json();
  assert.equal(rivalView.request.proposalCount, 1);
  assert.ok(!rivalView.proposals.some((p: any) => p.priceUsdc === '12.50'), 'another seller must not see the price');
  console.log('  ✓ count 1, no prices');

  step('Buyer cannot propose to their own request');
  const own = await fetch(`${API_URL}/api/requests/${big.slug}/proposals`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ priceUsdc: '1.00', deliveryDays: 1, message: 'Self' }),
  });
  assert.equal(own.status, 400);
  console.log('  ✓ rejected with 400');

  step('Buyer accepts; the seller can no longer edit the proposal');
  const view = await (await fetch(`${API_URL}/api/requests/${big.slug}`, { headers: { Authorization: `Bearer ${buyerToken}` } })).json();
  const mine = view.proposals.find((p: any) => p.id === first.proposalId);
  assert.ok(mine, 'buyer sees the proposal');
  assert.equal(Number(mine.priceUsdc), 12.5);
  const accept = await fetch(`${API_URL}/api/requests/${big.slug}/proposals/${first.proposalId}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ action: 'accept' }),
  });
  if (!accept.ok) throw new Error(`accept failed: ${await accept.text()}`);
  const accepted = await accept.json();
  assert.equal(Number(accepted.service.priceUsdc), 12.5);
  assert.equal(accepted.service.deliveryDays, 2);
  const late = await toolError('send_proposal', { requestId: big.slug, priceUsdc: 20, deliveryDays: 2, message: 'Raise' });
  assert.ok(/no longer|accepted/i.test(late), late);
  const open = await tool('list_open_requests', { keywords: tag });
  assert.deepEqual(open.requests.map((r: any) => r.requestId), [rush.slug], 'the awarded request leaves the open list');
  console.log(`  ✓ accepted as service ${accepted.service.slug}; edit refused; request left the open list`);

  await mcp.close();
  console.log('\nE2E SELLER FLOW OK');
}

main().catch((e) => {
  console.error('\nE2E SELLER FLOW FAILED:', e);
  process.exit(1);
});
