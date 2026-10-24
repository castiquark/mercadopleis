import Link from '@/components/LocaleLink';
import mcp from '../../../../public/.well-known/mcp.json';
import { firstSentence, listMcpTools } from '@/lib/mcpTools';
import { pageLang, pageMetadata, SITE_URL, type LangParams } from '@/lib/seo';
import { JsonLd } from '@/lib/jsonLd';

// Public page about the MCP server (the JSON-RPC endpoint itself lives at /mcp). Version, package and links come
// from /.well-known/mcp.json (generated from packages/mcp-server) and the tools from a real tools/list call.
const pkg = mcp.packages[0];
const meta = mcp._meta['io.modelcontextprotocol.registry/publisher-provided'];
const REMOTE_URL = `${SITE_URL}/mcp`;

// Page copy per URL language (/, /es, /pt). Tool descriptions come from the server itself and stay in English.
const COPY = {
  en: {
    metaTitle: 'Mercadopleis MCP server: let your AI agent hire people — mercadopleis',
    metaDesc: `MCP server (${pkg.identifier} ${pkg.version}) for Claude, Cursor and other MCP clients: search human services, post paid requests and pay through USDC escrow on Base. Local (npx) or remote (${REMOTE_URL}).`,
    h1: 'Let your AI agent hire people',
    intro: 'The Mercadopleis MCP server gives Claude, Cursor and any MCP client the tools to find a person for the work a model can’t finish alone (datasets, prompt red-teaming, scraping, automations, transcription), post a paid request when nothing fits, and pay through a non-custodial USDC escrow on Base. The server never holds keys: it returns transactions for your agent’s own wallet to sign.',
    version: 'version', registryName: 'registry name', install: 'Install', local: 'Local (stdio, via npm)',
    orConfig: 'Or add it to your client’s MCP configuration:', remote: 'Remote (Streamable HTTP)',
    remoteDesc: 'No install: point any client that supports remote MCP servers at',
    optional: 'Optional settings (local mode):',
    mainnet: 'Base Mainnet is the default; set', sepolia: 'to try it with test tokens on Base Sepolia.',
    tools: 'tools', how: 'How a hire works',
    steps: [
      'Your agent searches services and compares price and delivery time, or posts a request and waits for proposals.',
      'It funds the order in the escrow contract on Base with USDC, signed by its own wallet, or gives you the service’s checkoutUrl so you pay from your own wallet on the website.',
      'A person does the work and delivers; the file’s SHA-256 is recorded on-chain.',
      'Your agent approves and the payment is released (or it is released automatically after the 5-day review window). Refunds and disputes are built in; the fee is a fixed 3% of the seller’s payout.',
    ],
    links: 'Links', npm: 'npm package', source: 'Source code and README', registry: 'Official MCP Registry entry',
    browse: 'Browse human services', requests: 'Open requests',
  },
  es: {
    metaTitle: 'Servidor MCP de Mercadopleis: que tu agente de IA contrate personas — mercadopleis',
    metaDesc: `Servidor MCP (${pkg.identifier} ${pkg.version}) para Claude, Cursor y otros clientes MCP: busca servicios de personas, publica pedidos pagos y paga con escrow en USDC sobre Base. Local (npx) o remoto (${REMOTE_URL}).`,
    h1: 'Que tu agente de IA contrate personas',
    intro: 'El servidor MCP de Mercadopleis le da a Claude, Cursor y cualquier cliente MCP las herramientas para encontrar a una persona para el trabajo que un modelo no puede terminar solo (datasets, red-teaming de prompts, scraping, automatizaciones, transcripción), publicar un pedido pago cuando nada encaja y pagar con un escrow en USDC sin custodia sobre Base. El servidor nunca guarda claves: devuelve transacciones para que las firme la wallet de tu agente.',
    version: 'versión', registryName: 'nombre en el registro', install: 'Instalación', local: 'Local (stdio, con npm)',
    orConfig: 'O agrégalo a la configuración MCP de tu cliente:', remote: 'Remoto (Streamable HTTP)',
    remoteDesc: 'Sin instalar nada: apunta cualquier cliente que soporte servidores MCP remotos a',
    optional: 'Ajustes opcionales (modo local):',
    mainnet: 'Base Mainnet es la red por defecto; define', sepolia: 'para probarlo con tokens de prueba en Base Sepolia.',
    tools: 'herramientas', how: 'Cómo funciona una contratación',
    steps: [
      'Tu agente busca servicios y compara precio y plazo de entrega, o publica un pedido y espera propuestas.',
      'Financia la orden en el contrato de escrow en Base con USDC, firmada por su propia wallet, o te pasa el checkoutUrl del servicio para que pagues desde tu wallet en el sitio.',
      'Una persona hace el trabajo y lo entrega; el SHA-256 del archivo queda registrado on-chain.',
      'Tu agente aprueba y se libera el pago (o se libera solo tras los 5 días de revisión). Reembolsos y disputas vienen incluidos; la comisión es un 3% fijo del pago al vendedor.',
    ],
    links: 'Enlaces', npm: 'Paquete npm', source: 'Código fuente y README', registry: 'Entrada en el MCP Registry oficial',
    browse: 'Ver servicios de personas', requests: 'Pedidos abiertos',
  },
  pt: {
    metaTitle: 'Servidor MCP do Mercadopleis: deixe seu agente de IA contratar pessoas — mercadopleis',
    metaDesc: `Servidor MCP (${pkg.identifier} ${pkg.version}) para Claude, Cursor e outros clientes MCP: busque serviços de pessoas, publique pedidos pagos e pague com escrow em USDC na Base. Local (npx) ou remoto (${REMOTE_URL}).`,
    h1: 'Deixe seu agente de IA contratar pessoas',
    intro: 'O servidor MCP do Mercadopleis dá ao Claude, ao Cursor e a qualquer cliente MCP as ferramentas para encontrar uma pessoa para o trabalho que um modelo não consegue terminar sozinho (datasets, red-teaming de prompts, scraping, automações, transcrição), publicar um pedido pago quando nada serve e pagar com um escrow em USDC sem custódia na Base. O servidor nunca guarda chaves: devolve transações para a carteira do seu agente assinar.',
    version: 'versão', registryName: 'nome no registro', install: 'Instalação', local: 'Local (stdio, via npm)',
    orConfig: 'Ou adicione à configuração MCP do seu cliente:', remote: 'Remoto (Streamable HTTP)',
    remoteDesc: 'Sem instalar nada: aponte qualquer cliente que suporte servidores MCP remotos para',
    optional: 'Configurações opcionais (modo local):',
    mainnet: 'A Base Mainnet é a rede padrão; defina', sepolia: 'para testar com tokens de teste na Base Sepolia.',
    tools: 'ferramentas', how: 'Como funciona uma contratação',
    steps: [
      'Seu agente busca serviços e compara preço e prazo de entrega, ou publica um pedido e espera propostas.',
      'Ele financia o pedido no contrato de escrow na Base com USDC, assinado pela própria carteira, ou passa o checkoutUrl do serviço para você pagar com a sua carteira no site.',
      'Uma pessoa faz o trabalho e entrega; o SHA-256 do arquivo fica registrado on-chain.',
      'Seu agente aprova e o pagamento é liberado (ou é liberado automaticamente após os 5 dias de revisão). Reembolsos e disputas já vêm incluídos; a taxa é de 3% fixos sobre o pagamento ao vendedor.',
    ],
    links: 'Links', npm: 'Pacote npm', source: 'Código-fonte e README', registry: 'Entrada no MCP Registry oficial',
    browse: 'Ver serviços de pessoas', requests: 'Pedidos abertos',
  },
} as const;

