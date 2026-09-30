import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { db, orders } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';
import { ESCROW_ADDRESSES } from '@mercadopleis/contracts-abi';
import { CONTRACT_CONFIG } from '@mercadopleis/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const requestedChainId = Number(searchParams.get('chainId')) || 
      (process.env.NEXT_PUBLIC_CHAIN_ID ? Number(process.env.NEXT_PUBLIC_CHAIN_ID) : CONTRACT_CONFIG.BASE_MAINNET_CHAIN_ID);

    const isSepolia = requestedChainId === CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID;
    const targetChain = isSepolia ? baseSepolia : base;
    const targetChainId = targetChain.id;

    const rpcUrl = isSepolia
      ? (process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org')
      : (process.env.BASE_MAINNET_RPC_URL || process.env.BASE_RPC_URL || 'https://mainnet.base.org');

    const escrowAddress = (
      process.env.MARKETPLACE_ESCROW_ADDRESS ||
      ESCROW_ADDRESSES[targetChainId] ||
      '0x9E5b4C1112F026568233DC571Dd4120DbE9fBF48'
    ) as `0x${string}`;

    const client = createPublicClient({
      chain: targetChain,
      transport: http(rpcUrl),
    });

    const currentBlock = await client.getBlockNumber();
    const blocksToScan = BigInt(searchParams.get('blocks') || '1000');
    const fromBlock = currentBlock > blocksToScan ? currentBlock - blocksToScan : 0n;

    // Scan OrderFunded
    const orderFundedLogs = await client.getLogs({
      address: escrowAddress,
      event: parseAbiItem('event OrderFunded(uint256 indexed orderId, address indexed buyer, address indexed seller, address token, uint256 amount, uint256 deadline)'),
      fromBlock,
      toBlock: currentBlock,
    });

    // Scan DeliverySubmitted
    const deliveryLogs = await client.getLogs({
      address: escrowAddress,
      event: parseAbiItem('event DeliverySubmitted(uint256 indexed orderId, address indexed seller, bytes32 deliveryHash, uint256 autoReleaseTime)'),
      fromBlock,
      toBlock: currentBlock,
    });

    // Scan OrderReleased
    const releaseLogs = await client.getLogs({
      address: escrowAddress,
      event: parseAbiItem('event OrderReleased(uint256 indexed orderId, uint256 sellerPayout, uint256 platformFee)'),
      fromBlock,
      toBlock: currentBlock,
    });

    // Scan DisputeResolved
    const disputeResolvedLogs = await client.getLogs({
      address: escrowAddress,
      event: parseAbiItem('event DisputeResolved(uint256 indexed orderId, uint256 sellerPayout, uint256 buyerRefund, uint256 platformFee)'),
      fromBlock,
      toBlock: currentBlock,
    });

    // Reconcile Delivery events
    for (const log of deliveryLogs) {
      const orderId = Number((log.args as any).orderId);
      const deliveryHash = (log.args as any).deliveryHash;
      await db
        .update(orders)
        .set({ status: 'DELIVERED', deliveryHash })
        .where(eq(orders.contractOrderId, orderId));
    }

    // Reconcile Release events
    for (const log of releaseLogs) {
      const orderId = Number((log.args as any).orderId);
      await db
        .update(orders)
        .set({ status: 'RELEASED' })
        .where(eq(orders.contractOrderId, orderId));
    }

    // Reconcile Dispute Resolution events
    for (const log of disputeResolvedLogs) {
      const orderId = Number((log.args as any).orderId);
      await db
        .update(orders)
        .set({ status: 'RESOLVED' })
        .where(eq(orders.contractOrderId, orderId));
    }

    return NextResponse.json({
      synced: true,
      network: targetChain.name,
      chainId: targetChainId,
      escrowAddress,
      currentBlock: currentBlock.toString(),
      scannedFromBlock: fromBlock.toString(),
      eventsFound: {
        orderFunded: orderFundedLogs.length,
        deliverySubmitted: deliveryLogs.length,
        orderReleased: releaseLogs.length,
        disputeResolved: disputeResolvedLogs.length,
      },
    });
  } catch (err: any) {
    console.error('[Sync] Error during blockchain event reconciliation:', err);
    return NextResponse.json({ error: 'Sync failed', details: err?.message }, { status: 500 });
  }
}
