import { NextRequest, NextResponse } from 'next/server';
import { db, orders, users } from '@mercadopleis/database';
import { eq, or, desc } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';

export async function GET(request: NextRequest) {
  const authUser = getAuthUserFromRequest(request);
  const addressParam = request.nextUrl.searchParams.get('address');

  let targetUserId = authUser?.id;

  if (!targetUserId && addressParam) {
    const user = await db.query.users.findFirst({
      where: eq(users.walletAddress, addressParam.toLowerCase()),
    });
    targetUserId = user?.id;
  }

  if (!targetUserId) {
    return NextResponse.json({ orders: [] });
  }

  try {
    const role = request.nextUrl.searchParams.get('role'); // 'buyer' | 'seller' | undefined

    let whereClause = or(eq(orders.buyerId, targetUserId), eq(orders.sellerId, targetUserId));
    if (role === 'buyer') {
      whereClause = eq(orders.buyerId, targetUserId);
    } else if (role === 'seller') {
      whereClause = eq(orders.sellerId, targetUserId);
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
        review: true,
      },
    });

    return NextResponse.json({ orders: userOrders });
  } catch (err: any) {
    console.error('Error fetching orders:', err);
    return NextResponse.json({ error: 'Failed to fetch user orders' }, { status: 500 });
  }
}
