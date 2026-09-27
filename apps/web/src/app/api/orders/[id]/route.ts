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
    const { status, txHash, onChainOrderId, deliverableUrl, deliverableHash } = body;

    const existingOrder = await db.query.orders.findFirst({
      where: eq(orders.id, id),
    });

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const [updatedOrder] = await db
      .update(orders)
      .set({
        status: status || existingOrder.status,
        contractOrderId: onChainOrderId !== undefined ? Number(onChainOrderId) : existingOrder.contractOrderId,
        deliveryReferenceUrl: deliverableUrl !== undefined ? deliverableUrl : existingOrder.deliveryReferenceUrl,
        deliveryHash: deliverableHash !== undefined ? deliverableHash : existingOrder.deliveryHash,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(orders.id, id))
      .returning();

    return NextResponse.json({ order: updatedOrder });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
