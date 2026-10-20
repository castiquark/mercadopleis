#!/usr/bin/env node
// Standalone remote server: Streamable HTTP on PORT (default 8080) at /mcp, plus /health.
//   npx -p @mercadopleis/mcp-server mercadopleis-mcp-http
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { handleMcpRequest } from './http.js';

const PORT = Number(process.env.PORT || 8080);
const MAX_BODY = 1_000_000;

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('Request body too large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function send(res: ServerResponse, response: Response) {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

createHttpServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname === '/health') return send(res, Response.json({ ok: true }));
    if (url.pathname !== '/mcp') return send(res, Response.json({ error: 'Not found. The MCP endpoint is /mcp.' }, { status: 404 }));
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    const body = req.method === 'POST' ? await readBody(req) : undefined;
    await send(res, await handleMcpRequest(new Request(url, { method: req.method, headers, body })));
  } catch (e) {
    send(res, Response.json({ error: (e as Error).message }, { status: 400 })).catch(() => res.destroy());
  }
}).listen(PORT, () => console.error(`Mercadopleis MCP (HTTP) on http://localhost:${PORT}/mcp`));
