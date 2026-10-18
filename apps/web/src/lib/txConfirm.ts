// Waits for a wallet transaction before telling the API about it, and returns the hash that actually landed.
// Smart accounts (EIP-7702, ERC-4337) and relayers can report one hash and land the call under another, or take
// longer than the API waits. If the receipt does not show up in time, the original hash is returned and the API
// falls back to reading the order from the contract.
import type { PublicClient } from 'viem';

export class TxRevertedError extends Error {
  constructor(readonly hash: string) {
    super(`Transaction ${hash} reverted on-chain`);
    this.name = 'TxRevertedError';
  }
}

export async function confirmTx(
  client: PublicClient | undefined,
  hash: `0x${string}`,
  timeoutMs = 120_000
): Promise<`0x${string}`> {
  if (!client) return hash;
  try {
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: timeoutMs });
    if (receipt.status !== 'success') throw new TxRevertedError(hash);
    return receipt.transactionHash;
  } catch (err) {
    if (err instanceof TxRevertedError) throw err;
    return hash;
  }
}
