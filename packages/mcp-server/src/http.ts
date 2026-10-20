// Remote (Streamable HTTP) entry point, stateless: every request gets a fresh server and transport, so it runs the
// same on a long-lived Node process, a serverless function or an edge runtime. Signed-in tools read the session from
// their sessionToken argument or from an "Authorization: Bearer <sessionToken>" header.
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createServer } from './server.js';
import { withSession } from './session.js';

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version',
};

/** Handles one MCP request (POST with JSON-RPC). GET streams and DELETE are not used in stateless mode. */
export async function handleMcpRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return Response.json(
      { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed: this server is stateless, send JSON-RPC with POST.' }, id: null },
      { status: 405, headers: { ...CORS_HEADERS, Allow: 'POST, OPTIONS' } }
    );
  }

  const bearer = req.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const server = createServer({ remote: true });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    const res = await withSession(bearer, () => transport.handleRequest(req));
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  } finally {
    await server.close();
  }
}
