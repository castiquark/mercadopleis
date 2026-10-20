import { handleMcpRequest } from '@mercadopleis/mcp-server/http';

// Remote MCP endpoint (Streamable HTTP, stateless): the same tools as the npm stdio server. The handler owns CORS,
// OPTIONS and the 405 for unsupported methods. It never signs: it returns transactions for the agent's wallet.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handle = (req: Request) => handleMcpRequest(req);

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
export const OPTIONS = handle;
