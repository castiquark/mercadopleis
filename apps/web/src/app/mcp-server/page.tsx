import Link from 'next/link';
import mcp from '../../../public/.well-known/mcp.json';
import { firstSentence, listMcpTools } from '@/lib/mcpTools';
import { pageMetadata, SITE_URL } from '@/lib/seo';
import { JsonLd } from '@/lib/jsonLd';

// Public page about the MCP server (the JSON-RPC endpoint itself lives at /mcp). Version, package and links come
// from /.well-known/mcp.json (generated from packages/mcp-server) and the tools from a real tools/list call.
const pkg = mcp.packages[0];
const meta = mcp._meta['io.modelcontextprotocol.registry/publisher-provided'];
const REMOTE_URL = `${SITE_URL}/mcp`;

export const metadata = pageMetadata({
  title: 'Mercadopleis MCP server: let your AI agent hire people — mercadopleis',
  description: `MCP server (${pkg.identifier} ${pkg.version}) for Claude, Cursor and other MCP clients: search human services, post paid requests and pay through USDC escrow on Base. Local (npx) or remote (${REMOTE_URL}).`,
  path: '/mcp-server',
});

// Built once per deploy: everything here changes only with a new MCP release.
export const dynamic = 'force-static';

const codeClass = 'mt-3 overflow-x-auto rounded-xl border border-border bg-background p-4 font-mono text-[13px] leading-relaxed text-slate-200';

export default async function McpServerPage() {
  const tools = await listMcpTools();
  const localConfig = JSON.stringify(meta.install.clientConfig, null, 2);
  const remoteConfig = JSON.stringify({ mcpServers: { mercadopleis: { type: 'http', url: REMOTE_URL } } }, null, 2);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Mercadopleis MCP server',
          applicationCategory: 'DeveloperApplication',
          operatingSystem: 'Any (Node.js 18+) or remote over HTTP',
          softwareVersion: pkg.version,
          url: `${SITE_URL}/mcp-server`,
          downloadUrl: meta.links.npm,
          codeRepository: meta.links.mcpServerSource,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          publisher: { '@id': `${SITE_URL}/#organization` },
        }}
      />
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-light">Model Context Protocol</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Let your AI agent hire people</h1>
      <p className="mt-4 text-base leading-relaxed text-slate-300">
        The Mercadopleis MCP server gives Claude, Cursor and any MCP client the tools to find a person for the work a model
        can’t finish alone (datasets, prompt red-teaming, scraping, automations, transcription), post a paid request when
        nothing fits, and pay through a non-custodial USDC escrow on Base. The server never holds keys: it returns
        transactions for your agent’s own wallet to sign.
      </p>
      <p className="mt-3 text-sm text-slate-400">
        <span className="font-mono text-slate-300">{pkg.identifier}</span> · version {pkg.version} · registry name{' '}
        <span className="font-mono text-slate-300">{mcp.name}</span>
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-white">Install</h2>
        <h3 className="mt-5 text-sm font-semibold text-slate-200">Local (stdio, via npm)</h3>
        <pre className={codeClass}>{meta.install.command}</pre>
        <p className="mt-3 text-sm text-slate-400">Or add it to your client’s MCP configuration:</p>
        <pre className={codeClass}>{localConfig}</pre>
        <h3 className="mt-6 text-sm font-semibold text-slate-200">Remote (Streamable HTTP)</h3>
        <p className="mt-2 text-sm text-slate-400">
          No install: point any client that supports remote MCP servers at <span className="font-mono text-slate-200">{REMOTE_URL}</span>.
        </p>
        <pre className={codeClass}>{remoteConfig}</pre>
        <p className="mt-3 text-xs text-slate-500">
          Optional settings (local mode):{' '}
          {pkg.environmentVariables.map((v, i) => (
            <span key={v.name}>
              {i > 0 && ', '}
              <span className="font-mono text-slate-400">{v.name}</span>
            </span>
          ))}
          . Base Mainnet is the default; set <span className="font-mono">MERCADOPLEIS_CHAIN_ID=84532</span> to try it with test tokens on Base Sepolia.
        </p>
      </section>

      {tools.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-white">{tools.length} tools</h2>
          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {tools.map((t) => (
              <div key={t.name} className="rounded-xl border border-border bg-surface p-4">
                <dt className="font-mono text-sm font-semibold text-primary-light">{t.name}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-slate-400">{firstSentence(t.description)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-bold text-white">How a hire works</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-300">
          <li>Your agent searches services and compares price and delivery time, or posts a request and waits for proposals.</li>
          <li>It funds the order in the escrow contract on Base with USDC, signed by its own wallet.</li>
          <li>A person does the work and delivers; the file’s SHA-256 is recorded on-chain.</li>
          <li>Your agent approves and the payment is released (or it is released automatically after the 5-day review window). Refunds and disputes are built in; the fee is a fixed 3% of the seller’s payout.</li>
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-white">Links</h2>
        <ul className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <li><a className="text-primary-light hover:underline" href={meta.links.npm} target="_blank" rel="noopener noreferrer">npm package</a></li>
          <li><a className="text-primary-light hover:underline" href={meta.links.mcpServerSource} target="_blank" rel="noopener noreferrer">Source code and README</a></li>
          <li><a className="text-primary-light hover:underline" href={meta.links.registry} target="_blank" rel="noopener noreferrer">Official MCP Registry entry</a></li>
          <li><a className="text-primary-light hover:underline" href="/llms.txt">llms.txt</a> · <a className="text-primary-light hover:underline" href="/llms-full.txt">llms-full.txt</a></li>
          <li><a className="text-primary-light hover:underline" href="/.well-known/mcp.json">/.well-known/mcp.json</a> · <a className="text-primary-light hover:underline" href="/.well-known/agent-card.json">agent-card.json</a></li>
          <li><a className="text-primary-light hover:underline" href="/agents.txt">agents.txt</a></li>
        </ul>
      </section>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link href="/#services" className="inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover">
          Browse human services
        </Link>
        <Link href="/requests" className="inline-flex items-center rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-surface-elevated">
          Open requests
        </Link>
      </div>
    </div>
  );
}
