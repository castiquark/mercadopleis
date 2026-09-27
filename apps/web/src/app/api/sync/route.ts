import { NextResponse } from 'next/server';
import { createPublicClient, http, parseAbiItem, defineChain } from 'viem';
import { db, orders } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';

const baseSepoliaChain = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sepolia.base.org'] },
  },
});

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
const ESCROW_ADDRESS = (process.env.MARKETPLACE_ESCROW_ADDRESS || process.env.NEXT_PUBLIC_ESCROW_ADDRESS || '0x9E5b4C1112F026568233DC571Dd4120DbE9fBF48') as `0x${string}`;

export async function GET() {
  try {
    const client = createPublicClient({
      chain: baseSepoliaChain,
      transport: http(RPC_URL),
    });

    const currentBlock = await client.getBlockNumber();
    const fromBlock = currentBlock > 500n ? currentBlock - 500n : 0n;

    // Scan OrderFunded
    const orderFundedLogs = await client.getLogs({
      address: ESCROW_ADDRESS,
      event: parseAbiItem('event OrderFunded(uint256 indexed orderId, address indexed buyer, address indexed seller, address token, uint256 amount, uint256 deadline)'),
      fromBlock,
      toBlock: currentBlock,
    });

    // Scan DeliverySubmitted
    const deliveryLogs = await client.getLogs({
      address: ESCROW_ADDRESS,
      event: parseAbiItem('event DeliverySubmitted(uint256 indexed orderId, address indexed seller, bytes32 deliveryHash, uint256 autoReleaseTime)'),
      fromBlock,
      toBlock: currentBlock,
    });

    // Scan OrderReleased
    const releaseLogs = await client.getLogs({
      address: ESCROW_ADDRESS,
      event: parseAbiItem('event OrderReleased(uint256 indexed orderId, uint256 sellerPayout, uint256 platformFee)'),
      fromBlock,
      toBlock: currentBlock,
    });

    // Update orders if matching
    for (const log of deliveryLogs) {
      const orderId = Number((log.args as any).orderId);
      const deliveryHash = (log.args as any).deliveryHash;
      await db
        .update(orders)
        .set({ status: 'DELIVERED', deliveryHash })
        .where(eq(orders.contractOrderId, orderId));
    }

    for (const log of releaseLogs) {
      const orderId = Number((log.args as any).orderId);
      await db
        .update(orders)
        .set({ status: 'RELEASED' })
        .where(eq(orders.contractOrderId, orderId));
    }

    return NextResponse.json({
      synced: true,
      currentBlock: currentBlock.toString(),
      scannedFromBlock: fromBlock.toString(),
      eventsFound: {
        orderFunded: orderFundedLogs.length,
        deliverySubmitted: deliveryLogs.length,
        orderReleased: releaseLogs.length,
      },
    });
  } catch (err: any) {
    console.error('Error during on-demand blockchain sync:', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
