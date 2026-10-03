import { NextRequest, NextResponse } from 'next/server';
import { db, reviews, orders, users } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { LIMITS } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Debes iniciar sesión con tu wallet vía SIWE para calificar' },
        { status: 401 }
      );
    }

    const limited = await enforceRateLimit([{ name: 'reviews:create', id: authUser.id, limit: 20, windowSeconds: 3600 }]);
    if (limited) return limited;

    const body = await request.json();
    const { orderId, rating, comment } = body;

    if (!orderId || !rating || typeof comment !== 'string' || !comment.trim()) {
      return NextResponse.json({ error: 'orderId, rating, and comment are required' }, { status: 400 });
    }
    if (comment.length > LIMITS.reviewMax) {
      return NextResponse.json({ error: `comment must be at most ${LIMITS.reviewMax} characters` }, { status: 400 });
    }

    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 });
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { service: true, buyer: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const isBuyer =
      order.buyerId === authUser.id ||
      (order.buyer?.walletAddress && order.buyer.walletAddress.toLowerCase() === authUser.walletAddress.toLowerCase());

    if (!isBuyer) {
      return NextResponse.json({ error: 'Forbidden: Solo el comprador de la orden puede calificar este servicio' }, { status: 403 });
    }

    if (order.status !== 'RELEASED') {
      return NextResponse.json({ error: 'Order must be RELEASED (completed) before submitting a review' }, { status: 400 });
    }

    const existing = await db.query.reviews.findFirst({
      where: eq(reviews.orderId, orderId),
    });

    if (existing) {
      return NextResponse.json({ error: 'This order has already been reviewed' }, { status: 400 });
    }

    const [newReview] = await db
      .insert(reviews)
      .values({
        orderId,
        reviewerId: authUser.id,
        reviewedUserId: order.sellerId,
        rating: ratingNum,
        comment,
      })
      .returning();

    const allSellerReviews = await db.query.reviews.findMany({
      where: eq(reviews.reviewedUserId, order.sellerId),
    });

    const totalRatings = (allSellerReviews as any[]).reduce(
      (sum: number, r: any) => sum + Number(r.rating || 5),
      0
    );
    const avgRating = (totalRatings / (allSellerReviews.length || 1)).toFixed(2);

    await db
      .update(users)
      .set({
        rating: avgRating,
        updatedAt: new Date(),
      })
      .where(eq(users.id, order.sellerId));

    return NextResponse.json({ review: newReview, sellerAverageRating: avgRating }, { status: 201 });
  } catch (error: any) {
    console.error('Error submitting review:', error);
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
  }
}
