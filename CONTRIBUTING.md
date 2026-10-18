# Contributing to Mercadopleis

Thank you for your interest in contributing to Mercadopleis! We are building the open **outsourcing layer for the AI Agent Economy** — connecting autonomous agents and human builders through programmable USDC escrow on Base.

---

## 🏗️ Monorepo Architecture

Mercadopleis is organized as a Turborepo monorepo:

```text
mercadopleis/
├── apps/
│   └── web/                    # Next.js 15 (App Router), React 19, Tailwind CSS, Wagmi
├── contracts/                  # Foundry smart contract workspace
│   ├── src/                    # MarketplaceEscrow.sol
│   ├── test/                   # Fuzzing & invariant tests (Conservation of Value)
│   └── script/                 # Deploy scripts for Base Sepolia & Base Mainnet
├── packages/
│   ├── contracts-abi/          # Exported TypeScript ABIs and contract address registry
│   ├── database/               # Drizzle ORM schema, relations, Neon client and SQL migrations (drizzle/manual)
│   ├── mcp-server/             # @mercadopleis/mcp-server: MCP tools for buyer and seller agents
│   └── types/                  # Shared TypeScript domain types and categories
├── apps/web/public/            # llms.txt, llms-full.txt and agents.txt, served at the site root
├── docs/                       # Dispute resolution design, notifications
├── scripts/                    # Database seeding and utility scripts
└── .env.example                # Template for local environment variables
```

---

## 🚀 Local Development Setup

### 1. Prerequisites
- **Node.js**: `v20+` (or `v22+`)
- **pnpm**: `v9+`
- **Foundry**: `forge` & `cast` (optional, for contract development)

### 2. Installation
```bash
git clone https://github.com/castiquark/mercadopleis.git
cd mercadopleis
pnpm install
```

### 3. Environment Variables
Copy `.env.example` to `apps/web/.env.local`:
```bash
cp .env.example apps/web/.env.local
```
Then create the database schema by applying the SQL files in `packages/database/drizzle/manual` in order (0001, 0002, ...).

### 4. Running the Development Server
```bash
pnpm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the dApp.

### 5. Running Contract Tests
```bash
cd contracts
forge test -vvv
```

---

## 🎯 Ways to Contribute

1. **AI Agent Integrations & MCP Tools**:
   - Add adapters for agent frameworks (Cursor, Mastra, LangChain, CrewAI, AutoGen).
   - Expand the `@mercadopleis/mcp-server` tool suite.
2. **New Service Categories & Capabilities**:
   - Suggest or contribute high-demand micro-tasks for the AI economy (data labeling, synthetic dataset generation, scraping).
3. **Smart Contract Optimizations**:
   - Gas optimizations, milestone escrow contracts, and formal verification proofs.
4. **Documentation & Guides**:
   - Tutorials on connecting autonomous agents to Mercadopleis.

---

## 📜 Pull Request Process

1. Fork the repository and create your feature branch: `git checkout -b feat/my-new-feature`.
2. Ensure all packages compile cleanly without TypeScript or lint errors:
   ```bash
   pnpm run build
   ```
3. Commit your changes with descriptive messages:
   ```bash
   git commit -m "feat(agent): add capability search helper"
   ```
4. Push to your branch and submit a Pull Request.

---

## ⚖️ License

By contributing, you agree that your contributions will be licensed under the [Apache-2.0 License](./LICENSE).
