import { NextRequest, NextResponse } from 'next/server';
import { db, orders, disputes } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { isSafeHttpUrl } from '@/lib/validation';
import { isStorageRefOwnedBy } from '@/lib/storage';
import { createPublicClient, http, parseEventLogs } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { MarketplaceEscrowAbi, ESCROW_ADDRESSES } from '@mercadopleis/contracts-abi';
import { CONTRACT_CONFIG } from '@mercadopleis/types';

async function verifyOnChainDelivery(
  txHash: `0x${string}`,
  contractOrderId: number,
  expectedSellerWallet: string,
  expectedDeliveryHash: string,
  targetChainId: number
): Promise<number | null> {
  if (!contractOrderId || contractOrderId <= 0) return null;

  const isSepolia = targetChainId === 84532;
  const chain = isSepolia ? baseSepolia : base;
  const escrow = ESCROW_ADDRESSES[isSepolia ? 84532 : 8453];
  const rpc = isSepolia
    ? (process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org')
    : (process.env.BASE_MAINNET_RPC_URL || process.env.BASE_RPC_URL || 'https://mainnet.base.org');

  try {
    const client = createPublicClient({ chain, transport: http(rpc) });
    const receipt = await client.getTransactionReceipt({ hash: txHash });

    if (receipt && receipt.status === 'success') {
      if (!receipt.to || receipt.to.toLowerCase() !== escrow.toLowerCase()) {
        return null;
      }

      const logs = parseEventLogs({
        abi: MarketplaceEscrowAbi,
        logs: receipt.logs,
        eventName: 'DeliverySubmitted',
      });

      if (logs.length > 0) {
        const log = logs[0];
        if (
          log.address.toLowerCase() === escrow.toLowerCase() &&
          Number(log.args.orderId) === contractOrderId &&
          log.args.seller.toLowerCase() === expectedSellerWallet.toLowerCase() &&
          log.args.deliveryHash.toLowerCase() === expectedDeliveryHash.toLowerCase()
        ) {
          // When the seller can claim the payout if the buyer neither approves nor disputes.
          return Number(log.args.autoReleaseTime);
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function verifyOnChainRelease(
  txHash: `0x${string}`,
  contractOrderId: number,
  expectedGrossAmountUsdc: number,
  targetChainId: number
): Promise<boolean> {
  if (!contractOrderId || contractOrderId <= 0) return false;

  const isSepolia = targetChainId === 84532;
  const chain = isSepolia ? baseSepolia : base;
  const escrow = ESCROW_ADDRESSES[isSepolia ? 84532 : 8453];
  const rpc = isSepolia
    ? (process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org')
    : (process.env.BASE_MAINNET_RPC_URL || process.env.BASE_RPC_URL || 'https://mainnet.base.org');

  try {
    const client = createPublicClient({ chain, transport: http(rpc) });
    const receipt = await client.getTransactionReceipt({ hash: txHash });

    if (receipt && receipt.status === 'success') {
      if (!receipt.to || receipt.to.toLowerCase() !== escrow.toLowerCase()) {
        return false;
      }

      const logs = parseEventLogs({
        abi: MarketplaceEscrowAbi,
        logs: receipt.logs,
        eventName: 'OrderReleased',
      });

      if (logs.length > 0) {
        const log = logs[0];
        if (
          log.address.toLowerCase() === escrow.toLowerCase() &&
          Number(log.args.orderId) === contractOrderId
        ) {
          const totalPayout = log.args.sellerPayout + log.args.platformFee;
          const expectedRaw = BigInt(Math.round(expectedGrossAmountUsdc * 1_000_000));
          if (totalPayout !== expectedRaw) {
            return false;
          }
          return true;
        }
      }
    }
  } catch {
    return false;
  }

  return false;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: {
        service: true,
        buyer: true,
        seller: true,
        dispute: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.buyerId !== authUser.id && order.sellerId !== authUser.id && authUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ order });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      status,
      txHash,
      txHashRelease,
      txHashFunding,
      onChainOrderId,
      deliverableUrl,
      deliveryUrl,
      deliverableHash,
      deliveryHash,
    } = body;

    const existingOrder = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: {
        seller: true,
        buyer: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const isBuyer = existingOrder.buyerId === authUser.id;
    const isSeller = existingOrder.sellerId === authUser.id;
    const isAdmin = authUser.role === 'ADMIN';

    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: No tienes autorización para modificar esta orden' }, { status: 403 });
    }

    const resolvedDeliveryUrl = deliverableUrl ?? deliveryUrl;
    if (
      resolvedDeliveryUrl !== undefined &&
      !isSafeHttpUrl(resolvedDeliveryUrl) &&
      !isStorageRefOwnedBy(resolvedDeliveryUrl, [authUser.id, existingOrder.sellerId])
    ) {
      return NextResponse.json({ error: 'deliverableUrl must be an http(s) URL or a file you uploaded' }, { status: 400 });
    }
    const resolvedDeliveryHash = deliverableHash ?? deliveryHash;
    const targetChainId = existingOrder.chainId || CONTRACT_CONFIG.BASE_MAINNET_CHAIN_ID;

    // Strict status transition rules:
    // PATCH /api/orders/[id] cannot be used to arbitrarily set financial statuses.
    // Escrow states (FUNDED, DISPUTED, REFUNDED, RESOLVED) are strictly governed by smart contract events and dispute routes.
    let targetStatus = existingOrder.status;
    let autoReleaseDeadline: number | null = existingOrder.autoReleaseDeadline;

    if (status !== undefined && status !== existingOrder.status) {
      if (status !== 'DELIVERED' && status !== 'RELEASED') {
        return NextResponse.json(
          {
            error: `Forbidden status modification: '${status}' cannot be set directly via PATCH /api/orders. Escrow states (FUNDED, DISPUTED, REFUNDED, RESOLVED) are strictly derived from on-chain smart contract events.`,
          },
          { status: 400 }
        );
      }

      if (status === 'DELIVERED') {
        if (!isSeller && !isAdmin) {
          return NextResponse.json({ error: 'Forbidden: Solo el prestador puede marcar la orden como entregada' }, { status: 403 });
        }

        if (existingOrder.status !== 'FUNDED') {
          return NextResponse.json(
            { error: `Cannot transition from '${existingOrder.status}' to DELIVERED (order must be FUNDED)` },
            { status: 400 }
          );
        }

        if (!existingOrder.contractOrderId) {
          return NextResponse.json({ error: 'La orden carece de contractOrderId on-chain' }, { status: 400 });
        }

        const deliveryTx = txHash ?? body.txHashDelivery;
        if (!deliveryTx || !deliveryTx.startsWith('0x') || deliveryTx.length !== 66) {
          return NextResponse.json(
            { error: 'Valid on-chain transaction hash required to verify delivery' },
            { status: 400 }
          );
        }

        if (!resolvedDeliveryHash || !resolvedDeliveryHash.startsWith('0x') || resolvedDeliveryHash.length !== 66) {
          return NextResponse.json(
            { error: 'Valid 32-byte cryptographic deliveryHash required' },
            { status: 400 }
          );
        }

        autoReleaseDeadline = await verifyOnChainDelivery(
          deliveryTx as `0x${string}`,
          existingOrder.contractOrderId,
          existingOrder.seller.walletAddress,
          resolvedDeliveryHash,
          targetChainId
        );

        if (autoReleaseDeadline === null) {
          return NextResponse.json(
            { error: `Transaction verification failed: DeliverySubmitted event not confirmed on chain ${targetChainId} for this order` },
            { status: 400 }
          );
        }

        targetStatus = 'DELIVERED';
      }

      if (status === 'RELEASED') {
        // The buyer approves, or the seller claims the automatic release after the review window.
        // Either way the OrderReleased event below is the proof, so both parties may report it.

        if (existingOrder.status !== 'DELIVERED') {
          return NextResponse.json(
            { error: `Cannot release order in status '${existingOrder.status}' (deliverable must be submitted first)` },
            { status: 400 }
          );
        }

        if (!existingOrder.contractOrderId) {
          return NextResponse.json({ error: 'La orden carece de contractOrderId on-chain' }, { status: 400 });
        }

        const releaseTx = txHashRelease ?? txHash;
        if (!releaseTx || !releaseTx.startsWith('0x') || releaseTx.length !== 66) {
          return NextResponse.json(
            { error: 'Valid on-chain transaction hash required to release escrow' },
            { status: 400 }
          );
        }

        const isValidOnChain = await verifyOnChainRelease(
          releaseTx as `0x${string}`,
          existingOrder.contractOrderId,
          parseFloat(existingOrder.grossAmountUsdc),
          targetChainId
        );

        if (!isValidOnChain) {
          return NextResponse.json(
            { error: `Transaction verification failed: OrderReleased event not confirmed on chain ${targetChainId} with matching payouts` },
            { status: 400 }
          );
        }

        targetStatus = 'RELEASED';
      }
    }

    const resolvedTxHashRelease = txHashRelease ?? (targetStatus === 'RELEASED' ? txHash : undefined);

    const [updatedOrder] = await db
      .update(orders)
      .set({
        status: targetStatus,
        deliveryReferenceUrl: resolvedDeliveryUrl !== undefined ? resolvedDeliveryUrl : existingOrder.deliveryReferenceUrl,
        deliveryHash: resolvedDeliveryHash !== undefined ? resolvedDeliveryHash : existingOrder.deliveryHash,
        txHashRelease: resolvedTxHashRelease !== undefined ? resolvedTxHashRelease : existingOrder.txHashRelease,
        autoReleaseDeadline,
        deliveredAt: targetStatus === 'DELIVERED' ? (existingOrder.deliveredAt || new Date()) : existingOrder.deliveredAt,
        releasedAt: targetStatus === 'RELEASED' ? (existingOrder.releasedAt || new Date()) : existingOrder.releasedAt,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();

    return NextResponse.json({ order: updatedOrder });
  } catch (err: any) {
    console.error('Error in PATCH /api/orders/[id]:', err);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
