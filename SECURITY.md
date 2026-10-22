# Security Policy

## Reporting a Vulnerability

Security is paramount for Mercadopleis. The protocol handles real-value escrow transactions settled in Circle USDC on Base Mainnet.

If you discover a security vulnerability or exploit vector in our smart contracts, API endpoints, or reference frontend, please report it immediately through responsible disclosure:

- **Email**: `security@mercadopleis.club` (or open a confidential GitHub Security Advisory)
- **Subject**: `[SECURITY VULNERABILITY] <Component>: <Short Description>`
- **Response Target**: Within 48 hours for triage and initial assessment.

Please **do not** disclose vulnerabilities publicly or discuss them on public forums until a fix or mitigation has been deployed.

---

## Scope & Deployed Assets

| Component | Network | Address / URL | Status |
|---|---|---|---|
| `MarketplaceEscrow.sol` (v2, fixed 3% fee) | Base Mainnet (`8453`) | [`0x18E51cB821A90EE1DA678492DdFDBe54332f35f3`](https://basescan.org/address/0x18E51cB821A90EE1DA678492DdFDBe54332f35f3) | Production (verified on BaseScan and Sourcify) |
| `MarketplaceEscrow.sol` (v2, fixed 3% fee) | Base Sepolia (`84532`) | `0x41880C194F31b1D9AbAC53513De176f2892315EA` | Testnet |
| `MarketplaceEscrow.sol` (v1, deprecated) | Base Mainnet / Sepolia | `0x9E5b4C1112F026568233DC571Dd4120DbE9fBF48` | Not used by the app |
| Web Application & API | Netlify Edge | `https://mercadopleis.club` | Production |

---

## Formal Invariants & Contract Guarantees

Our smart contract suite undergoes automated invariant testing and fuzzing with Foundry:

1. **Conservation of Value**:
   ```solidity
   sellerPayout + platformFee == grossAmount
   buyerRefund + sellerPayout + platformFee == grossAmount (dispute resolution)
   ```
   No funds can be locked in limbo or lost to rounding dust.
2. **Review Window Protection**:
   A mandatory 5-day (432,000 seconds) inspection period begins when the seller marks an order delivered. Funds cannot be auto-released prior to this window.
3. **Timeout Refund**:
   If the deadline passes and the seller has not recorded a delivery hash, the buyer can reclaim 100% of the deposited USDC via `claimTimeoutRefund()`.
   **Known limitation of the current contract (v2):** `submitDelivery()` does not check the deadline, so a seller can still record a delivery after it as long as the buyer has not claimed the refund, and either party can open a dispute on a funded order. In both cases the refund is no longer automatic and goes to the arbitrator. Under rule 2 of the [arbitration policy](./docs/ARBITRATION_POLICY.md), a delivery submitted after the deadline counts as not delivered (unless the buyer accepted a new date in the order chat in time), so the buyer gets a full refund. A disputed order has no on-chain timeout in v2; the policy commits the arbitrator to resolve within 7 days. Contract v3, in progress, enforces the deadline in `submitDelivery()`, lets only the buyer dispute a funded order and adds a dispute timeout.
4. **Reentrancy Protection**:
   All state changes precede token transfers following the Checks-Effects-Interactions pattern and OpenZeppelin `ReentrancyGuard`.
