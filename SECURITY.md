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
3. **Timeout Refund Guarantee**:
   If a seller fails to submit a delivery hash before the agreed deadline, the buyer can reclaim 100% of their deposited USDC via `claimTimeoutRefund()`.
4. **Reentrancy Protection**:
   All state changes precede token transfers following the Checks-Effects-Interactions pattern and OpenZeppelin `ReentrancyGuard`.
