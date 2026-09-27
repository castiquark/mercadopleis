import { NextRequest, NextResponse } from 'next/server';
import { db, disputes, orders } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';

export async function POST(
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
    const { sellerAwardUsdc, buyerRefundUsdc, resolutionNotes } = body;

    const dispute = await db.query.disputes.findFirst({
      where: eq(disputes.id, id),
      with: { order: true },
    });

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    if (dispute.status === 'RESOLVED') {
      return NextResponse.json({ error: 'Dispute is already resolved' }, { status: 400 });
    }

    const sellerAward = parseFloat(sellerAwardUsdc || '0');
    const buyerRefund = parseFloat(buyerRefundUsdc || '0');

    const [updatedDispute] = await db
      .update(disputes)
      .set({
        status: 'RESOLVED',
        arbitratorId: authUser.id,
        sellerAwardUsdc: sellerAward.toFixed(2),
        buyerRefundUsdc: buyerRefund.toFixed(2),
        resolutionNotes,
        resolvedAt: new Date().toISOString(),
      })
      .where(eq(disputes.id, id))
      .returning();

    const finalOrderStatus = sellerAward > 0 ? 'RELEASED' : 'REFUNDED';
    await db
      .update(orders)
      .set({
        status: finalOrderStatus,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(orders.id, dispute.orderId));

    return NextResponse.json({
      dispute: updatedDispute,
      message: 'Dispute resolved successfully',
    });
  } catch (error: any) {
    console.error('Error resolving dispute:', error);
    return NextResponse.json({ error: 'Failed to resolve dispute' }, { status: 500 });
  }
}
