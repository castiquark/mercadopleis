import { describe, expect, it } from 'vitest';
import { handleMcpRequest } from './http.js';
import { currentSession, decodeSessionToken, encodeSessionToken, withSession } from './session.js';

const rpc = (method: string, params: unknown = {}, headers: Record<string, string> = {}) =>
  handleMcpRequest(
    new Request('http://localhost/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
  );

const INIT = { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } };

describe('remote (HTTP) server', () => {
  it('initializes and lists the same tools as stdio, with sessionToken only on signed-in tools', async () => {
    const init = await rpc('initialize', INIT);
    expect(init.status).toBe(200);
    expect(init.headers.get('access-control-allow-origin')).toBe('*');
    expect((await init.json()).result.serverInfo.name).toBe('mercadopleis');

    const { result } = await (await rpc('tools/list')).json();
    const tools = Object.fromEntries(result.tools.map((t: any) => [t.name, t]));
    expect(Object.keys(tools)).toHaveLength(20);
    expect(tools.send_message.inputSchema.properties).toHaveProperty('sessionToken');
    expect(tools.send_proposal.inputSchema.properties).toHaveProperty('sessionToken');
    expect(tools.search_services.inputSchema.properties).not.toHaveProperty('sessionToken');
    expect(tools.create_order.inputSchema.properties).toHaveProperty('chainId');
  });

  it('refuses signed-in tools without a session, before any network call', async () => {
    const { result } = await (await rpc('tools/call', { name: 'send_message', arguments: { orderId: 1, content: 'hi' } })).json();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Not signed in/);
  });

  it('answers CORS preflight and rejects GET', async () => {
    expect((await handleMcpRequest(new Request('http://localhost/mcp', { method: 'OPTIONS' }))).status).toBe(204);
    expect((await handleMcpRequest(new Request('http://localhost/mcp'))).status).toBe(405);
  });
});

describe('session tokens', () => {
  const s = { address: '0xabc', userId: 'u1', token: 'jwt' };

  it('round-trip and reject anything else', () => {
    expect(decodeSessionToken(encodeSessionToken(s))).toEqual(s);
    expect(decodeSessionToken('jwt')).toBeNull();
    expect(decodeSessionToken('mpl1.not-json')).toBeNull();
    expect(decodeSessionToken(undefined)).toBeNull();
  });

  it('are scoped to the call that carries them', async () => {
    const token = encodeSessionToken(s);
    const [inside, other] = await Promise.all([
      withSession(token, async () => {
        await new Promise((r) => setTimeout(r, 5));
        return currentSession();
      }),
      withSession(undefined, async () => currentSession()),
    ]);
    expect(inside).toEqual({ address: '0xabc', userId: 'u1' });
    expect(other).toBeNull();
    expect(currentSession()).toBeNull();
  });
});
