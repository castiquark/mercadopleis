import { Router, Response } from 'express';
import { db, orders, services, disputes } from '@mercadopleis/database';
import { eq, or, and, desc } from 'drizzle-orm';
import { requireAuth, AuthenticatedRequest } from './auth';
import { calculateOrderAmounts } from '@mercadopleis/contracts-abi';
import { CONTRACT_CONFIG } from '@mercadopleis/types';

export const ordersRouter = Router();

/**
 * Lists orders for the authenticated user (both buyer and seller perspectives)
 */
ordersRouter.get('/my', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { role } = req.query; // 'buyer' | 'seller' | undefined

    let whereClause = or(eq(orders.buyerId, userId), eq(orders.sellerId, userId));
    if (role === 'buyer') {
      whereClause = eq(orders.buyerId, userId);
    } else if (role === 'seller') {
      whereClause = eq(orders.sellerId, userId);
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
      },
    });

    return res.json({ orders: userOrders });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch user orders' });
  }
});

/**
 * Gets specific order details
 */
ordersRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, req.params.id),
      with: {
        service: true,
        buyer: true,
        seller: true,
        dispute: true,
        review: true,
        transactions: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Access check: only buyer, seller, or admin can inspect order details
    const userId = req.user!.id;
    if (order.buyerId !== userId && order.sellerId !== userId && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json({ order });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch order' });
  }
});

/**
 * Prepares an order record before wallet funding
 */
ordersRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { serviceId } = req.body;
    if (!serviceId) {
      return res.status(400).json({ error: 'serviceId is required' });
    }

    const service = await db.query.services.findFirst({
      where: eq(services.id, serviceId),
    });

    if (!service || !service.isActive) {
      return res.status(404).json({ error: 'Service unavailable' });
    }

    if (service.sellerId === req.user!.id && process.env.NODE_ENV === 'production') {
      return res.status(400).json({ error: 'Cannot purchase your own service' });
    }

    const grossAmount = parseFloat(service.priceUsdc);
    const { platformFeeUsdc, sellerAmountUsdc, feeBps } = calculateOrderAmounts(
      grossAmount,
      CONTRACT_CONFIG.INITIAL_FEE_BPS
    );

    const deadlineTimestamp = Math.floor(Date.now() / 1000) + service.deliveryDays * 86400;

    const [newOrder] = await db
      .insert(orders)
      .values({
        serviceId: service.id,
        buyerId: req.user!.id,
        sellerId: service.sellerId,
        grossAmountUsdc: grossAmount.toString(),
        platformFeeBps: feeBps,
        platformFeeUsdc: platformFeeUsdc.toString(),
        sellerAmountUsdc: sellerAmountUsdc.toString(),
        status: 'FUNDED',
        deadlineTimestamp,
      })
      .returning();

    return res.status(201).json({
      order: newOrder,
      quote: {
        grossAmount,
        platformFeeUsdc,
        sellerAmountUsdc,
        deliveryDays: service.deliveryDays,
      },
    });
  } catch (error) {
    console.error('Error preparing order:', error);
    return res.status(500).json({ error: 'Failed to prepare order' });
  }
});

/**
 * Updates order status and metadata (e.g. from frontend action or escrow receipt)
 */
ordersRouter.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, contractOrderId, txHashFunding, txHashRelease, deliveryUrl, deliveryHash } = req.body;

    const existingOrder = await db.query.orders.findFirst({
      where: eq(orders.id, id),
    });

    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const userId = req.user!.id;
    if (existingOrder.buyerId !== userId && existingOrder.sellerId !== userId && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updateFields: any = { updatedAt: new Date() };
    if (status) updateFields.status = status;
    if (contractOrderId !== undefined) updateFields.contractOrderId = contractOrderId;
    if (txHashFunding) updateFields.txHashFunding = txHashFunding;
    if (txHashRelease) updateFields.txHashRelease = txHashRelease;
    if (deliveryUrl) updateFields.deliveryUrl = deliveryUrl;
    if (deliveryHash) updateFields.deliveryHash = deliveryHash;
    if (status === 'DELIVERED') {
      updateFields.deliveredAt = new Date();
      updateFields.autoReleaseDeadline = Math.floor(Date.now() / 1000) + 86400 * 5;
    }
    if (status === 'RELEASED') {
      updateFields.releasedAt = new Date();
    }

    const [updatedOrder] = await db
      .update(orders)
      .set(updateFields)
      .where(eq(orders.id, id))
      .returning();

    return res.json({ order: updatedOrder });
  } catch (error) {
    console.error('Error updating order:', error);
    return res.status(500).json({ error: 'Failed to update order' });
  }
});
