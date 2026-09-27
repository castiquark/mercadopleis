import { NextRequest, NextResponse } from 'next/server';
import { db, orders, services } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { calculateOrderAmounts } from '@mercadopleis/contracts-abi';
import { CONTRACT_CONFIG } from '@mercadopleis/types';

export async function POST(request: NextRequest) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { serviceId, contractOrderId, txHashFunding } = body;

    if (!serviceId) {
      return NextResponse.json({ error: 'serviceId is required' }, { status: 400 });
    }

    const service = await db.query.services.findFirst({
      where: eq(services.id, serviceId),
    });

    if (!service || !service.isActive) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 404 });
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
        buyerId: authUser.id,
        sellerId: service.sellerId,
        contractOrderId: contractOrderId !== undefined && contractOrderId !== null ? Number(contractOrderId) : null,
        txHashFunding: txHashFunding || null,
        grossAmountUsdc: grossAmount.toString(),
        platformFeeBps: feeBps,
        platformFeeUsdc: platformFeeUsdc.toString(),
        sellerAmountUsdc: sellerAmountUsdc.toString(),
        status: 'FUNDED',
        deadlineTimestamp,
      })
      .returning();

    return NextResponse.json(
      {
        order: newOrder,
        quote: {
          grossAmount,
          platformFeeUsdc,
          sellerAmountUsdc,
          deliveryDays: service.deliveryDays,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Error creating order:', err);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
