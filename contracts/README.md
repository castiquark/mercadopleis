# Contracts

Foundry workspace for the Mercadopleis escrow.

| Contract | Network | Address |
|---|---|---|
| `MarketplaceEscrow` (v2, fixed 3% fee) | Base Mainnet (`8453`) | [`0x18E51cB821A90EE1DA678492DdFDBe54332f35f3`](https://basescan.org/address/0x18E51cB821A90EE1DA678492DdFDBe54332f35f3#code) |
| `MarketplaceEscrow` (v2) | Base Sepolia (`84532`) | [`0x41880C194F31b1D9AbAC53513De176f2892315EA`](https://sepolia.basescan.org/address/0x41880C194F31b1D9AbAC53513De176f2892315EA#code) |

- `src/MarketplaceEscrow.sol`: the escrow (order funding, delivery hash, approval, 5-day auto-release, timeout refund, disputes resolved by the arbitrator).
- `src/EscrowAdmin.sol`: owner contract that splits the escrow's powers (a guardian can only pause; every other change goes through a timelock). Written and tested, not deployed yet: the deployer wallet keeps these roles during the validation stage.
- `src/MockUSDC.sol`, `src/MockStablecoin.sol`: test tokens for testnets.
- `test/`: unit and fuzz tests (fee math, conservation of value, dispute splits).
- `script/`: deployment scripts (`DeployMainnet.s.sol`, `DeployEscrowTestnet.s.sol`, `DeployEscrowAdmin.s.sol`, `DeployMarketplaceEscrow.s.sol`).

```shell
forge build
forge test -vvv
```

The design of decentralized dispute resolution is in [`../docs/DISPUTE_RESOLUTION.md`](../docs/DISPUTE_RESOLUTION.md); security policy in [`../SECURITY.md`](../SECURITY.md).
