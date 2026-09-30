import { NextRequest, NextResponse } from 'next/server';
import { db, orders, disputes } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { createPublicClient, http, parseEventLogs } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { MarketplaceEscrowAbi, ESCROW_ADDRESSES } from '@mercadopleis/contracts-abi';
import { CONTRACT_CONFIG } from '@mercadopleis/types';

async function verifyOnChainRelease(txHash: `0x${string}`, contractOrderId: number | null): Promise<boolean> {
  const mainnetRpc = process.env.BASE_MAINNET_RPC_URL || process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  const mainnetClient = createPublicClient({ chain: base, transport: http(mainnetRpc) });

  try {
    const receipt = await mainnetClient.getTransactionReceipt({ hash: txHash });
    if (receipt.status === 'success') {
      const logs = parseEventLogs({
        abi: MarketplaceEscrowAbi,
        logs: receipt.logs,
        eventName: 'OrderReleased',
      });
      if (logs.length > 0) {
        if (!contractOrderId || Number(logs[0].args.orderId) === contractOrderId) {
          return true;
        }
      }
    }
  } catch (mainnetErr) {
    // If not on mainnet, fallback to check on Base Sepolia
    try {
      const sepoliaRpc = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
      const sepoliaClient = createPublicClient({ chain: baseSepolia, transport: http(sepoliaRpc) });
      const receipt = await sepoliaClient.getTransactionReceipt({ hash: txHash });
      if (receipt.status === 'success') {
        const logs = parseEventLogs({
          abi: MarketplaceEscrowAbi,
          logs: receipt.logs,
          eventName: 'OrderReleased',
        });
        if (logs.length > 0) {
          if (!contractOrderId || Number(logs[0].args.orderId) === contractOrderId) {
            return true;
          }
        }
      }
    } catch {
      return false;
    }
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

    if (status === 'DELIVERED' && !isSeller && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Solo el prestador puede marcar la orden como entregada' }, { status: 403 });
    }

    if (status === 'RELEASED') {
      if (!isBuyer && !isAdmin) {
        return NextResponse.json({ error: 'Forbidden: Solo el comprador puede aprobar la entrega y liberar fondos' }, { status: 403 });
      }

      const releaseTx = txHashRelease ?? txHash;
      if (!releaseTx || !releaseTx.startsWith('0x') || releaseTx.length !== 66) {
        return NextResponse.json(
          { error: 'Valid on-chain transaction hash required to release escrow' },
          { status: 400 }
        );
      }

      const isValidOnChain = await verifyOnChainRelease(releaseTx as `0x${string}`, existingOrder.contractOrderId);
      if (!isValidOnChain) {
        return NextResponse.json(
          { error: 'Transaction verification failed: OrderReleased event not confirmed on Base' },
          { status: 400 }
        );
      }
    }

    const resolvedDeliveryUrl = deliverableUrl ?? deliveryUrl;
    const resolvedDeliveryHash = deliverableHash ?? deliveryHash;
    const resolvedTxHashRelease = txHashRelease ?? (status === 'RELEASED' ? txHash : undefined);

    // Ensure contractOrderId cannot be overwritten if already set unless by admin
    const newContractOrderId = onChainOrderId !== undefined && (!existingOrder.contractOrderId || isAdmin)
      ? Number(onChainOrderId)
      : existingOrder.contractOrderId;

    const [updatedOrder] = await db
      .update(orders)
      .set({
        status: status || existingOrder.status,
        contractOrderId: newContractOrderId,
        deliveryReferenceUrl: resolvedDeliveryUrl !== undefined ? resolvedDeliveryUrl : existingOrder.deliveryReferenceUrl,
        deliveryHash: resolvedDeliveryHash !== undefined ? resolvedDeliveryHash : existingOrder.deliveryHash,
        txHashRelease: resolvedTxHashRelease !== undefined ? resolvedTxHashRelease : existingOrder.txHashRelease,
        deliveredAt: status === 'DELIVERED' ? new Date() : existingOrder.deliveredAt,
        releasedAt: status === 'RELEASED' ? new Date() : existingOrder.releasedAt,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();

    return NextResponse.json({ order: updatedOrder });
  } catch (err: any) {
    console.error('Error in PATCH /api/orders/[id]:', err);
    return NextResponse.json({ error: 'Failed to update order', details: err?.message }, { status: 500 });
  }
}
