import { Router, Response } from 'express';
import { db, reviews, orders, users, services } from '@mercadopleis/database';
import { eq, desc, sql } from 'drizzle-orm';
import { requireAuth, AuthenticatedRequest } from './auth';

export const reviewsRouter = Router();

/**
 * Submit a review for a completed order
 */
reviewsRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId, rating, comment } = req.body;

    if (!orderId || !rating || !comment) {
      return res.status(400).json({ error: 'orderId, rating, and comment are required' });
    }

    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { service: true },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.buyerId !== req.user!.id) {
      return res.status(403).json({ error: 'Only the buyer can review this order' });
    }

    if (order.status !== 'RELEASED') {
      return res.status(400).json({ error: 'Order must be RELEASED (completed) before submitting a review' });
    }

    // Check if already reviewed
    const existing = await db.query.reviews.findFirst({
      where: eq(reviews.orderId, orderId),
    });

    if (existing) {
      return res.status(400).json({ error: 'This order has already been reviewed' });
    }

    // Insert review
    const [newReview] = await db
      .insert(reviews)
      .values({
        orderId,
        reviewerId: req.user!.id,
        reviewedUserId: order.sellerId,
        rating: ratingNum,
        comment,
      })
      .returning();

    // Recalculate seller average rating
    const allSellerReviews = await db.query.reviews.findMany({
      where: eq(reviews.reviewedUserId, order.sellerId),
    });

    const totalRatings = (allSellerReviews as any[]).reduce((sum: number, r: any) => sum + Number(r.rating || 5), 0);
    const avgRating = (totalRatings / (allSellerReviews.length || 1)).toFixed(2);

    await db
      .update(users)
      .set({
        rating: avgRating,
        updatedAt: new Date(),
      })
      .where(eq(users.id, order.sellerId));

    return res.status(201).json({ review: newReview, sellerAverageRating: avgRating });
  } catch (error) {
    console.error('Error submitting review:', error);
    return res.status(500).json({ error: 'Failed to submit review' });
  }
});

/**
 * Get reviews for a specific seller
 */
reviewsRouter.get('/seller/:sellerId', async (req, res: Response) => {
  try {
    const sellerReviews = await db.query.reviews.findMany({
      where: eq(reviews.reviewedUserId, req.params.sellerId),
      orderBy: [desc(reviews.createdAt)],
      with: {
        order: {
          with: {
            service: true,
          },
        },
      },
    });

    return res.json({ reviews: sellerReviews });
  } catch (error) {
    console.error('Error fetching seller reviews:', error);
    return res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

/**
 * Get reviews for a service
 */
reviewsRouter.get('/service/:serviceId', async (req, res: Response) => {
  try {
    // Find all completed orders for this service
    const serviceOrders = await db.query.orders.findMany({
      where: eq(orders.serviceId, req.params.serviceId),
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

    return res.json({ reviews: serviceReviews });
  } catch (error) {
    console.error('Error fetching service reviews:', error);
    return res.status(500).json({ error: 'Failed to fetch service reviews' });
  }
});
