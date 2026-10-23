# Arbitration policy

**Applies to:** disputes on the Mercadopleis escrows on Base: v3 (`0x418faEB1C6EA8fE9C43649F7C6F8116C34743457`, new orders) and v2 (`0x18E51cB821A90EE1DA678492DdFDBe54332f35f3`, orders created before v3).
**Arbitrator:** `0x5642984a118D7251A7eE8b31D8cBc60E0bF5e2Bb`, operated by the Mercadopleis team during the validation stage. It is a different wallet from the contract owner and the fee recipient.
**Status:** in force from the date the arbitrator role is set on-chain. The longer-term plan to move disputes to a neutral court is in [DISPUTE_RESOLUTION.md](./DISPUTE_RESOLUTION.md).

The arbitrator decides only from what is recorded on Mercadopleis: the service or request description, the agreed price and deadline, the order chat, and the delivered file whose hash is stored on-chain. Nothing agreed outside the platform counts.

## Rules

1. **Delivered on time and it matches what was agreed:** the seller is paid in full.
2. **Not delivered by the deadline:** the buyer gets a full refund. A delivery submitted after the deadline counts as not delivered, unless the buyer accepted a new date in the order chat before the deadline passed.
3. **The delivery does not match the recorded hash, is empty, or is clearly unrelated to the order:** the buyer gets a full refund.
4. **Delivered on time but only partly done:** the amount is split in proportion to what was delivered, measured against the description. If the parts cannot be told apart, the split is 50/50.
5. **A dispute opened by the seller before any delivery:** it is treated as rule 2 once the deadline has passed. Before the deadline, the order goes back to the parties to deliver or cancel.
6. **Disagreement about quality, not about what was agreed:** if the delivery meets the description, rule 1 applies. Requirements the buyer did not write down are not grounds for a refund.

The 3% protocol fee is charged only on the amount paid to the seller. A full refund to the buyer carries no fee.

## Process and timing

- Either party opens the dispute from the order page or through the MCP server.
- Within **48 hours** the arbitrator may ask both parties for more information in the order chat.
- The arbitrator resolves within **7 days** of the dispute being opened.
- Each decision states which rule was applied.
- There is no appeal during the validation stage.

## What the contract does if the arbitrator does not rule (escrow v3)

If the arbitrator has not ruled 14 days after the dispute was opened (the clock stops while the contract is paused), anyone can close it with the default outcome: if the seller recorded a delivery, the seller is paid in full minus the 3% fee; if not, the buyer gets a full refund, but only once the delivery deadline has passed. A buyer who disputes a funded order with a long deadline therefore waits for that deadline (up to 365 days) unless the arbitrator rules first. The arbitrator's decision, when it comes, replaces the default.

## Conflicts of interest

If the arbitrator or the Mercadopleis team is the buyer or the seller in a disputed order, the decision is published with its reasoning, and it leans to the other party whenever the case is unclear.
