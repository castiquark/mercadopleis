# Deploy checklist — Netlify quota resets 14 Oct 2026

Internal. Not for the public repo.

Production is at `main@574ba40`; `main` is ~20 commits ahead. The DB schema in Neon (project `mercadopleis`, `round-wave-03893831`) already matches the new code, except for the one migration below.

## 0. Before the day (can be done now)

- [ ] `pnpm --filter @mercadopleis/web build` and `forge test` pass (done 1 Oct; repeat after any new change)
- [ ] Decide if Vercel/Render is wanted instead of waiting (if so, replace the Netlify plugin config and move env vars + domain)

## 1. Environment variables (Netlify → Site settings)

- [ ] `JWT_SECRET` is **at least 32 chars** and random (`openssl rand -hex 32`). The new code **refuses to sign or verify tokens in production** otherwise, so auth would break. A rotation logs everyone out; that is acceptable.
- [ ] `DATABASE_URL` (Neon), unchanged
- [ ] `BASE_MAINNET_RPC_URL` set to a reliable RPC (a dedicated provider; the public one rate-limits the indexer)
- [ ] `BASE_SEPOLIA_RPC_URL` (only needed for testnet orders)
- [ ] `MARKETPLACE_ESCROW_ADDRESS` = `0x9E5b4C1112F026568233DC571Dd4120DbE9fBF48` (optional; default is the same)
- [ ] `NEXT_PUBLIC_CHAIN_ID` = `8453` (or unset; defaults to mainnet)
- [ ] `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is your own project id (the code falls back to a hardcoded one)
- [ ] Storage vars unchanged: `NEON_STORAGE_*` or `STORAGE_*`

## 2. Database

- [ ] Apply `packages/database/drizzle/manual/0001_orders_unique_per_chain.sql` in Neon (idempotent, safe before or after the deploy). It replaces the global unique on `contract_order_id` with `(chain_id, contract_order_id)`, so Sepolia test ids 2–4 cannot collide with mainnet ids.
- [ ] Verify afterwards: index `orders_chain_contract_order_unique` exists and constraint `orders_contract_order_id_unique` is gone.
- [ ] Optional cleanup (ask first, destructive): 3 Sepolia test orders, 2 test reviews, 8 inactive test services, test user accounts created by RBAC scripts.

## 3. Deploy

- [ ] Netlify build uses the command in `netlify.toml` (types → contracts-abi → web)
- [ ] Deploy succeeds; note the deploy id

## 4. Smoke tests right after deploy (read-only)

- [ ] `GET /api/health` → 200
- [ ] `GET /api/services` → 5 active services, Base Mainnet, chainId 8453
- [ ] `GET /api/auth/nonce?address=…` returns a nonce (now stored in Postgres)
- [ ] `GET /api/auth/me` without a token → 401
- [ ] `POST /api/upload` without auth → 401 (was open before)
- [ ] `GET /api/orders/my?address=0x…` without a token → 401 (fixed 1 Oct; it used to list any wallet's orders incl. delivery links)
- [ ] Orders page: a wallet that has NOT signed in (SIWE) sees only local orders; confirm the UI makes the sign-in step obvious
- [ ] Token signed with the old default secret is rejected (`/api/auth/me` → 401)
- [ ] `GET /api/sync` → 200; `blockchain_transactions` now has a checkpoint row for chain 8453 (cursor starts here)
- [ ] `/llms-full.txt` shows `submitDelivery` (not `deliverOrder`)
- [ ] Sign-in with wallet works end to end (SIWE with strict domain check on `mercadopleis.club`)

## 5. Full flow on Base Sepolia (before real money)

- [ ] Buyer wallet with test USDC (`/faucet`), different from the seller wallet
- [ ] Fund order → order appears in `/orders` (status FUNDED)
- [ ] Seller submits delivery (hash) → DELIVERED
- [ ] Buyer approves → RELEASED, 97%/3% split correct
- [ ] Open a dispute on a second order → arbitrator resolves from `/admin/disputes`
- [ ] Calling an action **without a wallet connected** shows the "connect your wallet" error and sends nothing
- [ ] Wrong network shows the right BaseScan links and labels
- [ ] Builder Code: the funding tx input data ends with `…0b0080218021802180218021802180218021` on sepolia.basescan.org
- [ ] `e2e-acceptance-test.ts` and `test-rbac-matrix.ts` pass against the deployed app

## 6. After the first real mainnet order

- [ ] Order shows up via the indexer (`/api/sync`) and in `/orders`
- [ ] base.dev → Onchain activity shows the attributed transaction
- [ ] Set a **payout address** for the Builder Code in base.dev (none was registered yet)

## 7. Then (Phase 2 continues)

- [ ] Record the demo video (`VIDEO_DEMO_SCRIPT.md`)
- [ ] Publish `@mercadopleis/mcp-server` (needs the npm scope) or announce it as clone-and-run
- [ ] Catalog stays at 5 services for now; more services after launch
- [ ] Apply to the Base Grant Program (Agents / commerce) once there is at least one real attributed order
- [ ] Update `PRODUCT_STATUS.md` (Netlify auto-deploy note, seed data note)

## Known open items

- `/api/sync` is public and unauthenticated (idempotent, reads chain state). Consider rate limiting or a shared secret.
- Wagmi 2.19 has no global `dataSuffix`; new escrow writes must pass `BUILDER_DATA_SUFFIX` explicitly.
- `apps/api` (legacy standalone indexer) still matches orders by `contractOrderId` only. Not deployed.
- `contracts/lib` vendors OpenZeppelin and forge-std (1000+ files) instead of using submodules.
- Past commits still contain the removed internal docs and the GTM plan in git history.
- Public RPC for the wallet UI: `NEXT_PUBLIC_BASE_RPC` defaults to `mainnet.base.org`.
