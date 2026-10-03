// Smoke test: spawns the server over stdio and exercises the read-only tools against the live API.
//
//   pnpm test:smoke                                    # runs src/index.ts with tsx
//   SMOKE_COMMAND="npx mercadopleis-mcp" pnpm test:smoke   # runs an installed build (e.g. from `npm pack`)
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import assert from 'node:assert/strict';

const [command, ...args] = (process.env.SMOKE_COMMAND || 'npx tsx src/index.ts').split(' ');
const client = new Client({ name: 'smoke', version: '0.0.0' });
await client.connect(new StdioClientTransport({ command, args, env: { ...process.env } as Record<string, string> }));
console.log('server ->', client.getServerVersion());

const text = (r: any) => r.content[0].text as string;

const tools = (await client.listTools()).tools.map((t) => t.name).sort();
assert.deepEqual(tools, [
  'compare_services',
  'create_order',
  'get_deliverable',
  'get_delivery',
  'get_order_status',
  'get_service',
  'login',
  'prepare_login',
  'prepare_order_action',
  'read_messages',
  'register_order',
  'search_services',
  'send_message',
]);

// Signed-in tools must refuse politely without a session.
const anon = await client.callTool({ name: 'read_messages', arguments: { orderId: 1 } });
assert.equal(anon.isError, true);
console.log('read_messages (no session) ->', text(anon));

const search = JSON.parse(text(await client.callTool({ name: 'search_services', arguments: { capability: 'spanish-audio-transcription', maxPriceUsdc: 25 } })));
assert.ok(search.count >= 1, 'search should find the transcription service');
const svc = search.services[0];
console.log('search ->', svc.title, svc.priceUsdc);

const detail = JSON.parse(text(await client.callTool({ name: 'get_service', arguments: { slugOrId: svc.slug } })));
assert.equal(detail.service?.id ?? detail.id, svc.id);

const cmp = JSON.parse(text(await client.callTool({ name: 'compare_services', arguments: { capability: 'python' } })));
console.log('compare ->', cmp.candidates.map((c: any) => `${c.title.slice(0, 30)} $${c.priceUsdc}`));

const buyer = '0x0000000000000000000000000000000000000001';
const order = JSON.parse(text(await client.callTool({ name: 'create_order', arguments: { serviceId: svc.slug, buyerWallet: buyer } })));
assert.equal(order.transactions.length, 2);
assert.ok(order.transactions[1].data.endsWith('0b0080218021802180218021802180218021'), 'builder code suffix present');
console.log('create_order -> tx1 to', order.transactions[0].to, '| tx2 to', order.transactions[1].to);

const bad = await client.callTool({ name: 'create_order', arguments: { serviceId: svc.slug, buyerWallet: 'nope' } });
assert.equal(bad.isError, true);

const none = await client.callTool({ name: 'get_order_status', arguments: { orderId: 999999 } });
assert.equal(none.isError, true);
console.log('get_order_status (nonexistent) ->', text(none));

const noAction = await client.callTool({ name: 'prepare_order_action', arguments: { orderId: 999999, action: 'approve_delivery' } });
assert.equal(noAction.isError, true);
console.log('prepare_order_action (nonexistent) ->', text(noAction));

await client.close();
console.log('OK');
