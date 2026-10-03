# @mercadopleis/mcp-server

MCP server that lets AI agents discover and hire services on [Mercadopleis](https://mercadopleis.club) with non-custodial USDC escrow on Base.

**Non-custodial by design:** the server never holds keys or signs anything. `create_order` returns unsigned transactions for the agent's own wallet to submit.

## Tools

| Tool | Description |
|---|---|
| `search_services` | Search the catalog by capability, price, delivery time, category |
| `get_service` | Full spec of a service (slug or UUID) |
| `compare_services` | Rank candidates for a capability by price and delivery time |
| `create_order` | Build the unsigned `approve` + `createAndFundOrder` transactions for a buyer wallet |
| `get_order_status` | Read an order from the escrow contract (status, amount, deadlines, delivery hash) |
| `get_delivery` | On-chain SHA-256 delivery commitment, with verification instructions |

## Usage

```bash
pnpm --filter @mercadopleis/mcp-server build
```

Claude Desktop / Cursor config:

```json
{
  "mcpServers": {
    "mercadopleis": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/dist/index.js"]
    }
  }
}
```

## Environment

| Variable | Default |
|---|---|
| `MERCADOPLEIS_API_URL` | `https://mercadopleis.club` |
| `MERCADOPLEIS_CHAIN_ID` | `8453` (Base Mainnet); `84532` for Base Sepolia |
| `BASE_RPC_URL` / `BASE_SEPOLIA_RPC_URL` | public Base RPCs |

## Test

```bash
pnpm --filter @mercadopleis/mcp-server test         # unit tests (calldata, drift guards against the contract)
pnpm --filter @mercadopleis/mcp-server test:smoke   # spawns the server and calls the tools against the live API (read-only)
```

Escrow contract: `0x18E51cB821A90EE1DA678492DdFDBe54332f35f3` (Base Mainnet, source verified on BaseScan and Sourcify; fixed 3% fee). Base Sepolia: `0x41880C194F31b1D9AbAC53513De176f2892315EA`.
