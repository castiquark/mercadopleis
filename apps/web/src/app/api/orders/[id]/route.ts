import { NextRequest, NextResponse } from 'next/server';
import { db, orders, disputes } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';

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

    if (status === 'RELEASED' && !isBuyer && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Solo el comprador puede aprobar la entrega y liberar fondos' }, { status: 403 });
    }

    const resolvedDeliveryUrl = deliverableUrl ?? deliveryUrl;
    const resolvedDeliveryHash = deliverableHash ?? deliveryHash;
    const resolvedTxHashRelease = txHashRelease ?? (status === 'RELEASED' ? txHash : undefined);

    const [updatedOrder] = await db
      .update(orders)
      .set({
        status: status || existingOrder.status,
        contractOrderId: onChainOrderId !== undefined ? Number(onChainOrderId) : existingOrder.contractOrderId,
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
