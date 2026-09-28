import { NextRequest, NextResponse } from 'next/server';
import { db, reviews, orders, users } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, rating, comment, reviewerWallet } = body;

    const authUser = getAuthUserFromRequest(request);
    let reviewerUserId = authUser?.id;

    if (!reviewerUserId && reviewerWallet) {
      const lowerWallet = reviewerWallet.toLowerCase();
      let user = await db.query.users.findFirst({
        where: eq(users.walletAddress, lowerWallet),
      });
      if (!user) {
        const [created] = await db
          .insert(users)
          .values({
            walletAddress: lowerWallet,
            displayName: `0x${lowerWallet.slice(2, 6)}...${lowerWallet.slice(-4)}`,
          })
          .returning();
        user = created;
      }
      reviewerUserId = user?.id;
    }

    if (!reviewerUserId) {
      return NextResponse.json({ error: 'Unauthorized: Conecta tu wallet o inicia sesión con SIWE para calificar' }, { status: 401 });
    }

    if (!orderId || !rating || !comment) {
      return NextResponse.json({ error: 'orderId, rating, and comment are required' }, { status: 400 });
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
      order.buyerId === reviewerUserId ||
      (reviewerWallet && order.buyer?.walletAddress?.toLowerCase() === reviewerWallet.toLowerCase()) ||
      (authUser && order.buyer?.walletAddress?.toLowerCase() === authUser.walletAddress.toLowerCase());

    if (!isBuyer) {
      return NextResponse.json({ error: 'Only the buyer can review this order' }, { status: 403 });
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
        reviewerId: reviewerUserId,
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
