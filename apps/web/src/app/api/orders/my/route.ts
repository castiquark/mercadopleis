import { NextRequest, NextResponse } from 'next/server';
import { db, orders } from '@mercadopleis/database';
import { eq, or, desc } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';

export async function GET(request: NextRequest) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const role = request.nextUrl.searchParams.get('role'); // 'buyer' | 'seller' | undefined

    let whereClause = or(eq(orders.buyerId, authUser.id), eq(orders.sellerId, authUser.id));
    if (role === 'buyer') {
      whereClause = eq(orders.buyerId, authUser.id);
    } else if (role === 'seller') {
      whereClause = eq(orders.sellerId, authUser.id);
    }

    const userOrders = await db.query.orders.findMany({
      where: whereClause,
      orderBy: [desc(orders.createdAt)],
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
        dispute: true,
      },
    });

    return NextResponse.json({ orders: userOrders });
  } catch (err: any) {
    console.error('Error fetching orders:', err);
    return NextResponse.json({ error: 'Failed to fetch user orders' }, { status: 500 });
  }
}
