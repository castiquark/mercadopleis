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
| `MarketplaceEscrowV3.sol` (v3, fixed 3% fee, pull payments) | Base Mainnet (`8453`) | [`0x418faEB1C6EA8fE9C43649F7C6F8116C34743457`](https://basescan.org/address/0x418faEB1C6EA8fE9C43649F7C6F8116C34743457) | Production for new orders (verified on BaseScan) |
| `MarketplaceEscrowV3.sol` (v3) | Base Sepolia (`84532`) | `0x41dfDBCE9635f9c50E8da236C30E2ea2F2f96c5e` | Testnet |
| `MarketplaceEscrow.sol` (v2, fixed 3% fee) | Base Mainnet (`8453`) | [`0x18E51cB821A90EE1DA678492DdFDBe54332f35f3`](https://basescan.org/address/0x18E51cB821A90EE1DA678492DdFDBe54332f35f3) | Legacy: orders created before v3 finish here |
| `MarketplaceEscrow.sol` (v2) | Base Sepolia (`84532`) | `0x41880C194F31b1D9AbAC53513De176f2892315EA` | Legacy testnet |
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
3. **Deadlines and timeout refund (v3)**:
   `submitDelivery()` reverts after the delivery deadline (`DeadlinePassed`); only the buyer can extend it (`extendDeadline`). If the deadline passes with no delivery, the buyer reclaims 100% of the deposit via `claimTimeoutRefund()`. Only the buyer can dispute a funded order; the seller can dispute only after delivering.
4. **Every dispute ends**:
   If the arbitrator does not rule within 14 days (`DISPUTE_TIMEOUT`), anyone can call `claimDisputeTimeout()`: with a recorded delivery the seller is paid (minus the 3% fee); without one the buyer is refunded once the delivery deadline has passed. The arbitrator applies the public [arbitration policy](./docs/ARBITRATION_POLICY.md).
5. **Pull payments**:
   Releases, refunds, dispute settlements and fees are credited to `withdrawable(token, account)`; each party calls `withdraw(token, to)`. A blocked or reverting recipient cannot stall a settlement, and `withdraw` works while the contract is paused. Invariant: escrow balance = open orders + total withdrawable.
6. **Pause freezes the clock**:
   Deadlines, review windows and dispute timeouts stop while paused (`effectiveDeadline`, `effectiveAutoReleaseTime`, `disputeTimeoutAt`). A pause blocks new orders, deliveries, extensions, auto-release claims and arbitration, but not buyer approvals, refunds already due, buyer disputes or withdrawals. `renounceOwnership()` is disabled.
7. **Reentrancy Protection**:
   All state changes precede token transfers following the Checks-Effects-Interactions pattern and OpenZeppelin `ReentrancyGuard`.
