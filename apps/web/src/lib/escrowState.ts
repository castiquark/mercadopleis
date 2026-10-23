// Reads an order straight from the escrow contract. The API uses it when a transaction receipt cannot be found
// (smart accounts and relayers can land a transaction under another hash, or later than the API waits): the
// contract state is the source of truth, so a status change it confirms can be recorded without the receipt.
import { createPublicClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { MarketplaceEscrowV3Abi as MarketplaceEscrowAbi } from '@mercadopleis/contracts-abi';
import { currentEscrow, knownEscrows, orderEscrow } from './networks';

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

export function escrowClient(chainId: number, escrowAddress?: string | null) {
  const isSepolia = chainId === 84532;
  const rpc = isSepolia
    ? process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
    : process.env.BASE_MAINNET_RPC_URL || process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  return {
    client: createPublicClient({ chain: isSepolia ? baseSepolia : base, transport: http(rpc) }),
    escrow: escrowAddress ? orderEscrow(chainId, escrowAddress) : currentEscrow(chainId),
  };
}

/** The order as the contract stores it, or null if it does not exist (or the RPC failed). */
export async function readEscrowOrder(chainId: number, contractOrderId: number, escrowAddress?: string | null): Promise<EscrowOrder | null> {
  if (!Number.isInteger(contractOrderId) || contractOrderId <= 0) return null;
  try {
    const { client, escrow } = escrowClient(chainId, escrowAddress);
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
// with setArbitrator. Successful reads are cached for 5 minutes per escrow; failures are not cached and return null.
const arbitratorCache = new Map<string, { address: string; at: number }>();

export async function readArbitrator(chainId: number, escrowAddress?: string | null): Promise<string | null> {
  const key = `${chainId}:${(escrowAddress ?? currentEscrow(chainId)).toLowerCase()}`;
  const hit = arbitratorCache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.address;
  try {
    const { client, escrow } = escrowClient(chainId, escrowAddress);
    const address = ((await client.readContract({ address: escrow, abi: MarketplaceEscrowAbi, functionName: 'arbitrator' })) as string).toLowerCase();
    arbitratorCache.set(key, { address, at: Date.now() });
    return address;
  } catch {
    return null;
  }
}

/**
 * Whether the wallet is the arbitrator of any escrow the web reads (v3 and v2, Base Mainnet and Sepolia).
 * true: it is; false: every read succeeded and it is not; null: not known (some read failed and none matched).
 */
export async function isOnchainArbitrator(wallet: string): Promise<boolean | null> {
  const w = wallet.toLowerCase();
  const all = await Promise.all([8453, 84532].flatMap((c) => knownEscrows(c).map((e) => readArbitrator(c, e))));
  if (all.includes(w)) return true;
  return all.includes(null) ? null : false;
}
