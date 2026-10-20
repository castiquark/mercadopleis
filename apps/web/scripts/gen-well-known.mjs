#!/usr/bin/env node
// Writes the agent discovery files in public/.well-known/ from packages/mcp-server (package.json and server.json),
// so the version, package name and URLs never drift from the published MCP server.
//   mcp.json        the MCP Registry server.json (stdio over npm), plus links, under the publisher _meta key
//   agent-card.json A2A AgentCard (spec 1.0): what Mercadopleis does and how to integrate (no A2A endpoint)
//   agent.json      the same card at the pre-0.3 A2A path
// Run after an MCP release: pnpm --filter @mercadopleis/web gen:well-known (a test fails while the files are stale).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mcpDir = join(here, '../../../packages/mcp-server');
const outDir = join(here, '../public/.well-known');

const SITE = 'https://mercadopleis.club';
// Public news accounts, also in the site footer, llms.txt and agents.txt.
const NEWS = { x: 'https://x.com/Mercadopleis', linkedin: 'https://www.linkedin.com/company/mercadopleis', telegram: 'https://t.me/mercadopleis' };

export function buildWellKnown() {
  const pkg = JSON.parse(readFileSync(join(mcpDir, 'package.json'), 'utf8'));
  const server = JSON.parse(readFileSync(join(mcpDir, 'server.json'), 'utf8'));
  const repoUrl = server.repository.url;
  const npxCommand = `npx -y ${pkg.name}`;

  const links = {
    website: server.websiteUrl,
    llmsTxt: `${SITE}/llms.txt`,
    llmsFullTxt: `${SITE}/llms-full.txt`,
    agentsTxt: `${SITE}/agents.txt`,
    agentCard: `${SITE}/.well-known/agent-card.json`,
    restApi: `${SITE}/api`,
    repository: repoUrl,
    mcpServerSource: `${repoUrl}/tree/main/${server.repository.subfolder}`,
    npm: `https://www.npmjs.com/package/${pkg.name}`,
    news: NEWS,
    registry: `https://registry.modelcontextprotocol.io/v0/servers?search=${encodeURIComponent(server.name)}`,
  };

  // The MCP Registry's server.json format: the npm package (stdio) plus the remote Streamable HTTP endpoint at /mcp
  // (stateless, same tools). `remotes` is added here until server.json carries it from the next registry release.
  const mcp = {
    ...server,
    remotes: server.remotes ?? [{ type: 'streamable-http', url: `${SITE}/mcp` }],
    _meta: {
      'io.modelcontextprotocol.registry/publisher-provided': {
        install: {
          command: npxCommand,
          clientConfig: { mcpServers: { mercadopleis: { command: 'npx', args: ['-y', pkg.name] } } },
          remote: { url: `${SITE}/mcp`, transport: 'streamable-http', clientConfig: { mcpServers: { mercadopleis: { type: 'http', url: `${SITE}/mcp` } } } },
          note: 'Local (npx, stdio) or remote (Streamable HTTP, stateless) at the same tools. The server signs nothing; it returns transactions for the agent\'s own wallet to sign.',
        },
        links,
      },
    },
  };

  const card = {
    name: 'Mercadopleis',
    description:
      `${pkg.description}. Integrate through the MCP server (${npxCommand} over stdio, or remote at ${SITE}/mcp over Streamable HTTP; docs at ${SITE}/mcp-server), the public REST API at ${SITE}/api, or llms.txt. ` +
      'This card is for discovery only: Mercadopleis does not expose an A2A endpoint, so supportedInterfaces is empty. ' +
      `News: X ${NEWS.x}, LinkedIn ${NEWS.linkedin}, Telegram ${NEWS.telegram}.`,
    supportedInterfaces: [],
    provider: { organization: 'Mercadopleis', url: SITE },
    version: pkg.version,
    documentationUrl: `${SITE}/llms-full.txt`,
    iconUrl: `${SITE}/icon.svg`,
    capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
    defaultInputModes: ['application/json', 'text/plain'],
    defaultOutputModes: ['application/json', 'text/plain'],
    skills: [
      {
        id: 'search_services',
        name: 'Find a person for a task',
        description:
          'Search and compare listed human services (datasets, prompt red-teaming, scraping, automations, transcription) by text, category, price and delivery time. MCP: search_services, compare_services, get_service. REST: GET /api/services.',
        tags: ['marketplace', 'human-in-the-loop', 'services', 'search'],
        examples: ['Find someone to label 500 rows of a dataset in Spanish for under 50 USDC', 'Compare transcription services delivered in 2 days'],
      },
      {
        id: 'post_request',
        name: 'Post a paid request',
        description:
          'When no listed service fits, post the task with a budget and deadline; people send proposals and nothing is charged until one is accepted and funded. MCP: post_request, list_proposals, accept_proposal. REST: POST /api/requests (SIWE sign-in).',
        tags: ['requests', 'bounties', 'proposals'],
        examples: ['Post a request: red-team my support chatbot prompt, budget 80 USDC, 3 days'],
      },
      {
        id: 'find_paid_work',
        name: 'Find paid work and propose',
        description:
          'For sellers and their agents: list open requests by keyword, category, minimum budget and deadline, and send a proposal with price, delivery time and approach (or milestones). MCP: list_open_requests, send_proposal.',
        tags: ['sellers', 'jobs', 'proposals'],
        examples: ['List open scraping requests paying at least 30 USDC'],
      },
      {
        id: 'escrow_payment',
        name: 'Pay through non-custodial USDC escrow on Base',
        description:
          'Fund an order in the escrow contract on Base Mainnet (Base Sepolia for tests); the money is released when the buyer approves the delivery or automatically after the 5-day review window, with refunds and disputes. Fixed 3% fee on the seller\'s payout. The agent signs with its own wallet. MCP: create_order, get_order_status, get_deliverable, prepare_order_action, read_messages, send_message.',
        tags: ['escrow', 'usdc', 'base', 'payments', 'stablecoin'],
        examples: ['Fund the order for this service and tell me when the delivery arrives', 'Approve the delivery of order 12'],
      },
    ],
  };

  return { 'mcp.json': mcp, 'agent-card.json': card, 'agent.json': card };
}

export const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(outDir, { recursive: true });
  for (const [file, value] of Object.entries(buildWellKnown())) {
    writeFileSync(join(outDir, file), serialize(value));
    console.log(`wrote public/.well-known/${file}`);
  }
}
