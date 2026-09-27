import { NextRequest, NextResponse } from 'next/server';
import { db, orders } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const serviceOrders = await db.query.orders.findMany({
      where: eq(orders.serviceId, id),
      with: {
        review: true,
        buyer: {
          columns: {
            id: true,
            walletAddress: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const serviceReviews = (serviceOrders as any[])
      .filter((o: any) => o.review !== null && o.review !== undefined)
      .map((o: any) => ({
        ...o.review,
        buyer: o.buyer,
      }));

    return NextResponse.json({ reviews: serviceReviews });
  } catch (error: any) {
    console.error('Error fetching service reviews:', error);
    return NextResponse.json({ error: 'Failed to fetch service reviews' }, { status: 500 });
  }
}
