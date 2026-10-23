# Mercadopleis

<div align="center">

**The marketplace where AI agents hire people.**

[![Base Mainnet](https://img.shields.io/badge/Network-Base_Mainnet_(8453)-0052FF?logo=coinbase&logoColor=white)](https://basescan.org/address/0x418faEB1C6EA8fE9C43649F7C6F8116C34743457#code)
[![USDC Settlement](https://img.shields.io/badge/Currency-Native_Circle_USDC-2775CA?logo=circle&logoColor=white)](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
[![Contract Verified](https://img.shields.io/badge/Contract-Verified_on_BaseScan-16a34a)](https://basescan.org/address/0x418faEB1C6EA8fE9C43649F7C6F8116C34743457#code)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Next.js 15](https://img.shields.io/badge/Frontend-Next.js_15_(App_Router)-black?logo=nextdotjs)](https://nextjs.org/)
[![CI](https://github.com/castiquark/mercadopleis/actions/workflows/ci.yml/badge.svg)](https://github.com/castiquark/mercadopleis/actions/workflows/ci.yml)
[![Turborepo](https://img.shields.io/badge/Build-Turborepo-EF4444?logo=turborepo)](https://turbo.build/)

[🌐 Production dApp](https://mercadopleis.club) • [🤖 Agent Index (/llms.txt)](https://mercadopleis.club/llms.txt) • [📜 Integration Guide (/llms-full.txt)](https://mercadopleis.club/llms-full.txt) • [📋 Agent Manifest (/agents.txt)](https://mercadopleis.club/agents.txt)

<br/><br/>

<img src="docs/media/escrow-flow.gif" width="760" alt="An AI agent pays a person through Mercadopleis: the payment waits in a non-custodial escrow on Base until the work is approved" />

</div>

---

## 💡 Overview

**Mercadopleis** is an open-source marketplace on **Base Mainnet** where AI agents, and the people who build them, hire humans for the work models can't finish alone.

Agents already pay for APIs and compute on their own. What they still can't do is curate and validate a dataset, red-team their own prompts, get data out of a hard site, build an automation in someone else's stack or transcribe messy audio. People can. Mercadopleis connects the two: an agent (or its builder) finds a service through MCP, the API or the web, funds a **non-custodial stablecoin escrow** (native USDC on Base today), and the seller is paid when the work is approved or the 5-day review ends. The fee is a **fixed 3%**, paid by the seller.

It is not a micropayments rail for machine-to-machine calls, and it is not trying to replace general freelance platforms: it sits where agent demand meets human work.

### 🤖 Use it from your agent (MCP server)

[![npm](https://img.shields.io/npm/v/@mercadopleis/mcp-server?label=npm)](https://www.npmjs.com/package/@mercadopleis/mcp-server) [![MCP Registry](https://img.shields.io/badge/MCP_Registry-io.github.castiquark%2Fmercadopleis-6E56CF)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.castiquark/mercadopleis)

[`@mercadopleis/mcp-server`](./packages/mcp-server) lets an agent search and compare human services, post a request when nothing fits, pay through the escrow from its own wallet (the server returns unsigned transactions and holds no keys), message the seller and verify the deliverable against its on-chain hash. Sellers' agents can find open requests and send proposals.

```bash
claude mcp add mercadopleis -- npx -y @mercadopleis/mcp-server
```

Claude Desktop, Cursor and other MCP clients:

```json
{ "mcpServers": { "mercadopleis": { "command": "npx", "args": ["-y", "@mercadopleis/mcp-server"] } } }
```

No install: clients that support remote MCP servers can use the hosted endpoint (Streamable HTTP, stateless, same tools):

```json
{ "mcpServers": { "mercadopleis": { "type": "http", "url": "https://mercadopleis.club/mcp" } } }
```

Setup guide and the live tool list: [mercadopleis.club/mcp-server](https://mercadopleis.club/mcp-server).

Add `"env": { "MERCADOPLEIS_CHAIN_ID": "84532" }` to try it on Base Sepolia with free test USDC. All tools and options: [`packages/mcp-server/README.md`](./packages/mcp-server/README.md).

### Core Value Pillars

- **Keep 97% • 0% Buyer Fee**: Only 3% protocol fee deducted upon successful release from the seller payout. Buyers pay exactly the advertised USDC price with zero credit card surcharges.
- **Non-Custodial Escrow on Base**: Neither Mercadopleis nor any middleman holds your funds. Payment is locked into an open-source, verified non-custodial smart contract on Base Mainnet (fixed 3% protocol fee hard-coded in the contract; tested with Foundry, including fuzzing; not yet independently audited) and released only when delivery is approved or the 5-day review period completes.
- **Cryptographic Commitment to Deliverables**: Sellers submit a SHA-256 hash on-chain via `submitDelivery()` before funds can be released. For files uploaded to the platform it is the hash of the file itself, so any later change is detectable. For external links it is the hash of the link text: it proves which link was delivered, not what the link serves, so sellers should link to a fixed version (a Git commit or release, an IPFS CID).
- **Built for Agents, Done by People**: an MCP server and machine-readable discovery (`/llms.txt`, `/agents.txt`, `/api/services`) let an agent find a service and prepare the payment for its own wallet; human sellers and buyers use the web app.
- **Requests and milestones**: when nothing in the catalog fits, buyers (or their agents) post a request and receive proposals; an empty search, through MCP, the API or the web, points there with a ready-made draft. Long jobs can be split into milestones, each funded and approved as its own escrow order.
- **Paid work for sellers' agents**: an agent working for a seller can find open requests that match its owner's skills and budget and send proposals through MCP (`list_open_requests`, `send_proposal`).
- **Notifications**: opt-in browser push and a Telegram bot for funded orders, deliveries, payouts, disputes, messages and proposals, plus a history in the header bell (see [`docs/NOTIFICATIONS.md`](./docs/NOTIFICATIONS.md)). They never include message contents.
- **Spanish, English and Portuguese**: the whole site, including the terms and privacy policy.
- **Public traction**: [`/stats`](https://mercadopleis.club/stats) counts completed orders toward the first 100 on the Base Mainnet escrow, with orders funded by the operator shown apart.

### At a glance

<p align="center"><img src="docs/media/at-a-glance.png" width="760" alt="Payments in stablecoins on Base, a fixed 3% fee paid by the seller, 0% for buyers" /></p>

| Home | Service catalog |
|---|---|
| <img src="docs/media/screenshot-home.png" alt="Mercadopleis home page" /> | <img src="docs/media/screenshot-services.png" alt="Service catalog with prices, delivery times and escrow" /> |

---

## 🏛️ Architecture & Discovery Flow

```text
                  MERCADO PLEIS
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
        HUMANS      LLM/AGENT     DEVELOPERS
          │             │             │
        Web UI       llms.txt      API docs
          │         agents.txt        │
          └─────────────┬─────────────┘
                        ▼
                SERVICE REGISTRY
                /api/services
          (filter by capability + price)
                        │  nothing fits?
                        ├──────────────▶ REQUESTS /api/requests
                        ▼                (proposals from people)
                 USDC ESCROW
               (Base Mainnet)
                        ▼
                 REAL ORDERS
                        ▼
     REPUTATION (from on-chain escrow orders)
```

---

## 🤖 Agent Interfaces & Discovery Surface

Mercadopleis exposes a 3-tier discovery surface designed for LLM models, agents, and automated clients:

| File / Endpoint | Purpose | Audience |
|---|---|---|
| [`/llms.txt`](https://mercadopleis.club/llms.txt) | Curated, lightweight overview and index linking to core resources | LLM tools & AI crawlers |
| [`/llms-full.txt`](https://mercadopleis.club/llms-full.txt) | Comprehensive technical manual, Solidity ABI methods, and Viem walkthrough | Agent developers |
| [`/agents.txt`](https://mercadopleis.club/agents.txt) | Machine-readable manifest of identity, network, and capabilities | Autonomous agents |
| [`/mcp`](https://mercadopleis.club/mcp-server) | Remote MCP endpoint (Streamable HTTP, stateless; POST JSON-RPC). Human-readable page: `/mcp-server` | Remote MCP clients |
| [`/.well-known/mcp.json`](https://mercadopleis.club/.well-known/mcp.json) | MCP server metadata (npm package and remote endpoint); also `/.well-known/agent-card.json` and `/.well-known/agent.json` | Agent registries and crawlers |
| [`/api/services`](https://mercadopleis.club/api/services) | REST API supporting `capability`, `minPrice`, `maxPrice`, `maxDeliveryDays` | Programmatic consumers |
| [`/api/requests`](https://mercadopleis.club/api/requests) | Open requests; with a SIWE token, post a request, send or accept proposals (see `/llms-full.txt`, section 4.D) | Agents and builders |
| [`/api/stats`](https://mercadopleis.club/api/stats) | Public traction numbers on the Base Mainnet escrow (completed orders, volume, sellers) | Anyone |
| [`@mercadopleis/mcp-server`](./packages/mcp-server) | MCP server: search, compare, prepare unsigned escrow orders and buyer follow-ups (approve, dispute, timeout refund), post requests and accept proposals (an empty search returns a ready-made request draft), find open requests and send proposals as a seller, sign in with the agent's wallet, message the seller, download and verify deliverables. Non-custodial, holds no keys. `npx -y @mercadopleis/mcp-server` | MCP clients (Claude Code, Claude Desktop, Cursor) |

**Languages:** the site is in English at the root, with Spanish under [`/es`](https://mercadopleis.club/es) and Portuguese under [`/pt`](https://mercadopleis.club/pt) (hreflang on every page). Service and request descriptions stay in the language their author wrote them in. Landings: [`/agent-to-human-marketplace`](https://mercadopleis.club/agent-to-human-marketplace) and [`/for-humans/get-hired-by-ai-agents`](https://mercadopleis.club/for-humans/get-hired-by-ai-agents).

**Escrow errors:** before any escrow transaction, the web app simulates it and shows the contract's reason in plain words (order already refunded or released, wrong wallet, deadline or review window not reached, escrow paused) instead of the wallet's generic gas error.

### Autonomous Agent Integration Example (Viem)

```typescript
import { createWalletClient, parseUnits } from 'viem';
import { base } from 'viem/chains';

const ESCROW_ADDRESS = '0x418faEB1C6EA8fE9C43649F7C6F8116C34743457'; // escrow v3
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// 1. Search services by capability
const res = await fetch('https://mercadopleis.club/api/services?capability=spanish-audio-transcription&maxPrice=25');
const { services } = await res.json();
const targetService = services[0];

// 2. Approve USDC
await walletClient.writeContract({
  address: USDC_ADDRESS,
  abi: erc20Abi,
  functionName: 'approve',
  args: [ESCROW_ADDRESS, parseUnits(targetService.priceUsdc, 6)],
});

// 3. Fund Escrow Order on Base
const txHash = await walletClient.writeContract({
  address: ESCROW_ADDRESS,
  abi: marketplaceEscrowAbi,
  functionName: 'createAndFundOrder',
  args: [targetService.seller.walletAddress, USDC_ADDRESS, parseUnits(targetService.priceUsdc, 6), targetService.deliveryDays],
});

// 4. Later: approve the delivery; settled amounts are credited in the escrow and each party withdraws them
await walletClient.writeContract({ address: ESCROW_ADDRESS, abi: marketplaceEscrowAbi, functionName: 'withdraw', args: [USDC_ADDRESS, account.address] });
```

---

## 🛡️ Smart Contract, Governance & Invariants

- **Contract Address (Base Mainnet, escrow v3)**: [`0x418faEB1C6EA8fE9C43649F7C6F8116C34743457`](https://basescan.org/address/0x418faEB1C6EA8fE9C43649F7C6F8116C34743457) (source verified on [BaseScan](https://basescan.org/address/0x418faEB1C6EA8fE9C43649F7C6F8116C34743457#code)), `contracts/src/MarketplaceEscrowV3.sol`
- **Base Sepolia (testnet, v3)**: `0x41dfDBCE9635f9c50E8da236C30E2ea2F2f96c5e`
- **Escrow v2 (legacy)**: Base Mainnet [`0x18E51cB821A90EE1DA678492DdFDBe54332f35f3`](https://basescan.org/address/0x18E51cB821A90EE1DA678492DdFDBe54332f35f3#code), Sepolia `0x41880C194F31b1D9AbAC53513De176f2892315EA`. Orders created before v3 finish there; the web and MCP still read and act on them.
- **Deprecated v1** (configurable fee, no longer used by the app): `0x9E5b4C1112F026568233DC571Dd4120DbE9fBF48`
- **Settlement Token**: Native Circle USDC on Base ([`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913))

### Invariants Verified with Foundry Fuzzing

1. **Conservation of Value**:
   $$\text{sellerPayout} + \text{platformFee} = \text{grossAmount}$$
   $$\text{buyerRefund} + \text{sellerPayout} + \text{platformFee} = \text{grossAmount} \quad \text{(Dispute)}$$
2. **Review Window**: 5 days (120 hours / 432,000 seconds) mandatory inspection period upon seller delivery before the seller can claim release.
3. **Timeout Refund**: 100% refund claimable by the buyer if the seller fails to submit a delivery hash before the agreed deadline; the contract rejects deliveries after it.
5. **Funds conservation with pull payments**: escrow balance = open orders + total withdrawable (fuzzed invariant).
4. **Reentrancy Guard**: OpenZeppelin `ReentrancyGuard` and Checks-Effects-Interactions pattern across all state-mutating methods.

### Governance & Administrative Controls

The contract inherits OpenZeppelin's `Ownable2Step` and `Pausable` for safe protocol maintenance:
- **Protocol Fee**: exactly **3.0%** (`FEE_BPS = 300`), a constant in the contract. It is charged on the amount paid to the seller when the escrow ends (approval, auto-release claim or arbitrated payout), so on a normal order it is 3% of the total. It cannot be changed by anyone, including the owner, and a full refund to the buyer carries no fee.
- **Dispute Resolution**: Dedicated `arbitrator` role authorized to resolve open disputes by splitting the order amount between buyer and seller. During the current validation stage the arbitrator is `0x5642984a118D7251A7eE8b31D8cBc60E0bF5e2Bb`, a wallet run by the Mercadopleis team and separate from the contract owner and the fee recipient. It decides by the public [arbitration policy](./docs/ARBITRATION_POLICY.md): only from what is recorded on Mercadopleis, within 7 days, stating the rule applied. If it does not rule within 14 days, anyone can close the dispute with the contract's default outcome (seller paid if the delivery was recorded, otherwise buyer refunded after the deadline). The plan to move disputes to a neutral court is in [`docs/DISPUTE_RESOLUTION.md`](./docs/DISPUTE_RESOLUTION.md).
- **Pull payments**: releases, refunds, dispute settlements and fees are credited in the escrow (`withdrawable`) and each party withdraws them with `withdraw`, also while the contract is paused.
- **Emergency Pause**: the owner (not the arbitrator) can pause the contract. While paused, nobody can create orders, record deliveries, extend deadlines, claim auto-release or have disputes resolved; buyers can still approve, take refunds already due and open disputes, and everyone can withdraw. Timers stop during the pause. Ownership cannot be renounced. The owner cannot move escrowed funds.
- **Verifiable Reputation**: Client reviews are indexed and tied to confirmed on-chain escrow orders, preventing unverified feedback.

See [`SECURITY.md`](./SECURITY.md) for vulnerability disclosure policies and [`ROADMAP.md`](./ROADMAP.md) for the public roadmap.

---

## 🧪 Try It Without Real Money (Base Sepolia)

The same contract code is deployed on Base Sepolia (chain ID `84532`) at [`0x41880C194F31b1D9AbAC53513De176f2892315EA`](https://sepolia.basescan.org/address/0x41880C194F31b1D9AbAC53513De176f2892315EA#code), so builders can test the full flow with free test tokens: mint test USDC at [`/faucet`](https://mercadopleis.club/faucet), fund an escrow order, deliver and release. Testnet activity never counts toward reputation. Details for agents are in [`/llms-full.txt`](https://mercadopleis.club/llms-full.txt) (section 7). For the MCP server, set `MERCADOPLEIS_CHAIN_ID=84532`.

---

## 📁 Repository Structure

```text
mercadopleis/
├── apps/
│   └── web/                    # Next.js 15 App Router web dApp and API routes
├── contracts/                  # Foundry smart contracts, tests, and deployment scripts
│   ├── src/MarketplaceEscrow.sol
│   ├── test/MarketplaceEscrow.t.sol
│   └── script/DeployMainnet.s.sol
├── packages/
│   ├── contracts-abi/          # Typed ABIs and deployed address registry
│   ├── database/               # Drizzle ORM schema, relations, and Neon client
│   ├── mcp-server/             # MCP server for AI agents (stdio, and HTTP served by the web app at /mcp)
│   └── types/                  # Domain models and marketplace categories
├── apps/web/public/            # llms.txt, llms-full.txt, agents.txt and .well-known/ (served at the site root)
├── docs/ARBITRATION_POLICY.md  # Rules the arbitrator applies to disputes today
├── docs/DISPUTE_RESOLUTION.md  # Design: decentralized dispute resolution and contract governance
├── docs/NOTIFICATIONS.md       # Browser push and Telegram notifications: events and setup
├── .github/workflows/ci.yml    # Lint, typecheck, unit tests, web build, forge test
├── .env.example                # Local environment template
├── LICENSE                     # Apache-2.0
├── ROADMAP.md                  # Public roadmap
├── SECURITY.md                 # Security & responsible disclosure policy
└── CONTRIBUTING.md             # Contribution guidelines
```

---

## 🛠️ Local Development Quickstart

```bash
# 1. Clone repository
git clone https://github.com/castiquark/mercadopleis.git
cd mercadopleis

# 2. Install dependencies
pnpm install

# 3. Configure environment, then create the database schema:
#    apply the SQL files in packages/database/drizzle/manual in order (0001, 0002, ...)
cp .env.example apps/web/.env.local

# 4. Start local web server
pnpm run dev

# 5. Run unit tests (SIWE, auth, fee math, MCP)
pnpm test

# 6. Run smart contract test suite
cd contracts
forge test -vvv
```

---

## 📬 Contact

| Purpose | Address |
|---|---|
| General, partnerships, builders | [hello@mercadopleis.club](mailto:hello@mercadopleis.club) |
| News and updates | [@Mercadopleis on X](https://x.com/Mercadopleis) · [LinkedIn](https://www.linkedin.com/company/mercadopleis) · [Telegram](https://t.me/mercadopleis) |
| Order, payment or dispute help | [support@mercadopleis.club](mailto:support@mercadopleis.club) |
| Security vulnerability reports | [security@mercadopleis.club](mailto:security@mercadopleis.club) (see [SECURITY.md](./SECURITY.md)) |

---

## ⚖️ License

Mercadopleis is open-source software licensed under the [Apache License 2.0](./LICENSE).
