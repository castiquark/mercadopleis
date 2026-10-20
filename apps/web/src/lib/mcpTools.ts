import { handleMcpRequest } from '@mercadopleis/mcp-server/http';

export interface McpTool {
  name: string;
  description: string;
}

/**
 * The tools of the MCP server, asked in-process with a real tools/list call, so the public page always matches what
 * the server exposes. Empty when the call fails (the page then omits the list).
 */
export async function listMcpTools(): Promise<McpTool[]> {
  try {
    const res = await handleMcpRequest(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      })
    );
    const body = await res.json();
    return (body?.result?.tools ?? []).map((t: any) => ({ name: String(t.name), description: String(t.description ?? '') }));
  } catch (err: any) {
    console.warn('MCP tools/list notice:', err?.message);
    return [];
  }
}

/** First sentence of a tool description, for a compact list. */
export const firstSentence = (text: string) => (text.match(/^.*?[.!?](\s|$)/)?.[0] ?? text).trim();
