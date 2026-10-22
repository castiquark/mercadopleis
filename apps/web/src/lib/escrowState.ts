// Reads an order straight from the escrow contract. The API uses it when a transaction receipt cannot be found
// (smart accounts and relayers can land a transaction under another hash, or later than the API waits): the
// contract state is the source of truth, so a status change it confirms can be recorded without the receipt.
import { createPublicClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { MarketplaceEscrowAbi, ESCROW_ADDRESSES } from '@mercadopleis/contracts-abi';

// Same order as `enum OrderStatus` in MarketplaceEscrow.sol.
export const ESCROW_STATUS = ['None', 'Funded', 'Delivered', 'Released', 'Refunded', 'Disputed', 'Resolved'] as const;
export type EscrowStatus = (typeof ESCROW_STATUS)[number];

export interface EscrowOrder {
  buyer: string;
  seller: string;
  token: string;
  amount: bigint;
  deadline: number;
  autoReleaseTime: number;
  deliveryHash: string;
  status: EscrowStatus;
}

export function escrowClient(chainId: number) {
  const isSepolia = chainId === 84532;
  const rpc = isSepolia
    ? process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
    : process.env.BASE_MAINNET_RPC_URL || process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  return {
    client: createPublicClient({ chain: isSepolia ? baseSepolia : base, transport: http(rpc) }),
    escrow: ESCROW_ADDRESSES[isSepolia ? 84532 : 8453] as `0x${string}`,
  };
}

/** The order as the contract stores it, or null if it does not exist (or the RPC failed). */
export async function readEscrowOrder(chainId: number, contractOrderId: number): Promise<EscrowOrder | null> {
  if (!Number.isInteger(contractOrderId) || contractOrderId <= 0) return null;
  try {
    const { client, escrow } = escrowClient(chainId);
    const o = (await client.readContract({
      address: escrow,
      abi: MarketplaceEscrowAbi,
      functionName: 'orders',
      args: [BigInt(contractOrderId)],
    })) as readonly [string, string, string, bigint, bigint, bigint, string, number];
    const status = ESCROW_STATUS[Number(o[7])] ?? 'None';
    if (status === 'None') return null;
    return {
      buyer: o[0],
      seller: o[1],
      token: o[2],
      amount: o[3],
      deadline: Number(o[4]),
      autoReleaseTime: Number(o[5]),
      deliveryHash: o[6],
      status,
    };
  } catch {
    return null;
  }
}

// The arbitrator is read from the contract (arbitrator()), not assumed to be the deployer wallet: it can change
// with setArbitrator. Cached for 5 minutes per chain; an RPC failure counts as "not the arbitrator".
const arbitratorCache = new Map<number, { address: string | null; at: number }>();

export async function readArbitrator(chainId: number): Promise<string | null> {
  const hit = arbitratorCache.get(chainId);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.address;
  let address: string | null = null;
  try {
    const { client, escrow } = escrowClient(chainId);
    address = ((await client.readContract({ address: escrow, abi: MarketplaceEscrowAbi, functionName: 'arbitrator' })) as string).toLowerCase();
  } catch {
    address = null;
  }
  arbitratorCache.set(chainId, { address, at: Date.now() });
  return address;
}

/** True if the wallet is the escrow arbitrator on Base Mainnet or Base Sepolia. */
export async function isOnchainArbitrator(wallet: string): Promise<boolean> {
  const w = wallet.toLowerCase();
  const [main, sepolia] = await Promise.all([readArbitrator(8453), readArbitrator(84532)]);
  return w === main || w === sepolia;
}
