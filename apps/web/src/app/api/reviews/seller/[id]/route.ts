import { NextRequest, NextResponse } from 'next/server';
import { db, reviews } from '@mercadopleis/database';
import { eq, desc } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sellerReviews = await db.query.reviews.findMany({
      where: eq(reviews.reviewedUserId, id),
      orderBy: [desc(reviews.createdAt)],
      with: {
        order: {
          with: {
            service: true,
          },
        },
      },
    });

    return NextResponse.json({ reviews: sellerReviews });
  } catch (error: any) {
    console.error('Error fetching seller reviews:', error);
    return NextResponse.json({ error: 'Failed to fetch seller reviews' }, { status: 500 });
  }
}
