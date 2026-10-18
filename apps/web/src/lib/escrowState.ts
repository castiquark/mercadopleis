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