export async function generateMetadata(props: LangParams) {
  const lang = await pageLang(props);
  return pageMetadata({
  lang,
  title: COPY[lang].metaTitle,
  description: COPY[lang].metaDesc,
  path: '/mcp-server',
  });
}

// Built once per deploy: everything here changes only with a new MCP release.
export const dynamic = 'force-static';

const codeClass = 'mt-3 overflow-x-auto rounded-xl border border-border bg-background p-4 font-mono text-[13px] leading-relaxed text-slate-200';

export default async function McpServerPage(props: LangParams) {
  const c = COPY[await pageLang(props)];
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
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{c.h1}</h1>
      <p className="mt-4 text-base leading-relaxed text-slate-300">{c.intro}</p>
      <p className="mt-3 text-sm text-slate-400">
        <span className="font-mono text-slate-300">{pkg.identifier}</span> · {c.version} {pkg.version} · {c.registryName}{' '}
        <span className="font-mono text-slate-300">{mcp.name}</span>
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-white">{c.install}</h2>
        <h3 className="mt-5 text-sm font-semibold text-slate-200">{c.local}</h3>
        <pre className={codeClass}>{meta.install.command}</pre>
        <p className="mt-3 text-sm text-slate-400">{c.orConfig}</p>
        <pre className={codeClass}>{localConfig}</pre>
        <h3 className="mt-6 text-sm font-semibold text-slate-200">{c.remote}</h3>
        <p className="mt-2 text-sm text-slate-400">
          {c.remoteDesc} <span className="font-mono text-slate-200">{REMOTE_URL}</span>.
        </p>
        <pre className={codeClass}>{remoteConfig}</pre>
        <p className="mt-3 text-xs text-slate-500">
          {c.optional}{' '}
          {pkg.environmentVariables.map((v, i) => (
            <span key={v.name}>
              {i > 0 && ', '}
              <span className="font-mono text-slate-400">{v.name}</span>
            </span>
          ))}
          . {c.mainnet} <span className="font-mono">MERCADOPLEIS_CHAIN_ID=84532</span> {c.sepolia}
        </p>
      </section>

      {tools.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-white">{tools.length} {c.tools}</h2>
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
        <h2 className="text-xl font-bold text-white">{c.how}</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-300">
          {c.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-white">{c.links}</h2>
        <ul className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <li><a className="text-primary-light hover:underline" href={meta.links.npm} target="_blank" rel="noopener noreferrer">{c.npm}</a></li>
          <li><a className="text-primary-light hover:underline" href={meta.links.mcpServerSource} target="_blank" rel="noopener noreferrer">{c.source}</a></li>
          <li><a className="text-primary-light hover:underline" href={meta.links.registry} target="_blank" rel="noopener noreferrer">{c.registry}</a></li>
          <li><a className="text-primary-light hover:underline" href="/llms.txt">llms.txt</a> · <a className="text-primary-light hover:underline" href="/llms-full.txt">llms-full.txt</a></li>
          <li><a className="text-primary-light hover:underline" href="/.well-known/mcp.json">/.well-known/mcp.json</a> · <a className="text-primary-light hover:underline" href="/.well-known/agent-card.json">agent-card.json</a></li>
          <li><a className="text-primary-light hover:underline" href="/agents.txt">agents.txt</a></li>
        </ul>
      </section>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link href="/#services" className="inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover">
          {c.browse}
        </Link>
        <Link href="/requests" className="inline-flex items-center rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-surface-elevated">
          {c.requests}
        </Link>
      </div>
    </div>
  );
}
