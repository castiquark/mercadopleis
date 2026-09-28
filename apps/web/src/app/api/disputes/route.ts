import { NextRequest, NextResponse } from 'next/server';
import { db, disputes, orders } from '@mercadopleis/database';
import { eq, desc } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Strictly restricted to ADMINISTRATOR only
  if (authUser.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Forbidden: El módulo de arbitraje y disputas es de acceso exclusivo para el administrador' },
      { status: 403 }
    );
  }

  try {
    const list = await db.query.disputes.findMany({
      orderBy: [desc(disputes.createdAt)],
      with: {
        order: {
          with: {
            service: true,
            buyer: {
              columns: {
                id: true,
                walletAddress: true,
                displayName: true,
              },
            },
            seller: {
              columns: {
                id: true,
                walletAddress: true,
                displayName: true,
              },
            },
          },
        },
        openedBy: {
          columns: {
            id: true,
            walletAddress: true,
            displayName: true,
          },
        },
      },
    });

    return NextResponse.json({ disputes: list });
  } catch (error: any) {
    console.error('Error fetching disputes:', error);
    return NextResponse.json({ error: 'Failed to fetch disputes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { orderId, reason, evidenceUrl } = body;

    if (!orderId || !reason) {
      return NextResponse.json({ error: 'orderId and reason are required' }, { status: 400 });
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.buyerId !== authUser.id && order.sellerId !== authUser.id && authUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only participants can open a dispute' }, { status: 403 });
    }

    const existingDispute = await db.query.disputes.findFirst({
      where: eq(disputes.orderId, orderId),
    });

    if (existingDispute) {
      return NextResponse.json({ error: 'A dispute already exists for this order' }, { status: 400 });
    }

    const [newDispute] = await db
      .insert(disputes)
      .values({
        orderId,
        openedById: authUser.id,
        reason,
        evidenceUrl: evidenceUrl || null,
        status: 'OPEN',
      })
      .returning();

    await db
      .update(orders)
      .set({ status: 'DISPUTED', updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    return NextResponse.json({ dispute: newDispute }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating dispute:', error);
    return NextResponse.json({ error: 'Failed to open dispute' }, { status: 500 });
  }
}
