import { Router, Response } from 'express';
import { db, disputes, orders, users } from '@mercadopleis/database';
import { eq, desc } from 'drizzle-orm';
import { requireAuth, AuthenticatedRequest } from './auth';

export const disputesRouter = Router();

/**
 * List all disputes (public or authenticated)
 */
disputesRouter.get('/', async (req, res: Response) => {
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

    return res.json({ disputes: list });
  } catch (error) {
    console.error('Error fetching disputes:', error);
    return res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

/**
 * Open a formal dispute for an order
 */
disputesRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId, reason, evidenceUrl } = req.body;
    if (!orderId || !reason) {
      return res.status(400).json({ error: 'orderId and reason are required' });
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const userId = req.user!.id;
    if (order.buyerId !== userId && order.sellerId !== userId && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only participants can open a dispute' });
    }

    // Check if dispute already exists
    const existingDispute = await db.query.disputes.findFirst({
      where: eq(disputes.orderId, orderId),
    });

    if (existingDispute) {
      return res.status(400).json({ error: 'A dispute already exists for this order' });
    }

    // Insert dispute
    const [newDispute] = await db
      .insert(disputes)
      .values({
        orderId,
        openedById: userId,
        reason,
        evidenceUrl,
        status: 'OPEN',
      })
      .returning();

    // Update order status to DISPUTED
    await db
      .update(orders)
      .set({ status: 'DISPUTED', updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    return res.status(201).json({ dispute: newDispute });
  } catch (error) {
    console.error('Error creating dispute:', error);
    return res.status(500).json({ error: 'Failed to open dispute' });
  }
});

/**
 * Resolve a dispute (Arbitrator action)
 */
disputesRouter.post('/:id/resolve', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { sellerAwardUsdc, buyerRefundUsdc, resolutionNotes } = req.body;

    const dispute = await db.query.disputes.findFirst({
      where: eq(disputes.id, id),
      with: { order: true },
    });

    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    if (dispute.status === 'RESOLVED') {
      return res.status(400).json({ error: 'Dispute is already resolved' });
    }

    const sellerAward = parseFloat(sellerAwardUsdc || '0');
    const buyerRefund = parseFloat(buyerRefundUsdc || '0');

    const [updatedDispute] = await db
      .update(disputes)
      .set({
        status: 'RESOLVED',
        arbitratorId: req.user!.id,
        sellerAwardUsdc: sellerAward.toFixed(2),
        buyerRefundUsdc: buyerRefund.toFixed(2),
        resolutionNotes,
        resolvedAt: new Date(),
      })
      .where(eq(disputes.id, id))
      .returning();

    // Update order status accordingly
    const finalOrderStatus = sellerAward > 0 ? 'RELEASED' : 'REFUNDED';
    await db
      .update(orders)
      .set({
        status: finalOrderStatus,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, dispute.orderId));

    return res.json({ dispute: updatedDispute });
  } catch (error) {
    console.error('Error resolving dispute:', error);
    return res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});
